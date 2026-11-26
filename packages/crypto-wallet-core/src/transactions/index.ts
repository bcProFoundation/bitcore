import { BCHTxProvider } from './bch';
import { BTCTxProvider } from './btc';
import { DOGETxProvider } from './doge';
import { LTCTxProvider } from './ltc';
import { XECTxProvider } from './xec';
import { XPITxProvider } from './xpi';

const providers = {
  BTC: new BTCTxProvider(),
  BCH: new BCHTxProvider(),
  DOGE: new DOGETxProvider(),
  LTC: new LTCTxProvider(),
  XEC: new XECTxProvider(),
  XPI: new XPITxProvider(),
};

export class TransactionsProxy {
  get({ chain }) {
    const normalizedChain = chain.toUpperCase();
    return providers[normalizedChain];
  }

  create(params) {
    return this.get(params).create(params);
  }

  // SOL's sign() is async, all others are synchronous
  sign(params): string | Promise<string> {
    return this.get(params).sign(params);
  }

  getSignature(params): string {
    return this.get(params).getSignature(params);
  }

  applySignature(params) {
    return this.get(params).applySignature(params);
  }

  getHash(params) {
    return this.get(params).getHash(params);
  }

  transformSignatureObject(params) {
    return this.get(params).transformSignatureObject(params);
  }

  getSighash(params): string {
    return this.get(params).getSighash(params);
  }
}

export default new TransactionsProxy();
