import BitcoreP2P from '@bcpros/bitcore-p2p';
import BitcoreP2PCash from '@bcpros/bitcore-p2p-cash';
import { BitcoreLib, BitcoreLibCash } from '@bcpros/crypto-wallet-core';

export default {
  BTC: {
    lib: BitcoreLib,
    p2p: BitcoreP2P
  },
  BCH: {
    lib: BitcoreLibCash,
    p2p: BitcoreP2PCash
  },
  XEC: {
    lib: require('@bcpros/bitcore-lib-xec'),
    p2p: require('@bcpros/bitcore-p2p-xec')
  },
  XPI: {
    lib: require('@bcpros/bitcore-lib-xpi'),
    p2p: require('@bcpros/bitcore-p2p-xpi')
  }
};
