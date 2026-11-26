/* eslint-disable @typescript-eslint/no-require-imports */
class LibProvider {
  libs = {
    BTC: {
      lib: require('@bcpros/crypto-wallet-core').BitcoreLib,
      p2p: require('@bcpros/bitcore-p2p')
    },
    BCH: {
      lib: require('@bcpros/bitcore-lib-cash'),
      p2p: require('@bcpros/bitcore-p2p-cash')
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

  register(chain: string, lib: string, p2p: string) {
    this.libs[chain] = { lib: require(lib), p2p: require(p2p) };
  }

  get(chain) {
    return this.libs[chain];
  }
}

export const Libs = new LibProvider();
