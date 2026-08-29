import { z } from 'zod';
import { ChainIndex, toUtxoInputs } from './chronik';
import {
  COINS,
  assembleSignedHex,
  buildRedeemScript,
  buildTransaction,
  estimateTxSize,
  newId,
  selectUtxos,
  txidFromRaw,
  validateAddress,
  UtxoInput
} from './crypto';
import { Errors } from './errors';
import { Storage } from './storage';
import { WalletService } from './wallet-service';

export const createProposalSchema = z.object({
  toAddress: z.string().min(1),
  amount: z.number().int().positive(),
  message: z.string().max(500).optional(),
  feePerKb: z.number().int().positive().optional(),
  excludeUnconfirmedUtxos: z.boolean().optional()
});

export class TxService {
  constructor(
    private storage: Storage,
    private chain: ChainIndex,
    private wallets: WalletService
  ) {}

  async getUtxos(walletId: string, excludeUnconfirmed = false): Promise<UtxoInput[]> {
    const wallet = await this.storage.getWallet(walletId);
    if (!wallet) throw Errors.WALLET_NOT_FOUND;
    const addresses = await this.storage.getAddresses(walletId);
    const locked = await this.lockedOutpoints(walletId);

    const all: UtxoInput[] = [];
    for (const addr of addresses) {
      const chainUtxos = await this.chain.getUtxos(wallet.coin, addr.address);
      const redeemScript =
        wallet.n > 1 ? buildRedeemScript(addr.publicKeys, wallet.m, wallet.coin) : undefined;
      for (const utxo of toUtxoInputs(chainUtxos, addr.address, addr.path, addr.publicKeys, redeemScript)) {
        if (excludeUnconfirmed && !utxo.confirmations) continue;
        if (locked.has(`${utxo.txid}:${utxo.vout}`)) continue;
        all.push(utxo);
      }
    }
    return all;
  }

  async getBalance(walletId: string) {
    const utxos = await this.getUtxos(walletId);
    const pending = await this.storage.getProposals(walletId, 'pending');
    const lockedAmount = pending.reduce((sum, p) => sum + Number(p.amount) + Number(p.fee), 0);
    const total = utxos.reduce((sum, u) => sum + u.satoshis, 0);
    const confirmed = utxos.filter(u => (u.confirmations || 0) > 0).reduce((sum, u) => sum + u.satoshis, 0);
    return {
      totalAmount: total,
      lockedAmount,
      availableAmount: Math.max(0, total - lockedAmount),
      totalConfirmedAmount: confirmed,
      lockedConfirmedAmount: lockedAmount,
      availableConfirmedAmount: Math.max(0, confirmed - lockedAmount),
      byAddress: this.groupByAddress(utxos)
    };
  }

  async createProposal(walletId: string, creatorId: string, input: z.infer<typeof createProposalSchema>) {
    const wallet = await this.storage.getWallet(walletId);
    if (!wallet) throw Errors.WALLET_NOT_FOUND;
    if (wallet.status !== 'complete') throw Errors.WALLET_NOT_COMPLETE;
    if (!validateAddress(wallet.coin, wallet.network, input.toAddress)) throw Errors.BAD_ADDRESS;

    const feePerKb = input.feePerKb || COINS[wallet.coin].feePerKb;
    const utxos = await this.getUtxos(walletId, input.excludeUnconfirmedUtxos);
    const selected = selectUtxos(utxos, input.amount, feePerKb, wallet.m, wallet.n, COINS[wallet.coin].dust);

    let changeAddress: string | undefined;
    if (selected.change > 0) {
      const change = await this.wallets.createAddress(walletId, true);
      changeAddress = change.address;
    }

    const built = buildTransaction({
      coin: wallet.coin,
      network: wallet.network,
      inputs: selected.inputs,
      toAddress: input.toAddress,
      amount: input.amount,
      changeAddress,
      change: selected.change,
      fee: selected.fee,
      m: wallet.m
    });

    const proposal = await this.storage.createProposal({
      id: newId(),
      walletId,
      creatorId,
      toAddress: input.toAddress,
      amount: String(input.amount),
      fee: String(selected.fee),
      feePerKb,
      changeAddress,
      message: input.message,
      status: 'temporary',
      raw: built.hex,
      txid: null,
      inputs: selected.inputs,
      outputs: [
        { address: input.toAddress, amount: input.amount },
        ...(changeAddress && selected.change > 0 ? [{ address: changeAddress, amount: selected.change }] : [])
      ],
      excludeUnconfirmed: !!input.excludeUnconfirmedUtxos,
      createdAt: new Date()
    });

    return proposal;
  }

