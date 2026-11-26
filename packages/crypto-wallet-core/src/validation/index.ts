import { BchValidation } from './bch';
import { BtcValidation } from './btc';
import { DogeValidation } from './doge';
import { LtcValidation } from './ltc';
import { XecValidation } from './xec';
import { XpiValidation } from './xpi';
import type { IValidation } from '../types/validation';

const validation: { [chain: string]: IValidation } = {
  BTC: new BtcValidation(),
  BCH: new BchValidation(),
  DOGE: new DogeValidation(),
  LTC: new LtcValidation(),
  XEC: new XecValidation(),
  XPI: new XpiValidation(),
};

export class ValidationProxy {
  get(chain) {
    const normalizedChain = chain.toUpperCase();
    return validation[normalizedChain];
  }

  validateAddress(chain, network, address) {
    // chains this fork does not serve have no validator: treat their addresses as invalid
    const validator = this.get(chain);
    return validator ? validator.validateAddress(network, address) : false;
  }

  validateUri(chain, addressUri) {
    const validator = this.get(chain);
    return validator ? validator.validateUri(addressUri) : false;
  }
}

export default new ValidationProxy();
