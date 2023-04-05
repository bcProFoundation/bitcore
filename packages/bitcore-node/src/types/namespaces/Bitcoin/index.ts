import { BitcoinBlockType, BlockHeader, BlockHeaderObj } from './Block';
import {
  BitcoinAddress,
  BitcoinInput,
  BitcoinInputObj,
  BitcoinOutput,
  BitcoinScript,
  BitcoinTransactionType
} from './Transaction';

export type BitcoinBlockType2 = BitcoinBlockType;
export type BitcoinTransaction = BitcoinTransactionType;
export type BitcoinScript2 = BitcoinScript;
export type BitcoinAddress2 = BitcoinAddress;

export type TransactionOutput = BitcoinOutput;
export type TransactionInput = BitcoinInput;
export type TransactionInputObj = BitcoinInputObj;

export type BitcoinHeader = BlockHeader;
export type BitcoinHeaderObj = BlockHeaderObj;
