import _ from 'lodash';
import { Common } from '../common';
const Defaults = Common.Defaults;

module.exports = {
  name: 'Coingecko',
  url: 'https://api.coingecko.com/api/v3/simple/price',
  params: {
    ids: '',
    vs_currencies: Defaults.FIAT_CURRENCY.code
  },
  coinMapping: {
    btc: 'bitcoin',
    bch: 'binance-peg-bitcoin-cash',
    xec: 'ecash',
    eth: 'ethereum',
    xrp: 'ripple',
    doge: 'binance-peg-dogecoin',
    ltc: 'litecoin'
  },
  parseFn(raw) {
    const valueObject = Object.values(raw)[0];
    const rates = _.compact(
      Object.keys(valueObject).map(key => {
        if (!valueObject[key]) return null;
        return {
          code: key.toUpperCase(),
          value: +valueObject[key]
        };
      })
    );
    return rates;
  }
};