  async publishProposal(proposalId: string, copayerId: string) {
    const proposal = await this.storage.getProposal(proposalId);
    if (!proposal) throw Errors.TX_NOT_FOUND;
    if (proposal.creatorId !== copayerId) throw Errors.NOT_AUTHORIZED;
    if (proposal.status !== 'temporary') {
      throw Object.assign(new Error('Proposal already published'), { code: 'BAD_REQUEST', statusCode: 400 });
    }
    return this.storage.updateProposal(proposalId, { status: 'pending' });
  }

  async signProposal(proposalId: string, copayerId: string, signatures: string[]) {
    const proposal = await this.storage.getProposal(proposalId);
    if (!proposal) throw Errors.TX_NOT_FOUND;
    if (proposal.status !== 'pending' && proposal.status !== 'temporary') {
      throw Object.assign(new Error('Proposal cannot be signed'), { code: 'BAD_REQUEST', statusCode: 400 });
    }
    const copayer = await this.storage.getCopayerById(copayerId);
    if (!copayer || copayer.walletId !== proposal.walletId) throw Errors.NOT_AUTHORIZED;
    const inputs = (proposal.inputs as UtxoInput[]) || [];
    if (!signatures.length || signatures.length !== inputs.length) throw Errors.INVALID_SIGNATURE;

    const actions = await this.storage.getActions(proposalId);
    if (actions.some(a => a.copayerId === copayerId && a.type === 'sign')) {
      throw Errors.TX_ALREADY_SIGNED;
    }
    const wallet = copayer.wallet;
    const copayers = await this.storage.getCopayers(wallet.id);
    const pendingAction = { copayerId, signatures };
    const signActions = [...actions.filter(a => a.type === 'sign'), pendingAction];
    let assembled: string;
    try {
      assembled = assembleSignedHex({
        coin: wallet.coin,
        network: wallet.network,
        inputs,
        toAddress: proposal.toAddress,
        amount: Number(proposal.amount),
        changeAddress: proposal.changeAddress,
        change: this.changeAmount(proposal),
        fee: Number(proposal.fee),
        m: wallet.m,
        actions: signActions.map(a => ({
          xPubKey: copayers.find(c => c.id === a.copayerId)?.xPubKey || copayer.xPubKey,
          signatures: a.signatures
        }))
      });
    } catch {
      throw Errors.INVALID_SIGNATURE;
    }
    const action = await this.storage.addAction({
      id: newId(),
      proposalId,
      copayerId,
      type: 'sign',
      signatures,
      createdAt: new Date()
    });
    const status = signActions.length >= wallet.m ? 'accepted' : proposal.status === 'temporary' ? 'pending' : proposal.status;
    const updated = await this.storage.updateProposal(proposalId, { status, raw: assembled });
    return { ...updated, actions: [...actions, action] };
  }

  async rejectProposal(proposalId: string, copayerId: string) {
    const proposal = await this.storage.getProposal(proposalId);
    if (!proposal) throw Errors.TX_NOT_FOUND;
    const copayer = await this.storage.getCopayerById(copayerId);
    if (!copayer || copayer.walletId !== proposal.walletId) throw Errors.NOT_AUTHORIZED;
    await this.storage.addAction({
      id: newId(),
      proposalId,
      copayerId,
      type: 'reject',
      signatures: [],
      createdAt: new Date()
    });
    return this.storage.updateProposal(proposalId, { status: 'rejected' });
  }

  async deleteProposal(proposalId: string, copayerId: string) {
    const proposal = await this.storage.getProposal(proposalId);
    if (!proposal) throw Errors.TX_NOT_FOUND;
    if (proposal.creatorId !== copayerId) throw Errors.NOT_AUTHORIZED;
    const actions = await this.storage.getActions(proposalId);
    if (actions.some(a => a.type === 'sign' && a.copayerId !== copayerId)) {
      throw Object.assign(new Error('Cannot delete a signed proposal'), { code: 'BAD_REQUEST', statusCode: 400 });
    }
    await this.storage.deleteProposal(proposalId);
    return proposal;
  }

