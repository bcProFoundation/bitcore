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
  XEC: new XECTxProvider(),
  XPI: new XPITxProvider(),
  LTC: new LTCTxProvider()
};

export class TransactionsProxy {
  get({ chain }) {
    return providers[chain];
  }

  create(params) {
    return this.get(params).create(params);
  }

  sign(params): string {
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
}

export default new TransactionsProxy();
