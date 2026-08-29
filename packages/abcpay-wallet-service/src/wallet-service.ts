import { z } from 'zod';
import { Errors } from './errors';
import {
  AddressType,
  Coin,
  Network,
  addressPath,
  copayerId,
  deriveAddress,
  getCopayerHash,
  newId,
  verifyMessage
} from './crypto';
import { Storage, WalletRecord } from './storage';

export const createWalletSchema = z.object({
  name: z.string().min(1).max(100),
  m: z.number().int().min(1).max(15),
  n: z.number().int().min(1).max(15),
  pubKey: z.string().min(1),
  coin: z.enum(['xec', 'doge']),
  network: z.enum(['livenet', 'testnet']).default('livenet')
});

export const joinWalletSchema = z.object({
  walletId: z.string().min(1),
  name: z.string().min(1).max(100),
  xPubKey: z.string().min(1),
  requestPubKey: z.string().min(1),
  copayerSignature: z.string().min(1)
});

export class WalletService {
  constructor(private storage: Storage) {}

  async createWallet(input: z.infer<typeof createWalletSchema>) {
    if (input.m > input.n) {
      throw Object.assign(new Error('m cannot be greater than n'), { code: 'BAD_REQUEST', statusCode: 400 });
    }
    const addressType: AddressType = input.n === 1 ? 'P2PKH' : 'P2SH';
    const wallet: WalletRecord = {
      id: newId(),
      name: input.name,
      coin: input.coin as Coin,
      network: input.network as Network,
      m: input.m,
      n: input.n,
      status: 'pending',
      pubKey: input.pubKey,
      derivationStrategy: input.n > 1 ? 'BIP48' : 'BIP44',
      addressType,
      createdAt: new Date()
    };
    await this.storage.createWallet(wallet);
    return wallet;
  }

  async joinWallet(input: z.infer<typeof joinWalletSchema>) {
    const wallet = await this.storage.getWallet(input.walletId);
    if (!wallet) throw Errors.WALLET_NOT_FOUND;
    if (wallet.status === 'complete') throw Errors.WALLET_ALREADY_COMPLETED;

    const copayers = await this.storage.getCopayers(wallet.id);
    if (copayers.some(c => c.xPubKey === input.xPubKey)) {
      throw Errors.COPAYER_REGISTERED;
    }
    if (copayers.length >= wallet.n) throw Errors.WALLET_ALREADY_COMPLETED;

    const hash = getCopayerHash(input.name, input.xPubKey, input.requestPubKey);
    if (!verifyMessage(hash, input.copayerSignature, wallet.pubKey)) {
      throw Errors.INVALID_SIGNATURE;
    }

    const copayer = {
      id: copayerId(wallet.coin, input.xPubKey),
      walletId: wallet.id,
      name: input.name,
      xPubKey: input.xPubKey,
      requestPubKey: input.requestPubKey,
      signature: input.copayerSignature,
      copayerIndex: copayers.length,
      createdAt: new Date()
    };
    await this.storage.addCopayer(copayer);

    const nextCopayers = [...copayers, copayer];
    let status: WalletRecord['status'] = 'pending';
    if (nextCopayers.length === wallet.n) {
      status = 'complete';
      await this.storage.updateWallet(wallet.id, { status });
    }

    return { copayerId: copayer.id, wallet: { ...wallet, status }, copayers: nextCopayers };
  }

  async getWallet(walletId: string) {
    const wallet = await this.storage.getWallet(walletId);
    if (!wallet) throw Errors.WALLET_NOT_FOUND;
    const copayers = await this.storage.getCopayers(walletId);
    return { ...wallet, copayers };
  }

  async createAddress(walletId: string, isChange = false) {
    const wallet = await this.storage.getWallet(walletId);
    if (!wallet) throw Errors.WALLET_NOT_FOUND;
    if (wallet.status !== 'complete') throw Errors.WALLET_NOT_COMPLETE;

    const copayers = await this.storage.getCopayers(walletId);
    const existing = await this.storage.getAddresses(walletId);
    const sameBranch = existing.filter(a => a.isChange === isChange);
    const addressIndex = sameBranch.length === 0 ? 0 : Math.max(...sameBranch.map(a => a.addressIndex)) + 1;
    const path = addressPath(isChange, addressIndex);
    const derived = deriveAddress({
      coin: wallet.coin,
      network: wallet.network,
      m: wallet.m,
      scriptType: wallet.addressType,
      publicKeyRing: copayers.map(c => ({ xPubKey: c.xPubKey })),
      path
    });

    const already = await this.storage.getAddressByPath(walletId, path);
    if (already) return already;

    return this.storage.addAddress({
      id: newId(),
      walletId,
      address: derived.address,
      path,
      isChange,
      addressIndex,
      publicKeys: derived.publicKeys,
      createdAt: new Date()
    });
  }

  async listAddresses(walletId: string) {
    return this.storage.getAddresses(walletId);
  }
}
