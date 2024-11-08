export interface BitcoinAddress {
  toString: (stripCash: boolean) => string;
}
export interface BitcoinScript {
  toBuffer: () => Buffer;
  toHex: () => string;
  classify: () => string;
  chunks: Array<{ buf: Buffer }>;
  toAddress: (network: string) => BitcoinAddress;
}
export interface BitcoinInputObj {
  prevTxId: string;
  outputIndex: number;
  sequenceNumber: number;
  script?: string;
}
export interface BitcoinInput {
  toObject: () => BitcoinInputObj;
}
export interface BitcoinOutput {
  script: BitcoinScript;
  satoshis: number;
}
export interface BitcoinTransactionType {
  outputAmount: number;
  txid?: string;
  _txid?: undefined | string;
  hash: string;
  _hash: undefined | string;
  isCoinbase: () => boolean;
  outputs: BitcoinOutput[];
  inputs: BitcoinInput[];
  toBuffer: () => Buffer;
  nLockTime: number;
}
