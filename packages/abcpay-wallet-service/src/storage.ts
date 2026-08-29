import { Coin, Network, AddressType } from './crypto';

export interface WalletRecord {
  id: string;
  name: string;
  coin: Coin;
  network: Network;
  m: number;
  n: number;
  status: 'pending' | 'complete';
  pubKey: string;
  derivationStrategy: string;
  addressType: AddressType;
  createdAt: Date;
}

export interface CopayerRecord {
  id: string;
  walletId: string;
  name: string;
  xPubKey: string;
  requestPubKey: string;
  signature: string;
  copayerIndex: number;
  createdAt: Date;
}

export interface AddressRecord {
  id: string;
  walletId: string;
  address: string;
  path: string;
  isChange: boolean;
  addressIndex: number;
  publicKeys: string[];
  createdAt: Date;
}

export interface TxProposalRecord {
  id: string;
  walletId: string;
  creatorId: string;
  toAddress: string;
  amount: string;
  fee: string;
  feePerKb: number;
  changeAddress?: string | null;
  message?: string | null;
  status: 'temporary' | 'pending' | 'accepted' | 'rejected' | 'broadcasted';
  raw?: string | null;
  txid?: string | null;
  inputs: unknown;
  outputs: unknown;
  excludeUnconfirmed: boolean;
  createdAt: Date;
}

export interface TxActionRecord {
  id: string;
  proposalId: string;
  copayerId: string;
  type: 'sign' | 'reject';
  signatures: string[];
  createdAt: Date;
}

export interface Storage {
  createWallet(wallet: WalletRecord): Promise<WalletRecord>;
  getWallet(id: string): Promise<WalletRecord | null>;
  updateWallet(id: string, patch: Partial<WalletRecord>): Promise<WalletRecord>;
  addCopayer(copayer: CopayerRecord): Promise<CopayerRecord>;
  getCopayers(walletId: string): Promise<CopayerRecord[]>;
  getCopayerById(id: string): Promise<(CopayerRecord & { wallet: WalletRecord }) | null>;
  addAddress(address: AddressRecord): Promise<AddressRecord>;
  getAddresses(walletId: string): Promise<AddressRecord[]>;
  getAddressByPath(walletId: string, path: string): Promise<AddressRecord | null>;
  createProposal(proposal: TxProposalRecord): Promise<TxProposalRecord>;
  getProposal(id: string): Promise<TxProposalRecord | null>;
  getProposals(walletId: string, status?: string): Promise<TxProposalRecord[]>;
  updateProposal(id: string, patch: Partial<TxProposalRecord>): Promise<TxProposalRecord>;
  deleteProposal(id: string): Promise<void>;
  addAction(action: TxActionRecord): Promise<TxActionRecord>;
  getActions(proposalId: string): Promise<TxActionRecord[]>;
  upsertNote(note: { walletId: string; txid: string; copayerId: string; body: string }): Promise<void>;
  getNote(walletId: string, txid: string, copayerId: string): Promise<string | null>;
}

export class MemoryStorage implements Storage {
  wallets = new Map<string, WalletRecord>();
  copayers = new Map<string, CopayerRecord>();
  addresses = new Map<string, AddressRecord>();
  proposals = new Map<string, TxProposalRecord>();
  actions = new Map<string, TxActionRecord>();
  notes = new Map<string, string>();

  async createWallet(wallet: WalletRecord) {
    this.wallets.set(wallet.id, wallet);
    return wallet;
  }

  async getWallet(id: string) {
    return this.wallets.get(id) || null;
  }

  async updateWallet(id: string, patch: Partial<WalletRecord>) {
    const current = this.wallets.get(id);
    if (!current) throw new Error('Wallet not found');
    const next = { ...current, ...patch, id };
    this.wallets.set(id, next);
    return next;
  }

  async addCopayer(copayer: CopayerRecord) {
    this.copayers.set(copayer.id, copayer);
    return copayer;
  }

  async getCopayers(walletId: string) {
    return [...this.copayers.values()]
      .filter(c => c.walletId === walletId)
      .sort((a, b) => a.copayerIndex - b.copayerIndex);
  }

  async getCopayerById(id: string) {
    const copayer = this.copayers.get(id);
    if (!copayer) return null;
    const wallet = this.wallets.get(copayer.walletId);
    if (!wallet) return null;
    return { ...copayer, wallet };
  }

  async addAddress(address: AddressRecord) {
    this.addresses.set(address.id, address);
    return address;
  }

  async getAddresses(walletId: string) {
    return [...this.addresses.values()]
      .filter(a => a.walletId === walletId)
      .sort((a, b) => a.addressIndex - b.addressIndex || Number(a.isChange) - Number(b.isChange));
  }

  async getAddressByPath(walletId: string, path: string) {
    return [...this.addresses.values()].find(a => a.walletId === walletId && a.path === path) || null;
  }

  async createProposal(proposal: TxProposalRecord) {
    this.proposals.set(proposal.id, proposal);
    return proposal;
  }

  async getProposal(id: string) {
    return this.proposals.get(id) || null;
  }

  async getProposals(walletId: string, status?: string) {
    return [...this.proposals.values()].filter(p => p.walletId === walletId && (!status || p.status === status));
  }

  async updateProposal(id: string, patch: Partial<TxProposalRecord>) {
    const current = this.proposals.get(id);
    if (!current) throw new Error('Proposal not found');
    const next = { ...current, ...patch, id };
    this.proposals.set(id, next);
    return next;
  }

  async deleteProposal(id: string) {
    this.proposals.delete(id);
  }

  async addAction(action: TxActionRecord) {
    this.actions.set(action.id, action);
    return action;
  }

  async getActions(proposalId: string) {
    return [...this.actions.values()].filter(a => a.proposalId === proposalId);
  }

  async upsertNote(note: { walletId: string; txid: string; copayerId: string; body: string }) {
    this.notes.set(`${note.walletId}:${note.txid}:${note.copayerId}`, note.body);
  }

  async getNote(walletId: string, txid: string, copayerId: string) {
    return this.notes.get(`${walletId}:${txid}:${copayerId}`) || null;
  }
}
