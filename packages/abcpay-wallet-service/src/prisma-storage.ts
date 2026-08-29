import { PrismaClient } from '@prisma/client';
import {
  AddressRecord,
  CopayerRecord,
  Storage,
  TxActionRecord,
  TxProposalRecord,
  WalletRecord
} from './storage';
import { AddressType, Coin, Network } from './crypto';

function asWallet(row: any): WalletRecord {
  return {
    ...row,
    coin: row.coin as Coin,
    network: row.network as Network,
    addressType: row.addressType as AddressType,
    status: row.status as WalletRecord['status']
  };
}

export class PrismaStorage implements Storage {
  constructor(private prisma: PrismaClient) {}

  async createWallet(wallet: WalletRecord) {
    const row = await this.prisma.wallet.create({ data: wallet });
    return asWallet(row);
  }

  async getWallet(id: string) {
    const row = await this.prisma.wallet.findUnique({ where: { id } });
    return row ? asWallet(row) : null;
  }

  async updateWallet(id: string, patch: Partial<WalletRecord>) {
    const row = await this.prisma.wallet.update({ where: { id }, data: patch });
    return asWallet(row);
  }

  async addCopayer(copayer: CopayerRecord) {
    return this.prisma.copayer.create({ data: copayer }) as Promise<CopayerRecord>;
  }

  async getCopayers(walletId: string) {
    return this.prisma.copayer.findMany({
      where: { walletId },
      orderBy: { copayerIndex: 'asc' }
    }) as Promise<CopayerRecord[]>;
  }

  async getCopayerById(id: string) {
    const row = await this.prisma.copayer.findUnique({
      where: { id },
      include: { wallet: true }
    });
    if (!row) return null;
    return { ...row, wallet: asWallet(row.wallet) };
  }

  async addAddress(address: AddressRecord) {
    return this.prisma.address.create({ data: address }) as Promise<AddressRecord>;
  }

  async getAddresses(walletId: string) {
    return this.prisma.address.findMany({
      where: { walletId },
      orderBy: [{ isChange: 'asc' }, { addressIndex: 'asc' }]
    }) as Promise<AddressRecord[]>;
  }

  async getAddressByPath(walletId: string, path: string) {
    return this.prisma.address.findUnique({
      where: { walletId_path: { walletId, path } }
    }) as Promise<AddressRecord | null>;
  }

  async createProposal(proposal: TxProposalRecord) {
    return this.prisma.txProposal.create({
      data: {
        ...proposal,
        inputs: proposal.inputs as object,
        outputs: proposal.outputs as object
      }
    }) as Promise<TxProposalRecord>;
  }

  async getProposal(id: string) {
    return this.prisma.txProposal.findUnique({ where: { id } }) as Promise<TxProposalRecord | null>;
  }

  async getProposals(walletId: string, status?: string) {
    return this.prisma.txProposal.findMany({
      where: { walletId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' }
    }) as Promise<TxProposalRecord[]>;
  }

  async updateProposal(id: string, patch: Partial<TxProposalRecord>) {
    return this.prisma.txProposal.update({
      where: { id },
      data: patch as any
    }) as Promise<TxProposalRecord>;
  }

  async deleteProposal(id: string) {
    await this.prisma.txProposal.delete({ where: { id } });
  }

  async addAction(action: TxActionRecord) {
    return this.prisma.txAction.create({ data: action }) as Promise<TxActionRecord>;
  }

  async getActions(proposalId: string) {
    return this.prisma.txAction.findMany({ where: { proposalId } }) as Promise<TxActionRecord[]>;
  }

  async upsertNote(note: { walletId: string; txid: string; copayerId: string; body: string }) {
    await this.prisma.txNote.upsert({
      where: {
        walletId_txid_copayerId: {
          walletId: note.walletId,
          txid: note.txid,
          copayerId: note.copayerId
        }
      },
      update: { body: note.body },
      create: note
    });
  }

  async getNote(walletId: string, txid: string, copayerId: string) {
    const row = await this.prisma.txNote.findUnique({
      where: { walletId_txid_copayerId: { walletId, txid, copayerId } }
    });
    return row?.body || null;
  }
}
