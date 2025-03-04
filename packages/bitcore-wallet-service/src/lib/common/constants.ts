'use strict';
import * as CWC from '@bcpros/crypto-wallet-core';

export const Constants = {
  CHAINS: {
    BTC: 'btc',
    BCH: 'bch',
    XEC: 'xec',
    ETH: 'eth',
    MATIC: 'matic',
    ARB: 'arb',
    BASE: 'base',
    OP: 'op',
    XRP: 'xrp',
    DOGE: 'doge',
    LTC: 'ltc',
    XPI: 'xpi'
  },

  CHAINS_RATES: ['btc', 'bch', 'xec', 'eth', 'xrp', 'doge', 'ltc', 'xpi'],

  BITPAY_SUPPORTED_COINS: {
    // used for rates
    BTC: 'btc',
    BCH: 'bch',
    ETH: 'eth',
    MATIC: 'matic',
    XRP: 'xrp',
    DOGE: 'doge',
    LTC: 'ltc',
    SHIB: 'shib',
    APE: 'ape',
    USDC: 'usdc',
    PYUSD: 'pyusd',
    USDP: 'usdp',
    PAX: 'pax',
    GUSD: 'gusd',
    BUSD: 'busd',
    DAI: 'dai',
    WBTC: 'wbtc',
    EUROC: 'euroc',
    USDT: 'usdt',
    WETH: 'weth'
  },

  BITPAY_SUPPORTED_ETH_ERC20: {
    // there is no need to add new entries here ( only for backwards compatibility )
    MATIC: 'matic',
    USDC: 'usdc',
    PYUSD: 'pyusd',
    USDP: 'usdp',
    PAX: 'pax', // backwards compatability
    GUSD: 'gusd',
    BUSD: 'busd',
    DAI: 'dai',
    WBTC: 'wbtc',
    SHIB: 'shib',
    APE: 'ape',
    EUROC: 'euroc',
    USDT: 'usdt'
  },

  BITPAY_USD_STABLECOINS: {
    // used for rates
    USDC: 'usdc',
    PYUSD: 'pyusd',
    USDP: 'usdp',
    PAX: 'pax',
    GUSD: 'gusd',
    BUSD: 'busd',
    DAI: 'dai',
    USDT: 'usdt'
  },

  BITPAY_EUR_STABLECOINS: {
    // used for rates
    EUROC: 'euroc'
  },

  UTXO_CHAINS: {
    BTC: 'btc',
    BCH: 'bch',
    XEC: 'xec',
    DOGE: 'doge',
    XPI: 'xpi',
    LTC: 'ltc'
  },

  EVM_CHAINS: {
    ETH: 'eth',
    MATIC: 'matic',
    ARB: 'arb',
    BASE: 'base',
    OP: 'op',
  },

  EVM_CHAINSUFFIXMAP: {
    eth: 'e',
    matic: 'm',
    arb: 'arb',
    base: 'base',
    op: 'op',
  },

  EVM_CHAINS_WITH_ETH_GAS: {
    ETH: 'eth',
    ARB: 'arb',
    BASE: 'base',
    OP: 'op',
  },

  NETWORKS: {
    btc: ['livenet', 'testnet3', 'testnet4', 'signet', 'regtest'],
    bch: ['livenet', 'testnet3', 'testnet4', 'scalenet', 'chipnet', 'regtest'],
    xec: ['livenet', 'testnet3', 'regtest'],
    xpi: ['livenet', 'testnet3', 'regtest'],
    eth: ['livenet', 'sepolia', 'holesky', 'regtest'],
    matic: ['livenet', 'amoy', 'regtest'],
    ltc: ['livenet', 'testnet4', 'regtest'],
    doge: ['livenet', 'testnet3', 'regtest'],
    xrp: ['livenet', 'testnet', 'regtest'],
    arb: ['livenet', 'sepolia', 'holesky', 'regtest'],
    base: ['livenet', 'sepolia', 'holesky', 'regtest'],
    op: ['livenet', 'sepolia', 'holesky', 'regtest'],
  } as { [chain: string]: Array<string> },

  // These aliases are here to support legacy clients so don't change them lightly
  NETWORK_ALIASES: {
    btc: {
      mainnet: 'livenet',
      testnet: 'testnet4'
    },
    bch: {
      mainnet: 'livenet',
      testnet: 'testnet3'
    },
    xec: {
      mainnet: 'livenet',
      testnet: 'testnet3'
    },
    xpi: {
      mainnet: 'livenet',
      testnet: 'testnet3'
    },
    ltc: {
      mainnet: 'livenet',
      testnet: 'testnet4'
    },
    doge: {
      mainnet: 'livenet',
      testnet: 'testnet3'
    },
    xrp: {
      mainnet: 'livenet',
    },
    eth: {
      mainnet: 'livenet',
      testnet: 'sepolia'
    },
    matic: {
      mainnet: 'livenet',
      testnet: 'amoy'
    },
    arb: {
      mainnet: 'livenet',
      testnet: 'sepolia'
    },
    base: {
      mainnet: 'livenet',
      testnet: 'sepolia'
    },
    op: {
      mainnet: 'livenet',
      testnet: 'sepolia'
    }
  },

  ADDRESS_FORMATS: ['copay', 'cashaddr', 'legacy'],

  SCRIPT_TYPES: {
    P2SH: 'P2SH',
    P2WSH: 'P2WSH',
    P2PKH: 'P2PKH',
    P2WPKH: 'P2WPKH',
    P2TR: 'P2TR'
  },

  NATIVE_SEGWIT_CHAINS: {
    BTC: 'btc',
    LTC: 'ltc'
  },

  TAPROOT_CHAINS: {
    BTC: 'btc'
  },

  DERIVATION_STRATEGIES: {
    BIP44: 'BIP44',
    BIP45: 'BIP45'
  },

  PATHS: {
    SINGLE_ADDRESS: "m/0'/0",
    REQUEST_KEY: "m/1'/0",
    TXPROPOSAL_KEY: "m/1'/1",
    REQUEST_KEY_AUTH: 'm/2' // relative to BASE
  },

  BIP45_SHARED_INDEX: 0x80000000 - 1,

  ETH_TOKEN_OPTS: CWC.Constants.ETH_TOKEN_OPTS,
  MATIC_TOKEN_OPTS: CWC.Constants.MATIC_TOKEN_OPTS,
  ARB_TOKEN_OPTS: CWC.Constants.ARB_TOKEN_OPTS,
  OP_TOKEN_OPTS: CWC.Constants.OP_TOKEN_OPTS,
  BASE_TOKEN_OPTS: CWC.Constants.BASE_TOKEN_OPTS,
  UNITS: CWC.Constants.UNITS,

  BITPAY_CONTRACTS: {
    MULTISEND: 'MULTISEND'
  },

  opReturn: {
    opReturnPrefixHex: '6a',
    opReturnAppPrefixLengthHex: '04',
    opPushDataOne: '4c',
    appPrefixesHex: {
      eToken: '534c5000',
      lotusChat: '02020202',
      lotusChatEncrypted: '03030303'
    },
    encryptedMsgByteLimit: 206,
    unencryptedMsgByteLimit: 215
  },

  // Number of confirmations from which tx in history will be cached
  // There is a default value in defaults.ts that applies to UTXOs
  CONFIRMATIONS_TO_START_CACHING: {
    eth: 100,
    matic: 150
  },

  MESSAGE_PREFIX: {
    XEC: '\x16eCash Signed Message:\n',
    XPI: '\x16Lotus Signed Message:\n'
  },
  // Individual chain settings for block throttling
  CHAIN_NEW_BLOCK_THROTTLE_TIME_SECONDS: {
    btc: { testnet: 300, livenet: 0 },
    bch: { testnet: 300, livenet: 0 },
    eth: { testnet: 300, livenet: 0 },
    matic: { testnet: 300, livenet: 12 }, // MATIC set to 12 because blocks normally occur every 1-2 seconds
    xrp: { testnet: 300, livenet: 0 },
    doge: { testnet: 300, livenet: 0 },
    ltc: { testnet: 300, livenet: 0 }
  } as { [chain: string]: { [network: string]: number } }
};
