import { BitcoreLibXpi } from '@bcpros/crypto-wallet-core';
import { ChronikClient } from 'legacy-chronik-client';
import _ from 'lodash';
import { IChain } from '..';
import config from '../../../config'
import { BtcChain } from '../btc';
import { Utils } from '../../common/utils';
import { Errors } from '../../errors/errordefinitions';
const chronikClient = new ChronikClient(config.chronik.xpiUrl.split(','));

export class XpiChain extends BtcChain implements IChain {
  constructor() {
    super(BitcoreLibXpi);
    this.sizeEstimationMargin = config.bch?.sizeEstimationMargin ?? 0.01;
    this.inputSizeEstimationMargin = config.bch?.inputSizeEstimationMargin ?? 2;
  }
  getSizeSafetyMargin(opts: any): number {
    return 0;
  }

  convertFeePerKb(p, feePerKb) {
    return [p, Utils.strip(feePerKb * 1e6)];
  }

  getInputSizeSafetyMargin(opts: any): number {
    return 0;
  }

  getLegacyChronikClient() {
    return chronikClient;
  }

  validateAddress(wallet, inaddr, opts) {
    const A = BitcoreLibXpi.Address;
    let addr: {
      network?: BitcoreLibXpi.Networks.Network;
      toString?: () => string;
    } = {};
    try {
      addr = new A(inaddr);
    } catch (ex) {
      throw Errors.INVALID_ADDRESS;
    }
    if (addr.network.toString() != wallet.network) {
      throw Errors.INCORRECT_ADDRESS_NETWORK;
    }
    return;
  }
}