  async broadcastProposal(proposalId: string, copayerId: string, signedHex?: string) {
    const proposal = await this.storage.getProposal(proposalId);
    if (!proposal) throw Errors.TX_NOT_FOUND;
    const copayer = await this.storage.getCopayerById(copayerId);
    if (!copayer || copayer.walletId !== proposal.walletId) throw Errors.NOT_AUTHORIZED;
    const wallet = copayer.wallet;
    const actions = await this.storage.getActions(proposalId);
    const signCount = actions.filter(a => a.type === 'sign').length;
    if (signCount < wallet.m) throw Errors.TX_NOT_ENOUGH_SIGNATURES;

    const hex = signedHex || proposal.raw;
    if (!hex) throw Errors.TX_NOT_ENOUGH_SIGNATURES;
    const txid = await this.chain.broadcast(wallet.coin, hex);
    return this.storage.updateProposal(proposalId, {
      status: 'broadcasted',
      raw: hex,
      txid: txid || txidFromRaw(wallet.coin, hex)
    });
  }

  async listProposals(walletId: string) {
    const proposals = await this.storage.getProposals(walletId);
    const withActions = await Promise.all(
      proposals.map(async p => ({ ...p, actions: await this.storage.getActions(p.id) }))
    );
    return withActions;
  }

  async getHistory(walletId: string, page = 0, pageSize = 50) {
    const wallet = await this.storage.getWallet(walletId);
    if (!wallet) throw Errors.WALLET_NOT_FOUND;
    const addresses = await this.storage.getAddresses(walletId);
    const seen = new Set<string>();
    const items: any[] = [];

    for (const addr of addresses) {
      const txs = await this.chain.getHistory(wallet.coin, addr.address, page, pageSize);
      for (const tx of txs) {
        if (seen.has(tx.txid)) continue;
        seen.add(tx.txid);
        const received = (tx.outputs || []).reduce((sum, out) => sum + Number(out.sats || 0), 0);
        const sent = (tx.inputs || []).reduce((sum, inp) => sum + Number(inp.sats || 0), 0);
        const net = received - sent;
        items.push({
          txid: tx.txid,
          time: tx.block?.timestamp || tx.timeFirstSeen || 0,
          confirmations: tx.block?.height ? 1 : 0,
          amount: net,
          fee: Math.max(0, sent - received),
          action: net < 0 ? 'sent' : 'received',
          addressTo: addr.address
        });
      }
    }

    items.sort((a, b) => b.time - a.time);
    return items.slice(0, pageSize);
  }

  private async lockedOutpoints(walletId: string) {
    const pending = await this.storage.getProposals(walletId, 'pending');
    const temporary = await this.storage.getProposals(walletId, 'temporary');
    const accepted = await this.storage.getProposals(walletId, 'accepted');
    const locked = new Set<string>();
    for (const p of [...pending, ...temporary, ...accepted]) {
      const inputs = p.inputs as UtxoInput[];
      for (const input of inputs || []) {
        locked.add(`${input.txid}:${input.vout}`);
      }
    }
    return locked;
  }

  private changeAmount(proposal: { outputs: unknown; amount: string; fee: string }) {
    const outputs = (proposal.outputs as Array<{ amount: number }>) || [];
    if (outputs.length > 1) return Number(outputs[1].amount || 0);
    return 0;
  }

  private groupByAddress(utxos: UtxoInput[]) {
    const map = new Map<string, { address: string; path: string; amount: number }>();
    for (const utxo of utxos) {
      const current = map.get(utxo.address) || { address: utxo.address, path: utxo.path, amount: 0 };
      current.amount += utxo.satoshis;
      map.set(utxo.address, current);
    }
    return [...map.values()];
  }
}

export function estimateFeeForWallet(inputCount: number, outputCount: number, m: number, n: number, feePerKb: number) {
  const size = estimateTxSize(inputCount, outputCount, m, n);
  return Math.ceil((size * feePerKb) / 1000);
}
