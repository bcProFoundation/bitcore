import { ChronikClient, ConnectionStrategy } from 'chronik-client';
import { config } from './config';
import { Coin, UtxoInput } from './crypto';

export interface ChronikUtxo {
  txid: string;
  outIdx: number;
  sats: bigint | number | string;
  blockHeight?: number;
}

export interface ChronikTx {
  txid: string;
  timeFirstSeen?: number;
  block?: { timestamp?: number; height?: number };
  inputs: Array<{
    outputScript?: string;
    prevOut?: { txid: string; outIdx: number };
    sats?: bigint | number | string;
  }>;
  outputs: Array<{
    outputScript?: string;
    sats?: bigint | number | string;
  }>;
}

export interface ChainIndex {
  getUtxos(coin: Coin, address: string): Promise<ChronikUtxo[]>;
  getHistory(coin: Coin, address: string, page?: number, pageSize?: number): Promise<ChronikTx[]>;
  broadcast(coin: Coin, hex: string): Promise<string>;
}

export class ChronikIndex implements ChainIndex {
  private clients = new Map<Coin, Promise<ChronikClient>>();

  private getClient(coin: Coin): Promise<ChronikClient> {
    let client = this.clients.get(coin);
    if (!client) {
      client = ChronikClient.useStrategy(ConnectionStrategy.ClosestFirst, config.chronik[coin]);
      this.clients.set(coin, client);
    }
    return client;
  }

  async getUtxos(coin: Coin, address: string): Promise<ChronikUtxo[]> {
    const client = await this.getClient(coin);
    const result = await client.address(address).utxos();
    const utxos = Array.isArray(result) ? result.flatMap((entry: any) => entry.utxos || [entry]) : result.utxos || [];
    return utxos.map((utxo: any) => ({
      txid: utxo.outpoint?.txid || utxo.txid,
      outIdx: utxo.outpoint?.outIdx ?? utxo.outIdx,
      sats: utxo.sats ?? utxo.value,
      blockHeight: utxo.blockHeight
    }));
  }

  async getHistory(coin: Coin, address: string, page = 0, pageSize = 50): Promise<ChronikTx[]> {
    const client = await this.getClient(coin);
    const result = await client.address(address).history(page, pageSize);
    return (result.txs || result) as ChronikTx[];
  }

  async broadcast(coin: Coin, hex: string): Promise<string> {
    const client = await this.getClient(coin);
    const result = await client.broadcastTx(hex);
    return typeof result === 'string' ? result : result.txid;
  }
}

export class MockChainIndex implements ChainIndex {
  utxos = new Map<string, ChronikUtxo[]>();
  history = new Map<string, ChronikTx[]>();
  broadcasts: string[] = [];

  key(coin: Coin, address: string) {
    return `${coin}:${address}`;
  }

  async getUtxos(coin: Coin, address: string) {
    return this.utxos.get(this.key(coin, address)) || [];
  }

  async getHistory(coin: Coin, address: string) {
    return this.history.get(this.key(coin, address)) || [];
  }

  async broadcast(_coin: Coin, hex: string) {
    this.broadcasts.push(hex);
    const { createHash } = await import('crypto');
    return createHash('sha256').update(Buffer.from(hex, 'hex')).digest('hex');
  }

  setUtxos(coin: Coin, address: string, utxos: ChronikUtxo[]) {
    this.utxos.set(this.key(coin, address), utxos);
  }
}

export function toUtxoInputs(
  chainUtxos: ChronikUtxo[],
  address: string,
  path: string,
  publicKeys: string[],
  redeemScript?: string
): UtxoInput[] {
  return chainUtxos.map(utxo => ({
    txid: utxo.txid,
    vout: utxo.outIdx,
    satoshis: Number(utxo.sats),
    address,
    path,
    redeemScript,
    publicKeys,
    confirmations: utxo.blockHeight && utxo.blockHeight > 0 ? 1 : 0
  }));
}
