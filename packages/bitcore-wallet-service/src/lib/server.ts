import util from 'util';
import {
  BitcoreLib as Bitcore,
  BitcoreLibCash as BitcoreCash,
  BitcoreLibDoge as BitcoreDoge,
  BitcoreLibLtc as BitcoreLtc,
  Validation
} from '@bcpros/crypto-wallet-core';
import * as async from 'async';
import * as crypto from 'crypto'
import EmailValidator from 'email-validator';
import * as _ from 'lodash';
import { singleton } from 'preconditions';
import _request from 'request';
import 'source-map-support/register';
import Uuid from 'uuid';
import { version } from '../../package.json';
import config from '../config';
import { serverMessages as deprecatedServerMessage } from '../deprecated-serverMessages';
import { BanxaService } from '../externalservices/banxa';
import { ChangellyService } from '../externalservices/changelly';
import { CoinGeckoService } from '../externalservices/coingecko';
import { MoonpayService } from '../externalservices/moonpay';
import { OneInchService } from '../externalservices/oneInch';
import { RampService } from '../externalservices/ramp';
import { SardineService } from '../externalservices/sardine';
import { SimplexService } from '../externalservices/simplex';
import { ThorswapService } from '../externalservices/thorswap';
import { TransakService } from '../externalservices/transak';
import { serverMessages } from '../serverMessages';
import { BCHAddressTranslator } from './bchaddresstranslator';
import { BlockChainExplorer } from './blockchainexplorer';
import { V8 } from './blockchainexplorers/v8';
import { ChainService } from './chain/index';
import { Common } from './common';
import { ClientError } from './errors/clienterror';
import { Errors } from './errors/errordefinitions';
import { FiatRateService } from './fiatrateservice';
import { Lock } from './lock';
import logger from './logger';
import { MessageBroker } from './messagebroker';
import {
  Advertisement,
  Copayer,
  INotification,
  ITxProposal,
  IWallet,
  Notification,
  Preferences,
  PushNotificationSub,
  Session,
  TxConfirmationSub,
  TxNote,
  TxProposal,
  Wallet
} from './model';
import { Storage } from './storage';
import type { ExternalServicesConfig } from '../types/externalservices';
import type { GetAddressesOpts, UpgradeCheckOpts } from '../types/server';

import cuid from 'cuid';
import * as forge from 'node-forge';

import {
  ChronikClient,
  ScriptUtxos,
  ScriptUtxo,
  Tx,
  TxInput,
  TxOutput,
} from 'chronik-client';
import { ChronikClient as LegacyChronikClient, Tx as LegacyTx, TxInput as LegacyTxInput, TxOutput as LegacyTxOutput } from 'legacy-chronik-client';
import moment from 'moment';
import { CurrencyRateService } from './currencyrate';
import { Appreciation } from './model/appreciation';
import { CoinConfig, ConfigSwap } from './model/config-swap';
import { ConversionOrder, IConversionOrder, Output, TxDetail } from './model/conversionOrder';
import { CoinDonationToAddress, DonationInfo, DonationStorage } from './model/donation';
import { LogDevice } from './model/log-devide';
import { MerchantInfo } from './model/merchantinfo';
import { IMerchantOrder, MerchantOrder, PaymentType } from './model/merchantorder';
import { Order } from './model/order';
import { OrderInfoNoti } from './model/OrderInfoNoti';
import { IQPayInfo } from './model/qpayinfo';
import { RaipayFee } from './model/raipayfee';
import { TokenInfo, TokenItem } from './model/tokenInfo';
import { PushNotificationsService } from './pushnotificationsservice';

const Client = require('@bcpros/bitcore-wallet-client').default;
const Key = Client.Key;
const commonBWC = require('@bcpros/bitcore-wallet-client/ts_build/src/lib/common');
import walletLotus from '../wallet-lotus-donation.json';
import merchantList from '../merchant-list.json';
import raipayFee from '../raipay-fee.json';
// const keyFund = require('../../../../key-store.json');
const { dirname } = require('path');
const appDir = dirname(require.main.filename);
// import * as swapConfigFile from './admin-config.json';
// var obj = JSON.parse(fs.readFileSync(swapConfig, 'utf8'));

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(config.emailMerchant.SENDGRID_API_KEY);
const csv = require('csvtojson');
// import os module
const os = require('os');
const { google } = require('googleapis');
const auth = new google.auth.GoogleAuth({
  credentials: config.googlesheetCredentials,
  scopes: 'https://www.googleapis.com/auth/spreadsheets'
});
let checkOrderInSwapQueueInterval = null;
let swapQueueInterval = null;
let conversionQueueInterval = null;
let merchantOrderQueueInterval = null;
let clientsFundConversion = null;
let bot = null;
let botNotification = null;
let botSwap = null;
let clientsFund = null;
let clientsReceive = null;
let keyFund = null;
let mnemonicKeyFund = null;
let mnemonicKeyFundConversion = null;
let isNotiSwapOutOfFundToTelegram = false;
let isNotiFundXecBelowMinimumToTelegram = false;
let isNotiFundTokenBelowMinimumToTelegram = false;
let isNotiFundXecInsufficientMinimumToTelegram = false;
let isNotiFundTokenInsufficientMinimumToTelegram = false;
let listRateWithPromise = null;
const GAP_RESTART_QUEUE = config.queueNoti.GAP_RESTART_QUEUE;
const NOTI_AFTER_MANY_RESTART = config.queueNoti.NOTI_AFTER_MANY_RESTART;
const MAXIMUM_NOTI = config.queueNoti.MAXIMUM_NOTI;
const minsOfNoti = 5;
let merchantQueueFailed = 0;
let merchantNotiCount = 0;

let conversionQueueFailed = 0;
let conversionNotiCount = 0;

let swapQueueFailed = 0;
let swapNotiCount = 0;

const bcrypt = require('bcrypt');
const saltRounds = 10;
let txIdHandled = [];
let ws = null;
type BwsLogger = typeof logger;

const $ = singleton();

const Bitcore_ = {
  btc: Bitcore,
  bch: BitcoreCash,
  xec: require('@bcpros/bitcore-lib-xec'),
  eth: Bitcore,
  matic: Bitcore,
  arb: Bitcore,
  base: Bitcore,
  op: Bitcore,
  arc: Bitcore,
  xrp: Bitcore,
  doge: BitcoreDoge,
  xpi: require('@bcpros/bitcore-lib-xpi'),
  ltc: BitcoreLtc,
  sol: Bitcore,
};

const {
  Utils,
  Constants,
  Defaults,
  Services,
} = Common;



// const BCHJS = require('@bcpros/xpi-js');
// const bchURL = config.supportToken.xec.bchUrl;
// const bchjs = new BCHJS({ restURL: bchURL });

const ecashaddr = require('ecashaddrjs');

let request = _request;
let initialized = false;
let doNotCheckV8 = false;

let lock: Lock;
let storage: Storage;
let blockchainExplorer: V8;
let blockchainExplorerOpts;
let messageBroker: MessageBroker;
let pushNotifications;
let fiatRateService: FiatRateService;
let currencyRateService: any;
let serviceVersion: string;
let fundingWalletClients: any;
let receivingWalletClients: any;
interface IAddress {
  coin: string;
  chain: string;
  network: string;
  address: string;
  hasActivity: boolean;
  isChange?: boolean;
}

export interface IWalletService {
  lock: Lock;
  storage: Storage;
  blockchainExplorer: V8;
  blockchainExplorerOpts: any;
  messageBroker: MessageBroker;
  fiatRateService: FiatRateService;
  notifyTicker: number;
  userAgent: string;
  walletId: string;
  copayerId: string;
  appName: string;
  appVersion: { agent?: string; major?: number; minor?: number };
  parsedClientVersion: { agent?: string; major?: number; minor?: number };
  clientVersion: string;
  copayerIsSupportStaff: boolean;
  copayerIsMarketingStaff: boolean;
  request: any;
}

export interface ICoinConfigFilter {
  fromDate?: Date;
  toDate?: Date;
  fromCoinCode?: string;
  toCoinCode?: string;
  status?: string;
  fromNetwork?: string;
  toNetwork?: string;
  orderId?: string;
  isInQueue?: boolean;
}

function boolToNum(x: boolean) {
  return x ? 1 : 0;
}
/**
 * Creates an instance of the Bitcore Wallet Service.
 * @constructor
 */
export class WalletService implements IWalletService {
  lock: Lock;
  storage: Storage;
  blockchainExplorer: V8;
  blockchainExplorerOpts: any;
  messageBroker: MessageBroker;
  pushNotifications: PushNotificationsService;
  fiatRateService: FiatRateService;
  notifyTicker: number;
  userAgent: string;
  walletId: string;
  copayerId: string;
  appName: string;
  appVersion: { agent?: string; major?: number; minor?: number; patch?: number };
  parsedClientVersion: { agent?: string; major?: number; minor?: number };
  clientVersion: string;
  copayerIsSupportStaff: boolean;
  copayerIsMarketingStaff: boolean;
  request: any;
  externalServices: {
    banxa: BanxaService;
    changelly: ChangellyService;
    moonpay: MoonpayService;
    oneInch: OneInchService;
    ramp: RampService;
    sardine: SardineService;
    simplex: SimplexService;
    thorswap: ThorswapService;
    transak: TransakService;
    coinGecko: CoinGeckoService;
  };

  constructor() {
    if (!initialized) {
      throw new Error('Server not initialized');
    }

    this.lock = lock;
    this.storage = storage;
    this.blockchainExplorer = blockchainExplorer;
    this.blockchainExplorerOpts = blockchainExplorerOpts;
    this.messageBroker = messageBroker;
    this.pushNotifications = pushNotifications;
    this.fiatRateService = fiatRateService;
    this.notifyTicker = 0;
    // for testing
    //
    this.request = request;

    this.externalServices = {
      banxa: new BanxaService(),
      changelly: new ChangellyService(),
      moonpay: new MoonpayService(),
      oneInch: new OneInchService(this.storage),
      ramp: new RampService(),
      sardine: new SardineService(),
      simplex: new SimplexService(),
      thorswap: new ThorswapService(),
      transak: new TransakService(this.storage, this.lock),
      coinGecko: new CoinGeckoService(this.storage),
    };
  }

  _checkingValidAddress(address): boolean {
    try {
      const { prefix, type, hash } = ecashaddr.decode(address);
      if (prefix === 'ecash' || prefix === 'etoken') {
        return true;
      } else {
        return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Gets the current version of BWS
   */
  static getServiceVersion() {
    if (!serviceVersion) {
      serviceVersion = 'bws-' + version;
    }

    return serviceVersion;
  }

  /**
   * Initializes global settings for all instances.
   * @param {Object} opts
   * @param {Storage} [opts.storage] - The storage provider.
   * @param {Storage} [opts.blockchainExplorer] - The blockchainExporer provider.
   * @param {Storage} [opts.doNotCheckV8] - only for testing
   * @param {Callback} cb
   */
  static initialize(opts, cb) {
    $.shouldBeFunction(cb, '');

    opts = opts || {};
    blockchainExplorer = opts.blockchainExplorer;
    blockchainExplorerOpts = opts.blockchainExplorerOpts;

    doNotCheckV8 = opts.doNotCheckV8;
    if (opts.request) {
      request = opts.request;
    }

    const initStorage = cb => {
      if (opts.storage) {
        storage = opts.storage;
        return cb();
      } else {
        const newStorage = new Storage();
        newStorage.connect(opts.storageOpts, err => {
          if (err) {
            return cb(err);
          }
          storage = newStorage;
          return cb();
        });
      }
    };

    const initMessageBroker = cb => {
      messageBroker = opts.messageBroker || new MessageBroker(opts.messageBrokerOpts);
      if (messageBroker) {
        messageBroker.onMessage(WalletService.handleIncomingNotifications);
      }

      return cb();
    };

    const initFiatRateService = cb => {
      if (opts.fiatRateService) {
        fiatRateService = opts.fiatRateService;
        return cb();
      } else {
        const newFiatRateService = new FiatRateService();
        const opts2 = opts.fiatRateServiceOpts || {};
        opts2.storage = storage;
        newFiatRateService.init(opts2, err => {
          if (err) {
            return cb(err);
          }

          fiatRateService = newFiatRateService;
          return cb();
        });
      }
    };

    const initCurrencyRateService = cb => {
      if (opts.currencyRateService) {
        currencyRateService = opts.currencyRateService;
        return cb();
      } else {
        const newCurrencyRateService = new CurrencyRateService();
        const opts2 = opts.currencyRateServiceOpts || {};
        opts2.storage = storage;
        newCurrencyRateService.init(opts2, err => {
          if (err) {
            return cb(err);
          }
          currencyRateService = newCurrencyRateService;
          return cb();
        });
      }
    };

    async.series(
      [
        next => {
          initStorage(next);
        },
        next => {
          initMessageBroker(next);
        },
        // TODO: when implement appreciation check again
        // next => {
        //   initPushNotification(next);
        // },
        next => {
          initFiatRateService(next);
        },
        next => {
          initCurrencyRateService(next);
        }
      ],
      err => {
        lock = opts.lock || new Lock(storage);

        if (err) {
          logger.error('Could not initialize: %o', err);
          throw err;
        }
        initialized = true;
        return cb();
      }
    );
  }

  static handleIncomingNotifications(_notification: INotification) {
    // do nothing here....
    // bc height cache is cleared on bcmonitor
  }

  static shutDown(cb) {
    if (!initialized) {
      return cb();
    }

    storage.disconnect(err => {
      if (err) {
        return cb(err);
      }

      initialized = false;
      return cb();
    });
  }

  /**
   * Gets an instance of the server without authentication.
   * @param {Object} opts
   * @param {string} opts.clientVersion - A string that identifies the client issuing the request
   */
  static getInstance(opts?): WalletService {
    opts = opts || {};

    const upgradeMessage = WalletService.upgradeNeeded(UPGRADES.bwc_$lt_1_2, opts);
    if (upgradeMessage) {
      throw Errors.UPGRADE_NEEDED.withMessageMaybe(upgradeMessage);
    }

    const server = new WalletService();
    server._setClientVersion(opts.clientVersion);
    server._setAppVersion(opts.userAgent);
    server.userAgent = opts.userAgent;
    return server;
  }

  /**
   * Gets an instance of the server after authenticating the copayer.
   * @param {Object} opts
   * @param {string} opts.copayerId - The copayer id making the request.
   * @param {string} opts.message - (Optional) The contents of the request to be signed.
   *  Only needed if no session token is provided.
   * @param {string} opts.signature - (Optional) Signature of message to be verified using
   * one of the copayer's requestPubKeys.
   * Only needed if no session token is provided.
   * @param {string} opts.session - (Optional) A valid session token previously obtained using
   * the #login method
   * @param {string} opts.clientVersion - A string that identifies the client issuing the request
   * @param {string} [opts.walletId] - The wallet id to use as current wallet
   * for this request (only when copayer is support staff).
   */
  static getInstanceWithAuth(opts, cb: (err: Error, server?: WalletService) => void): void {
    const withSignature = cb => {
      if (!checkRequired(opts, ['copayerId', 'message', 'signature'], cb)) {
        return;
      }

      let server: WalletService;
      try {
        server = WalletService.getInstance(opts);
      } catch (ex) {
        return cb(ex);
      }

      server.storage.fetchCopayerLookup(opts.copayerId).then(copayer => {
        if (!copayer) {
          return cb(Errors.NOT_AUTHORIZED.withMessage('Copayer not found'));
        }

        const isValid = !!server._getSigningKey(opts.message, opts.signature, copayer.requestPubKeys);
        if (!isValid) {
          return cb(Errors.NOT_AUTHORIZED.withMessage('Invalid signature'));
        }

        server.walletId = copayer.walletId;

        // allow overwrite walletid if the copayer is from the support team
        if (copayer.isSupportStaff) {
          server.walletId = opts.walletId || copayer.walletId;
          server.copayerIsSupportStaff = true;
        }
        if (copayer.isMarketingStaff) {
          server.copayerIsMarketingStaff = true;
        }

        server.copayerId = opts.copayerId;
        return cb(null, server);
      }).catch(err => cb(err));
    };

    const withSession = cb => {
      if (!checkRequired(opts, ['copayerId', 'session'], cb)) {
        return;
      }

      let server: WalletService;
      try {
        server = WalletService.getInstance(opts);
      } catch (ex) {
        return cb(ex);
      }

      server.storage.getSession(opts.copayerId, (err, s) => {
        if (err) {
          return cb(err);
        }

        const isValid = s && s.id === opts.session && s.isValid();
        if (!isValid) {
          return cb(Errors.NOT_AUTHORIZED.withMessage('Session expired'));
        }

        server.storage.fetchCopayerLookup(opts.copayerId).then(copayer => {
          if (!copayer) {
            return cb(Errors.NOT_AUTHORIZED.withMessage('Copayer not found'));
          }

          server.copayerId = opts.copayerId;
          server.walletId = copayer.walletId;
          return cb(null, server);
        }).catch(err => cb(err));
      });
    };

    const authFn = opts.session ? withSession : withSignature;
    return authFn(cb);
  }

  static getStorage() {
    if (!initialized) {
      throw new Error('Storage requested before server was initialized');
    }
    return storage;
  }

  static getMessageBroker() {
    if (!initialized) {
      throw new Error('Message broker requested before server was initialized');
    }
    return messageBroker;
  }

  _runLocked(cb, task, waitTime?: number) {
    $.checkState(this.walletId, 'Failed state: this.walletId undefined at <_runLocked()>');
    this.lock.runLocked(this.walletId, { waitTime }, cb, task);
  }

  _cleanLogArgs(args) {
    if (!args || args.length === 0) {
      return [];
    }
    if (!Array.isArray(args)) {
      args = [args];
    }
    for (let i = 0; i < args.length; i++) {
      args[i] = args[i]?.response ? JSON.parse(JSON.stringify(args[i])) : args[i];
    }
    return args;
  }

  logi(message: string, ...args: any[]): BwsLogger {
    args = this._cleanLogArgs(args);

    if (typeof message === 'string' && args.length > 0 && !message.endsWith('%o')) {
      for (let i = 0; i < args.length; i++) {
        message += ' %o';
      }
    }

    if (!this || !this.walletId) {
      return logger.warn(message, ...args);
    }

    message = '<' + this.walletId + '>' + message;
    return logger.info(message, ...args);
  }

  logw(message: string, ...args: any[]): BwsLogger {
    args = this._cleanLogArgs(args);

    if (typeof message === 'string' && args.length > 0 && !message.endsWith('%o')) {
      for (let i = 0; i < args.length; i++) {
        message += ' %o';
        args[i] = args[i]?.stack || args[i]?.message || args[i];
      }
    }

    if (!this || !this.walletId) {
      return logger.warn(message, ...args);
    }

    message = '<' + this.walletId + '>' + message;
    return logger.warn(message, ...args);
  }

  logd(message: string, ...args: any[]): BwsLogger {
    args = this._cleanLogArgs(args);

    if (typeof message === 'string' && args.length > 0 && !message.endsWith('%o')) {
      for (let i = 0; i < args.length; i++) {
        message += ' %o';
      }
    }

    if (!this || !this.walletId) {
      return logger.verbose(message, ...args);
    }

    message = '<' + this.walletId + '>' + message;
    return logger.verbose(message, ...args);
  }

  login(opts, cb) {
    let session;
    async.series(
      [
        next => {
          this.storage.getSession(this.copayerId, (err, s) => {
            if (err) {
              return next(err);
            }
            session = s;
            next();
          });
        },
        next => {
          if (!session || !session.isValid()) {
            session = Session.create({
              copayerId: this.copayerId,
              walletId: this.walletId
            });
          } else {
            session.touch();
          }
          next();
        },
        next => {
          this.storage.storeSession(session, next);
        }
      ],
      err => {
        if (err) {
          return cb(err);
        }
        if (!session) {
          return cb(new Error('Could not get current session for this copayer'));
        }

        return cb(null, session.id);
      }
    );
  }

  logout(_opts, _cb) {
    // this.storage.removeSession(this.copayerId, cb);
  }

  /**
   * Creates a new wallet.
   * @param {Object} opts
   * @param {string} opts.id The wallet id.
   * @param {string} opts.name The wallet name.
   * @param {number} opts.m Required copayers.
   * @param {number} opts.n Total copayers.
   * @param {string} opts.pubKey Public key to verify copayers joining have access to the wallet secret. It's basically a throw-away key.
   * @param {string} [opts.hardwareSourcePublicKey] Public key from a hardware device for this copayer.
   * @param {string} [opts.singleAddress] The wallet will only ever have one address. Only applies to UTXO chains. Default: false
   * @param {string} [opts.coin] The coin for this wallet (btc, bch, eth, doge, ltc). Default: btc
   * @param {string} [opts.chain] The chain for this wallet (btc, bch, eth, doge, ltc). Default: opts.coin
   * @param {string} [opts.network] The Bitcoin network for this wallet. Default: livenent
   * @param {string} [opts.account] BIP44 account number. Default: 0
   * @param {string} [opts.usePurpose48] For Multisig wallet, use purpose=48.
   * @param {boolean} [opts.useNativeSegwit] Sets addressType to P2WPKH, P2WSH, or P2TR (opts.segwitVersion = 1).
   * @param {number} [opts.segwitVersion] 0 (default) = P2WPKH, P2WSH; 1 = P2TR
   * @param {number} [opts.tssVersion] TSS version to use. Supplying this with n > 1 and a multisig chain (e.g. btc) will tell the wallet to use
   *                                   threshold insead of on-chain multisig. Otherwise, n > 1 and a non-multisig chain will default to TSS_KEYGEN_SCHEME_VERSION
   * @param {string} [opts.tssKeyId] TSS key session id. This is the id of the TSS key generation session that will be used to create the wallet.
   * @param {string} [opts.tssKeygenCopayerId] The ID of the copayer creating the wallet. Required for TSS version >= 1.3.
   */
  async createWallet(opts, cb) {
    let pubKey;

    opts.coin = opts.coin || Defaults.COIN;
    if (!opts.chain) {
      opts.chain = opts.coin; // chain === coin for stored clients
    }

    const upgradeMessage = this._upgradeNeeded([UPGRADES.BCH_bwc_$lt_8_3_multisig, UPGRADES.SOL_bwc_$lt_10_10_12], opts);
    if (upgradeMessage) {
      return cb(Errors.UPGRADE_NEEDED.withMessageMaybe(upgradeMessage));
    }

    if (!checkRequired(opts, ['name', 'm', 'n', 'pubKey'], cb)) {
      return;
    }

    if (!opts.name) {
      return cb(new ClientError('Invalid wallet name'));
    }

    if (!Wallet.verifyCopayerLimits(opts.m, opts.n)) {
      return cb(new ClientError('Invalid combination of required copayers / total copayers'));
    }

    // ChainService only has the chains this fork serves (no EVM, SOL or XRP, #132)
    if (!Utils.checkValueInCollection(opts.chain, Constants.CHAINS) || !ChainService.get(opts.chain)) {
      return cb(new ClientError('Invalid chain'));
    }

    opts.network = Utils.getNetworkName(opts.chain, opts.network) || 'livenet';
    if (!Utils.checkValueInCollection(opts.network, Constants.NETWORKS[opts.chain])) {
      return cb(new ClientError('Invalid network'));
    }

    if (opts.network === 'regtest' && !config.allowRegtest) {
      return cb(new ClientError('Regtest is not allowed for this environment'));
    }

    try {
      // NOTE: this is just a shared pub key as part of the multisig
      // join secret. It's NOT the wallet's main xPubKey.
      pubKey = new Bitcore.PublicKey.fromString(opts.pubKey);
    } catch {
      return cb(new ClientError('Invalid public key'));
    }

    if (opts.n > 1) {
      const multisig = ChainService.supportsMultisig(opts.chain);
      const thresholdsig = ChainService.supportsThresholdsig(opts.chain);
      if (!multisig && !thresholdsig) {
        return cb(new ClientError('Multisig wallets are not supported for this chain'));
      }
      if (!multisig && !opts.tssKeyId) {
        return cb(new ClientError('TSS key session id is required for this chain'));
      }
    }

    if (opts.tssKeyId) {
      const keySession = await storage.fetchTssKeyGenSession({ id: opts.tssKeyId });
      if (!keySession || !keySession.sharedPublicKey) {
        // TODO: support importing a TSS key that was generated outside of this BWS instance.
        return cb(new ClientError('Invalid TSS key session id'));
      }

      opts.tssVersion = opts.tssVersion || keySession.schemeVersion || Defaults.TSS_KEYGEN_SCHEME_VERSION;
      if (!(opts.tssVersion >= Constants.TSS_KEYGEN_SCHEME_VERSION_MIN && opts.tssVersion <= Constants.TSS_KEYGEN_SCHEME_VERSION_MAX)) {
        return cb(new ClientError('Invalid TSS version'));
      }

      if (opts.tssVersion >= 1.3) {
        if (!opts.tssKeygenCopayerId) {
          return cb(new ClientError('Copayer ID is required for TSS version >= 1.3'));
        }
        // This is only a sanity check to prevent problems down the line. If this is somehow
        // spoofed, there are more strict authorization checks later in the wallet creation flow.
        if (keySession.participants.indexOf(opts.tssKeygenCopayerId) !== 0) {
          return cb(new ClientError('Only the TSS session leader can create a wallet'));
        }
      }

      // TSS wallets behave like a single-sig
      opts.m = 1;
      opts.n = 1;
    }

    const derivationStrategy = Constants.DERIVATION_STRATEGIES.BIP44;
    let addressType: string = opts.n === 1 ? Constants.SCRIPT_TYPES.P2PKH : Constants.SCRIPT_TYPES.P2SH;

    if (opts.useNativeSegwit && Utils.checkValueInCollection(opts.chain, Constants.NATIVE_SEGWIT_CHAINS)) {
      switch (Number(opts.segwitVersion)) {
        case 0:
        default:
          addressType = opts.n === 1 ? Constants.SCRIPT_TYPES.P2WPKH : Constants.SCRIPT_TYPES.P2WSH;
          break;
        case 1:
          if (!Utils.checkValueInCollection(opts.chain, Constants.TAPROOT_CHAINS)) {
            return cb(new ClientError('Invalid chain for P2TR'));
          }
          addressType = Constants.SCRIPT_TYPES.P2TR;
          break;
      }
    }

    if (ChainService.isSingleAddress(opts.chain)) {
      opts.singleAddress = true;
    }

    let newWallet;
    async.series(
      [
        acb => {
          if (!opts.id) {
            return acb();
          }

          this.storage.fetchWallet(opts.id, (err, wallet) => {
            if (wallet) {
              return acb(Errors.WALLET_ALREADY_EXISTS);
            }
            return acb(err);
          });
        },
        acb => {
          const wallet = Wallet.create({
            id: opts.id,
            name: opts.name,
            m: opts.m,
            n: opts.n,
            coin: opts.coin,
            chain: opts.chain, // chain === coin for stored wallets
            network: opts.network,
            pubKey: pubKey.toString(),
            singleAddress: !!opts.singleAddress,
            derivationStrategy,
            addressType,
            nativeCashAddr: opts.nativeCashAddr,
            usePurpose48: opts.n > 1 && !opts.tssVersion && !!opts.usePurpose48,
            hardwareSourcePublicKey: opts.hardwareSourcePublicKey,            
            clientDerivedPublicKey: opts.clientDerivedPublicKey,
            tssVersion: opts.tssVersion,
            tssKeyId: opts.tssKeyId,
            isSlpToken: !!opts.isSlpToken,
            isFromRaipay: !!opts.isFromRaipay,
            isPath899: !!opts.isPath899
          });
          this.storage.storeWallet(wallet, err => {
            this.logd('Wallet created', wallet.id, opts.network);
            newWallet = wallet;
            return acb(err);
          });
        }
      ],
      err => {
        return cb(err, newWallet ? newWallet.id : null);
      }
    );
  }

  /**
   * Retrieves a wallet from storage.
   * @param {Object} opts
   * * @param {string} opts.walletId - The wallet id.
   * @returns {Object} wallet
   */
  getWallet(opts, cb: (err: Error, wallet?: Wallet) => void) {
    this.storage.fetchWallet(this.walletId, (err, wallet) => {
      if (err) return cb(err);
      if (!wallet) return cb(Errors.WALLET_NOT_FOUND);
      if (this._upgradeNeeded(UPGRADES.SOL_bwc_$lt_10_10_12, wallet)) return cb(Errors.UPGRADE_NEEDED);

      // cashAddress migration
      if (wallet.coin != 'bch' || wallet.nativeCashAddr) return cb(null, wallet);

      // only for testing
      if (opts.doNotMigrate) return cb(null, wallet);

      // backwards compatibility
      if (!wallet.chain) wallet.chain = Utils.getChain(wallet.coin);

      // remove someday...
      logger.info(`Migrating wallet ${wallet.id} to cashAddr`);
      this.storage.migrateToCashAddr(this.walletId, e => {
        if (e) return cb(e);
        wallet.nativeCashAddr = true;
        return this.storage.storeWallet(wallet, e => {
          if (e) return cb(e);
          return cb(e, wallet);
        });
      });
    });
  }

  /**
   * Retrieves a wallet from storage.
   * @param {Object} opts
   * @param {string} opts.identifier - The identifier associated with the wallet (one of: walletId, address, txid).
   * @param {string} opts.walletCheck - Check v8 wallet sync
   * @returns {Object} wallet
   */
  getWalletFromIdentifier(opts, cb) {
    if (!opts.identifier) return cb();

    const end = (err, ret) => {
      if (opts.walletCheck && !err && ret) {
        return this.syncWallet(ret, cb);
      } else {
        return cb(err, ret);
      }
    };

    let walletId;
    async.parallel(
      [
        done => {
          this.storage.fetchWallet(opts.identifier, (err, wallet) => {
            if (wallet) walletId = wallet.id;
            return done(err);
          });
        },
        done => {
          this.storage.fetchAddressByChain(Defaults.CHAIN, opts.identifier, (err, address) => {
            if (address) walletId = address.walletId;
            return done(err);
          });
        },
        done => {
          // sent txs
          this.storage.fetchTxByHash(opts.identifier, (err, tx) => {
            if (tx) walletId = tx.walletId;
            return done(err);
          });
        }
      ],
      err => {
        if (err) return cb(err);
        if (walletId) {
          return this.storage.fetchWallet(walletId, end);
        }

        return cb();
      }
    );
  }

  /**
   * Retrieves wallet status.
   * @param {Object} opts
   * @param {Object} opts.includeExtendedInfo - Include PKR info & address managers for wallet & copayers
   * @param {Object} opts.includeServerMessages - Include server messages array
   * @param {Object} opts.tokenAddress - (Optional) Token contract address to pass in getBalance
   * @param {Object} opts.multisigContractAddress - (Optional) Multisig ETH contract address to pass in getBalance
   * @param {Object} opts.network - (Optional ETH MULTISIG) Multisig ETH contract address network
   * @param {string} opts.numberFormat Returns txp tx-build values as 'string', 'hex', or 'number' (default)
   * @returns {Object} status
   */
  getStatus(opts, cb) {
    opts = opts || {};

    const status: {
      wallet?: Partial<IWallet>;
      serverMessage?: {
        title: string;
        body: string;
        link: string;
        id: string;
        dismissible: boolean;
        category: string;
        app: string;
      };
      serverMessages?: Array<{
        title: string;
        body: string;
        link: string;
        id: string;
        dismissible: boolean;
        category: string;
        app: string;
        priority: number;
      }>;
      balance?: string;
      pendingTxps?: ITxProposal[];
      preferences?: boolean;
    } = {};
    this.getWallet({}, (err, fetchedWallet: Wallet) => {
      if (err) return cb(err);

      // Read the wallet once, and give each step its own copy, the same as reading it again: the steps change their
      // wallet in place (this one strips copayer data, the balance code sets tokenAddress on it), and the balance step
      // can store its copy whole.
      const copyOfWallet = () => Wallet.fromObj(fetchedWallet.toObject());
      const omit = (obj, keys: string[]): any => Object.fromEntries(Object.entries(obj).filter(([key]) => !keys.includes(key)));
      async.parallel(
        [
          next => {
            let wallet: Partial<Wallet> = copyOfWallet();
            const walletExtendedKeys = ['publicKeyRing', 'pubKey', 'addressManager'];
            const copayerExtendedKeys = ['xPubKey', 'requestPubKey', 'signature', 'addressManager', 'customData'];

            wallet.copayers = (wallet.copayers || []).map(copayer => {
              if (copayer.id == this.copayerId) return copayer;
              return omit(copayer, ['customData']);
            });
            if (!opts.includeExtendedInfo) {
              wallet = omit(wallet, walletExtendedKeys);
              wallet.copayers = (wallet.copayers || []).map(copayer => {
                return omit(copayer, copayerExtendedKeys);
              }) as Copayer[];
            }
            status.wallet = wallet;

            if (opts.includeServerMessages) {
              status.serverMessages = serverMessages(wallet, this.appName, this.appVersion);
            } else {
              status.serverMessage = deprecatedServerMessage(wallet, this.appName, this.appVersion);
            }
            next();
          },
          next => {
            this.getBalance({ ...opts, wallet: copyOfWallet() }, (err, balance) => {
              // ignore WALLET_NEED_SCAN err is includeExtendedInfo is given
              // (to allow `importWallet` to import a wallet, while scan has
              // failed)
              if (opts.includeExtendedInfo) {
                if (err && err.code != 'WALLET_NEED_SCAN') {
                  return next(err);
                }
              } else if (err) {
                return next(err);
              }

              status.balance = balance;
              next();
            });
          },
          next => {
            this.getPendingTxs({ ...opts, wallet: copyOfWallet() }, (err, pendingTxps) => {
              if (err) return next(err);
              status.pendingTxps = pendingTxps;
              next();
            });
          },
          next => {
            this.getPreferences({}, (err, preferences) => {
              if (err) return next(err);
              status.preferences = preferences;
              next();
            });
          }
        ],
        err => {
          if (err) return cb(err);
          return cb(null, status);
        }
      );
    });
  }

  /**
   * Verifies a signature
   * @param text
   * @param signature
   * @param pubKeys
   */
  _verifySignature(text, signature, pubkey) {
    return Utils.verifyMessage(text, signature, pubkey);
  }

  /**
   * Verifies a request public key
   * @param requestPubKey
   * @param signature
   * @param xPubKey
   */
  _verifyRequestPubKey(requestPubKey, signature, xPubKey) {
    const pub = new Bitcore.HDPublicKey(xPubKey).deriveChild(Constants.PATHS.REQUEST_KEY_AUTH).publicKey;
    return Utils.verifyMessage(requestPubKey, signature, pub.toString());
  }

  /**
   * Verifies signature againt a collection of pubkeys
   * @param text
   * @param signature
   * @param pubKeys
   */
  _getSigningKey(text, signature, pubKeys) {
    return pubKeys.find(item => {
      return this._verifySignature(text, signature, item.key);
    });
  }

  /**
   * _notify
   *
   * @param {String} type
   * @param {Object} data
   * @param {Object} opts
   * @param {Boolean} opts.isGlobal - If true, the notification is not issued on behalf of any particular copayer (defaults to false)
   */
  _notify(type, data, opts, cb?: (err?: any, data?: any) => void) {
    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }
    opts = opts || {};

    // this.logi('Notification', type);

    cb = cb || function() { };

    const walletId = this.walletId || data.walletId;
    const copayerId = this.copayerId || data.copayerId;

    $.checkState(walletId, 'Failed state: walletId undefined at <_notify()>');

    const notification = Notification.create({
      type,
      data,
      ticker: this.notifyTicker++,
      creatorId: opts.isGlobal ? null : copayerId,
      walletId
    });

    this.storage.storeNotification(walletId, notification, () => {
      this.messageBroker.send(notification);
      return cb();
    });
  }

  _notifyTxProposalAction(type, txp, extraArgs, cb?: (err?: any, data?: any) => void) {
    if (typeof extraArgs === 'function') {
      cb = extraArgs;
      extraArgs = {};
    }

    const data = Object.assign(
      {
        txProposalId: txp.id,
        creatorId: txp.creatorId,
        amount: txp.getTotalAmount(),
        message: txp.message,
        tokenAddress: txp.tokenAddress,
        multisigContractAddress: txp.multisigContractAddress
      },
      extraArgs
    );
    this._notify(type, data, {}, cb);
  }

  _addCopayerToWallet(
    wallet: Wallet,
    opts: JoinWalletOpts,
    cb: (err: ClientError | null, result?: { copayerId: string | null; wallet: Wallet }) => void
  ) {
    const copayer = Copayer.create({
      coin: wallet.coin,
      chain: wallet.chain, // chain === coin for stored clients
      name: opts.name,
      copayerIndex: wallet.copayers.length,
      xPubKey: opts.xPubKey,
      hardwareSourcePublicKey: opts.hardwareSourcePublicKey,
      clientDerivedPublicKey: opts.clientDerivedPublicKey,
      requestPubKey: opts.requestPubKey,
      signature: opts.copayerSignature,
      customData: opts.customData,
      derivationStrategy: wallet.derivationStrategy
    });

    this.storage.fetchCopayerLookup(copayer.id).then(res => {
      if (res) return cb(Errors.COPAYER_REGISTERED);

      if (opts.dryRun)
        return cb(null, {
          copayerId: null,
          wallet
        });

      wallet.addCopayer(copayer);
      this.storage.storeWalletAndUpdateCopayersLookup(wallet, err => {
        if (err) return cb(err);

        async.series(
          [
            next => {
              this._notify(
                'NewCopayer',
                {
                  walletId: opts.walletId,
                  copayerId: copayer.id,
                  copayerName: copayer.name
                },
                {},
                next
              );
            },
            next => {
              if (wallet.isComplete() && wallet.isShared()) {
                this._notify(
                  'WalletComplete',
                  {
                    walletId: opts.walletId
                  },
                  {
                    isGlobal: true
                  },
                  next
                );
              } else {
                next();
              }
            }
          ],
          () => {
            return cb(null, {
              copayerId: copayer.id,
              wallet
            });
          }
        );
      });
    }).catch(err => cb(err));
  }

  _addKeyToCopayer(wallet: Wallet, copayer: Copayer, opts, cb) {
    wallet.addCopayerRequestKey(copayer.id, opts.requestPubKey, opts.signature, opts.restrictions, opts.name);
    this.storage.storeWalletAndUpdateCopayersLookup(wallet, err => {
      if (err) return cb(err);

      return cb(null, {
        copayerId: copayer.id,
        wallet
      });
    });
  }

  /**
   * Adds access to a given copayer
   *
   * @param {Object} opts
   * @param {string} opts.copayerId - The copayer id
   * @param {string} opts.requestPubKey - Public Key used to check requests from this copayer.
   * @param {string} opts.copayerSignature - S(requestPubKey). Used by other copayers to verify the that the copayer is himself (signed with REQUEST_KEY_AUTH)
   * @param {string} opts.restrictions
   *    - cannotProposeTXs
   *    - cannotXXX TODO
   * @param {string} opts.name  (name for the new access)
   */
  addAccess(opts, cb) {
    if (!checkRequired(opts, ['copayerId', 'requestPubKey', 'signature'], cb)) return;

    this.storage.fetchCopayerLookup(opts.copayerId).then(copayer => {
      if (!copayer) return cb(Errors.NOT_AUTHORIZED);
      this.storage.fetchWallet(copayer.walletId, (err, wallet) => {
        if (err) return cb(err);
        if (!wallet) return cb(Errors.NOT_AUTHORIZED);

        const target = wallet.copayers.find(c => c.id === opts.copayerId);
        if (!target?.xPubKey) return cb(Errors.NOT_AUTHORIZED);

        try {
          const isValid = this._verifyRequestPubKey(opts.requestPubKey, opts.signature, target.xPubKey);
          if (!isValid) return cb(Errors.NOT_AUTHORIZED);
        } catch {
          return cb(Errors.NOT_AUTHORIZED);
        }

        if (copayer.requestPubKeys.length > Defaults.MAX_KEYS) return cb(Errors.TOO_MANY_KEYS);

        this._addKeyToCopayer(wallet, copayer, opts, cb);
      });
    }).catch(err => cb(err));
  }

  /**
   * Update user password and return recovery key
   *
   * @param {Object} opts
   * @param {string} opts.password - User password
   */
  updateKeysPassword(opts, cb) {
    if (!opts.password) {
      return cb(new Error('Missing required parameter password'));
    }
    const storage = this.storage;
    bcrypt.hash(opts.password, saltRounds, function (err, hashPass) {
      // Store hash in your password DB.
      if (err) return cb(err);

      const recoveryKey = cuid();

      bcrypt.hash(recoveryKey, saltRounds, function (err, hashKey) {
        // const user = {
        //   email: opts.email,
        //   hashPassword: hashPass,
        //   recoveryKey: hashKey
        // } as IUser;
        storage.fetchKeys((err, result: Keys) => {
          if (err) return cb(err);
          if (result) {
            result.hashPassword = hashPass;
            storage.updateKeys(result, (err, result) => {
              if (err) return cb(err);
              if (result) return cb(null, recoveryKey);
            });
          } else {
            const keys = {
              keyFund: null,
              keyReceive: null,
              hashPassword: hashPass,
              hashRecoveryKey: recoveryKey
            } as Keys;
            storage.storeKeys(keys, (err, result) => {
              if (err) return cb(err);
              return cb(null, recoveryKey);
            });
          }
        });
      });
    });
  }

  /**
   * Update user password and return recovery key
   *
   * @param {Object} opts
   * @param {string} opts.password - User password
   */
  updateKeysPasswordConversion(opts, cb) {
    if (!opts.password) {
      return cb(new Error('Missing required parameter password'));
    }
    const storage = this.storage;
    bcrypt.hash(opts.password, saltRounds, function (err, hashPass) {
      // Store hash in your password DB.
      if (err) return cb(err);

      const recoveryKey = cuid();

      bcrypt.hash(recoveryKey, saltRounds, function (err, hashKey) {
        // const user = {
        //   email: opts.email,
        //   hashPassword: hashPass,
        //   recoveryKey: hashKey
        // } as IUser;
        storage.fetchKeysConversion((err, result: KeysConversion) => {
          if (err) return cb(err);
          if (result) {
            result.hashPassword = hashPass;
            storage.updateKeysConversion(result, (err, result) => {
              if (err) return cb(err);
              if (result) return cb(null, recoveryKey);
            });
          } else {
            const keys = {
              keyFund: null,
              hashPassword: hashPass,
              hashRecoveryKey: recoveryKey
            } as Keys;
            storage.storeKeysConversion(keys, (err, result) => {
              if (err) return cb(err);
              return cb(null, recoveryKey);
            });
          }
        });
      });
    });
  }
  /**
   * Verify user password
   *
   * @param {Object} opts
   * @param {string} opts.email - User email
   * @param {string} opts.password - User password
   */
  verifyPassword(opts, cb) {
    if (!opts.email) {
      return cb(new Error('Missing required parameter email'));
    }
    if (!opts.password) {
      return cb(new Error('Missing required parameter password'));
    }

    this.storage.fetchKeys((err, keys: Keys) => {
      if (err) return cb(err);
      bcrypt
        .compare(opts.password, keys.hashPassword)
        .then(result => {
          if (err) return cb(err);
          if (!result) return cb(new Error('Invalid password'));
          return cb(null, result);
        })
        .catch(e => {
          return cb(e);
        });
    });
  }

  /**
   * Verify user password
   *
   * @param {Object} opts
   * @param {string} opts.email - User email
   * @param {string} opts.password - User password
   */
  verifyConversionPassword(opts, cb) {
    if (!opts.email) {
      return cb(new Error('Missing required parameter email'));
    }
    if (!opts.password) {
      return cb(new Error('Missing required parameter password'));
    }

    this.storage.fetchKeysConversion((err, keys: Keys) => {
      if (err) return cb(err);
      bcrypt
        .compare(opts.password, keys.hashPassword)
        .then(result => {
          if (err) return cb(err);
          if (!result) return cb(new Error('Invalid password'));
          return cb(null, result);
        })
        .catch(e => {
          return cb(e);
        });
    });
  }
  // return a Promise
  // sharedKey: Buffer, plainText: Uint8Array
  encrypt(sharedKey, plainText) {
    // Split shared key
    const iv = forge.util.createBuffer(sharedKey.slice(0, 16));
    const key = forge.util.createBuffer(sharedKey.slice(0, 16));

    const cipher = forge.cipher.createCipher('AES-CBC', key);
    cipher.start({ iv });
    const rawBuffer = forge.util.createBuffer(plainText);
    cipher.update(rawBuffer);
    cipher.finish();
    const cipherText = cipher.output.toHex();
    return cipherText;
  }

  // return a Promise
  // sharedKey: Buffer, plainText: Uint8Array
  decrypt(sharedKey: Buffer, cipherText: string) {
    try {
      // Split shared key
      const iv = forge.util.createBuffer(sharedKey.slice(0, 16));
      const key = forge.util.createBuffer(sharedKey.slice(0, 16));

      // Encrypt entries
      const cipher = forge.cipher.createDecipher('AES-CBC', key);
      cipher.start({ iv });
      const convertedCiphertext = forge.util.hexToBytes(cipherText);
      const rawBuffer = new forge.util.ByteBuffer(convertedCiphertext);
      cipher.update(rawBuffer);
      cipher.finish();
      const plainText = Uint8Array.from(Buffer.from(cipher.output.toHex(), 'hex'));
      return plainText;
    } catch (e) {
      console.log(e);
    }
  }
  /**
   * Update key for swap
   *
   * @param {Object} opts
   * @param {string} opts.keyFund - key fund
   * @param {string} opts.keyReceive - key receive
   */

  importSeed(opts, cb) {
    if (!opts.keyFund && !opts.keyReceive) {
      return cb(new Error('Missing required key'));
    }
    this.storage.fetchKeys((err, keys) => {
      if (keys) {
        if (opts.keyFund && opts.keyFund.length > 0) {
          keys.keyFund = this.encrypt(config.sharedKey, opts.keyFund);
        }
        if (opts.keyReceive && opts.keyReceive.length > 0) {
          keys.keyReceive = this.encrypt(config.sharedKey, opts.keyReceive);
        }
        this.storage.updateKeys(keys, (err, result) => {
          if (err) return cb(err);
          this.restartHandleSwapQueue(err => {
            if (err) return cb(err);
            return cb(null, true);
          });
        });
      } else {
        return cb(null, false);
      }
    });
  }

  /**
   * Update key for conversion
   *
   * @param {Object} opts
   * @param {string} opts.keyFund - key fund
   */

  importSeedConversion(opts, cb) {
    if (!opts.keyFund) {
      return cb(new Error('Missing required key'));
    }

    this.storage.fetchKeysConversion((err, keys) => {
      if (err) return cb(err);
      if (keys) {
        if (opts.keyFund && opts.keyFund.length > 0) {
          keys.keyFund = this.encrypt(config.sharedKey, opts.keyFund);
        }
        this.storage.updateKeysConversion(keys, (err, result) => {
          if (err) return cb(err);
          this.restartHandleConversionQueue(err => {
            if (err) return cb(err);
            return cb(null, true);
          });
        });
      } else {
        return cb(null, false);
      }
    });
  }

  /**
   * Checking if exist deposit or swap fund
   */
  checkingSeedExist(cb) {
    this.storage.fetchKeys((err, keys) => {
      if (err) return cb(err);
      if (!keys) {
        return cb(null, { isKeyExisted: false });
      } else {
        return cb(null, { isKeyExisted: true });
      }
    });
  }

  /**
   * Checking if exist deposit or swap fund
   */
  checkingSeedConversionExist(cb) {
    this.storage.fetchKeysConversion((err, keys) => {
      if (err) return cb(err);
      if (!keys) {
        return cb(null, { isKeyExisted: false });
      } else {
        return cb(null, { isKeyExisted: true });
      }
    });
  }

  /**
   * Renew password for user and return new recovery key
   *
   * @param {Object} opts
   * @param {string} opts.oldPassword - User old password
   * @param {string} opts.newPassword - User new password
   * @param {string} opts.recoveryKey - User recovery key
   */
  renewPassword(opts, cb) {
    if (!opts.newPassword) {
      return cb(new Error('Missing required parameter new password'));
    }
    if (!(opts.oldPassword || opts.recoveryKey)) {
      return cb(new Error('Missing requirement parameter password or recovery key to re new password'));
    }

    this.storage.fetchKeys((err, keys: Keys) => {
      if (err) return cb(err);
      const compareValue = {
        text: '',
        hash: ''
      };
      if (opts.oldPassword.length > 0) {
        compareValue.text = opts.oldPassword;
        compareValue.hash = keys.hashPassword;
      } else if (opts.recoveryKey.length > 0) {
        compareValue.text = opts.recoveryKey;
        compareValue.hash = keys.hashRecoveryKey;
      }
      bcrypt
        .compare(compareValue.text, compareValue.hash)
        .then(result => {
          if (result) {
            this.updateKeysPassword({ password: opts.newPassword }, (err, recoveryKey) => {
              if (err) return cb(err);
              return cb(null, recoveryKey);
            });
          } else {
            return cb(new Error('Invalid data. Please try again'));
          }
        })
        .catch(e => {
          return cb(e);
        });
    });
  }

  /**
   * Renew password for user and return new recovery key
   *
   * @param {Object} opts
   * @param {string} opts.oldPassword - User old password
   * @param {string} opts.newPassword - User new password
   * @param {string} opts.recoveryKey - User recovery key
   */
  renewPasswordConversion(opts, cb) {
    if (!opts.newPassword) {
      return cb(new Error('Missing required parameter new password'));
    }
    if (!(opts.oldPassword || opts.recoveryKey)) {
      return cb(new Error('Missing requirement parameter password or recovery key to re new password'));
    }

    this.storage.fetchKeysConversion((err, keys: KeysConversion) => {
      if (err) return cb(err);
      const compareValue = {
        text: '',
        hash: ''
      };
      if (opts.oldPassword.length > 0) {
        compareValue.text = opts.oldPassword;
        compareValue.hash = keys.hashPassword;
      } else if (opts.recoveryKey.length > 0) {
        compareValue.text = opts.recoveryKey;
        compareValue.hash = keys.hashRecoveryKey;
      }
      bcrypt
        .compare(compareValue.text, compareValue.hash)
        .then(result => {
          if (result) {
            this.updateKeysPasswordConversion({ password: opts.newPassword }, (err, recoveryKey) => {
              if (err) return cb(err);
              return cb(null, recoveryKey);
            });
          } else {
            return cb(new Error('Invalid data. Please try again'));
          }
        })
        .catch(e => {
          return cb(e);
        });
    });
  }

  _setClientVersion(version) {
    delete this.parsedClientVersion;
    this.clientVersion = version;
  }

  _setAppVersion(userAgent) {
    const parsed = Utils.parseAppVersion(userAgent);
    if (!parsed) {
      this.appName = this.appVersion = null;
    } else {
      this.appName = parsed.app;
      this.appVersion = parsed;
    }
  }

  _parseClientVersion() {
    if (this.parsedClientVersion == null) {
      this.parsedClientVersion = Utils.parseVersion(this.clientVersion);
    }
    return this.parsedClientVersion;
  }

  _clientSupportsPayProRefund() {
    const version = this._parseClientVersion();
    if (!version) return false;
    if (version.agent != 'bwc') return true;
    if (version.major < 1 || (version.major == 1 && version.minor < 2)) return false;
    return true;
  }

  static _getCopayerHash(name, xPubKey, requestPubKey) {
    return [name, xPubKey, requestPubKey].join('|');
  }

  /**
   * Joins a wallet in creation.
   */
  joinWallet(
    opts: JoinWalletOpts,
    cb: (err: ClientError | null, result?: { copayerId: string | null; wallet: Wallet }) => void
  ) {
    // xPubKey is the canonical copayer identity in the current protocol. Alternate public-key
    // fields are ancillary metadata; supporting an xPubKey-less copayer requires a versioned
    // end-to-end identity protocol rather than a local identity fallback.
    // SECURITY: xPubKey is required for every join, including hardwareSourcePublicKey/
    // clientDerivedPublicKey ones. Copayer.xPubToCopayerId() (called below both for the TSS
    // participant check and inside Copayer.create()) now throws on a missing xpub for every
    // coin (see its own guard), so an xPubKey-less join can no longer derive a copayer id at
    // all. bitcore-wallet-client's only join path (_doJoinWallet) always sends a real
    // xPubKey regardless of these two fields, so this doesn't restrict any flow this repo's
    // own client exercises - see the TSS-participant comment below for how that was confirmed.
    if (!checkRequired(opts, ['walletId', 'name', 'requestPubKey', 'copayerSignature', 'xPubKey'], cb)) return;
    if (!opts.name) return cb(new ClientError('Invalid copayer name'));

    opts.coin = opts.coin || Defaults.COIN;
    if (!opts.chain) {
      opts.chain = opts.coin; // chain === coin for stored clients
    }
    if (!Utils.checkValueInCollection(opts.chain, Constants.CHAINS)) return cb(new ClientError('Invalid coin'));
    if (opts.tssKeygenChain != null && !Utils.checkValueInCollection(opts.tssKeygenChain, Constants.CHAINS)) {
      return cb(new ClientError('Invalid TSS keygen chain'));
    }

    // xPubKey is parsed and validated for every join; ancillary fields never suppress it.
    // A future update will re-add conditional logic which allows opts.hardwareSourcePublicKey
    // or opts.clientDerivedPublicKey to circumvent this requirement
    let xPubKey;
    try {
      xPubKey = Bitcore_[opts.chain].HDPublicKey(opts.xPubKey);
    } catch {
      return cb(new ClientError('Invalid extended public key'));
    }
    if (xPubKey.network == null) {
      return cb(new ClientError('Invalid extended public key'));
    }

    this.walletId = opts.walletId;
    this._runLocked(cb, cb => {
      this.storage.fetchWallet(opts.walletId, async (err, wallet) => {
        if (err) return cb(err);
        if (!wallet) return cb(Errors.WALLET_NOT_FOUND);

        // SECURITY: opts.hardwareSourcePublicKey or opts.clientDerivedPublicKey may not
        // circumvent the required checks below. A future update may enable either to replace xPubKey
        // That is currently not supported

        if (this._upgradeNeeded(UPGRADES.BCH_bwc_$lt_8_3_multisig, { chain: opts.chain, n: wallet.n })) {
          return cb(Errors.UPGRADE_NEEDED.withMessage('BWC clients < 8.3 are no longer supported for multisig BCH wallets.'));
        }
        if (this._upgradeNeeded([UPGRADES.bwc_$lt_8_4_multisig_purpose48, UPGRADES.bwc_$lt_8_17_multisig_p2wsh], wallet)) {
          return cb(Errors.UPGRADE_NEEDED.withMessage('Please upgrade your client to join this multisig wallet'));
        }
        if (this._upgradeNeeded(UPGRADES.SOL_bwc_$lt_10_10_12, wallet)) {
          return cb(Errors.UPGRADE_NEEDED);
        }


        if (opts.chain != wallet.chain) {
          return cb(new ClientError('The wallet you are trying to join was created for a different chain'));
        }

        if (!Utils.compareNetworks(wallet.network, xPubKey.network.name, wallet.chain)) {
          return cb(new ClientError('The wallet you are trying to join was created for a different network'));
        }

        // New client trying to join legacy wallet
        if (wallet.derivationStrategy == Constants.DERIVATION_STRATEGIES.BIP45) {
          return cb(
            new ClientError('The wallet you are trying to join was created with an older version of the client app.')
          );
        }

        const hash = WalletService._getCopayerHash(opts.name, opts.xPubKey, opts.requestPubKey);
        if (!this._verifySignature(hash, opts.copayerSignature, wallet.pubKey)) {
          return cb(new ClientError());
        }

        if (wallet.copayers?.find(c => c.xPubKey === opts.xPubKey))
          return cb(Errors.COPAYER_IN_WALLET);

        if (wallet.tssKeyId) {
          const keySession = await storage.fetchTssKeyGenSession({ id: wallet.tssKeyId });
          // A sibling wallet on another network (e.g. livenet -> testnet) has an xPubKey serialized for that network,
          // but the keygen session's copayer IDs were derived from the xPubKey serialized for the session's network.
          const idChain = opts.tssKeygenChain || opts.chain;
          const copayerIds = new Set([
            Copayer.xPubToCopayerId(idChain, opts.xPubKey), // this is probably a duplicate of one of the next two entries, but just in case.
            Copayer.xPubToCopayerId(idChain, Utils.convertXPubKeyForNetwork(opts.xPubKey, idChain, 'livenet')),
            Copayer.xPubToCopayerId(idChain, Utils.convertXPubKeyForNetwork(opts.xPubKey, idChain, 'testnet'))
          ]);

          if (!keySession?.participants.some(id => copayerIds.has(id))) {
            return cb(Errors.TSS_NON_PARTICIPANT);
          }
          return this._addCopayerToWallet(wallet, opts, cb);
        }

        if (wallet.copayers.length == wallet.n) return cb(Errors.WALLET_FULL);

        this._addCopayerToWallet(wallet, opts, cb);
      });
    });
  }

  /**
   * Save copayer preferences for the current wallet/copayer pair.
   * @param {Object} opts
   * @param {string} opts.email - Email address for notifications.
   * @param {string} opts.language - Language used for notifications.
   * @param {string} opts.unit - Bitcoin unit used to format amounts in notifications.
   * @param {string} opts.tokenAddresses - Linked token addresses
   * @param {string} opts.multisigEthInfo - Linked multisig eth wallet info
   * @param {string} opts.maticTokenAddresses - Linked token addresses
   * @param {string} opts.opTokenAddresses - Linked token addresses
   * @param {string} opts.baseTokenAddresses - Linked token addresses
   * @param {string} opts.arbTokenAddresses - Linked token addresses
   * @param {string[]} opts.arcTokenAddresses - Linked Arc ERC20 token addresses
   * @param {string} opts.solTokenAddresses - Linked token addresses
   * @param {string} opts.multisigMaticInfo - Linked multisig eth wallet info
   *
   */
  savePreferences(opts, cb) {
    opts = opts || {};

    const preferences = [
      {
        name: 'email',
        isValid(value) {
          return EmailValidator.validate(value);
        }
      },
      {
        name: 'language',
        isValid(value) {
          return typeof value === 'string' && value.length == 2;
        }
      },
      {
        name: 'unit',
        isValid(value) {
          return typeof value === 'string' && ['btc', 'bit'].includes(value.toLowerCase());
        }
      },
      {
        name: 'tokenAddresses',
        isValid(value) {
          return Array.isArray(value) && value.every(x => Validation.validateAddress('eth', 'mainnet', x));
        }
      },
      {
        name: 'multisigEthInfo',
        isValid(value) {
          return (
            _.isArray(value) &&
            value.every(x => Validation.validateAddress('eth', 'mainnet', x.multisigContractAddress))
          );
        }
      },
      {
        name: 'maticTokenAddresses',
        isValid(value) {
          return _.isArray(value) && value.every(x => Validation.validateAddress('matic', 'mainnet', x));
        }
      },
      {
        name: 'multisigMaticInfo',
        isValid(value) {
          return (
            _.isArray(value) &&
            value.every(x => Validation.validateAddress('matic', 'mainnet', x.multisigContractAddress))
          );
        }
      },
      {
        name: 'opTokenAddresses',
        isValid(value) {
          return _.isArray(value) && value.every(x => Validation.validateAddress('op', 'mainnet', x));
        }
      },
      {
        name: 'baseTokenAddresses',
        isValid(value) {
          return _.isArray(value) && value.every(x => Validation.validateAddress('base', 'mainnet', x));
        }
      },
      {
        name: 'arbTokenAddresses',
        isValid(value) {
          return _.isArray(value) && value.every(x => Validation.validateAddress('arb', 'mainnet', x));
        }
      },
      {
        name: 'arcTokenAddresses',
        isValid(value) {
          return Array.isArray(value) && value.every(address =>
            Validation.validateAddress('arc', 'mainnet', address) &&
            address.toLowerCase() !== Constants.ARC.USDC_CONTRACT_ADDRESS);
        }
      },
      {
        name: 'solTokenAddresses',
        isValid(value) {
          return Array.isArray(value) && value.every(x => Validation.validateAddress('sol', 'mainnet', x));
        }
      },
    ];

    opts = _.pick(opts, _.map(preferences, 'name'));
    try {
      _.each(preferences, preference => {
        const value = opts[preference.name];
        if (!value) return;
        if (!preference.isValid(value)) {
          throw new Error('Invalid ' + preference.name);
        }
      });
    } catch (ex) {
      return cb(new ClientError(ex));
    }

    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);

      if (!Constants.EVM_CHAINS[wallet.chain.toUpperCase()]) {
        opts.tokenAddresses = null;
        opts.multisigEthInfo = null;
      }

      if (wallet.coin != 'matic') {
        opts.maticTokenAddresses = null;
        opts.multisigMaticInfo = null;
      }

      this._runLocked(cb, cb => {
        this.storage.fetchPreferences<Preferences>(this.walletId, this.copayerId, (err, oldPref) => {
          if (err) return cb(err);

          const newPref = Preferences.create({
            walletId: this.walletId,
            copayerId: this.copayerId
          });
          const preferences = Preferences.fromObj(_.defaults(newPref, opts, oldPref));

          // merge eth tokenAddresses
          if (opts.tokenAddresses) {
            oldPref = oldPref || {} as Preferences;
            oldPref.tokenAddresses = oldPref.tokenAddresses || [];
            preferences.tokenAddresses = _.uniq(oldPref.tokenAddresses.concat(opts.tokenAddresses));
          }

          // merge eth multisigEthInfo
          if (opts.multisigEthInfo) {
            oldPref = oldPref || {} as Preferences;
            oldPref.multisigEthInfo = oldPref.multisigEthInfo || [];

            preferences.multisigEthInfo = _.uniq(
              oldPref.multisigEthInfo.concat(opts.multisigEthInfo).reduce((x: any[], y: any) => {
                let exists = false;
                for (let e of x) {
                  // add new token addresses linked to the multisig wallet
                  if (e.multisigContractAddress === y.multisigContractAddress) {
                    e.tokenAddresses = e.tokenAddresses || [];
                    y.tokenAddresses = _.uniq(e.tokenAddresses.concat(y.tokenAddresses));
                    e = Object.assign(e, y);
                    exists = true;
                  }
                }
                return exists ? x : [...x, y];
              }, []) as object[]
            );
          }

          // merge matic tokenAddresses
          if (opts.maticTokenAddresses) {
            oldPref = oldPref || {} as Preferences;
            oldPref.maticTokenAddresses = oldPref.maticTokenAddresses || [];
            preferences.maticTokenAddresses = _.uniq(oldPref.maticTokenAddresses.concat(opts.maticTokenAddresses));
          }

          // merge op tokenAddresses
          if (opts.opTokenAddresses) {
            oldPref = oldPref || {} as Preferences;
            oldPref.opTokenAddresses = oldPref.opTokenAddresses || [];
            preferences.opTokenAddresses = _.uniq(oldPref.opTokenAddresses.concat(opts.opTokenAddresses));
          }

          // merge base tokenAddresses
          if (opts.baseTokenAddresses) {
            oldPref = oldPref || {} as Preferences;
            oldPref.baseTokenAddresses = oldPref.baseTokenAddresses || [];
            preferences.baseTokenAddresses = _.uniq(oldPref.baseTokenAddresses.concat(opts.baseTokenAddresses));
          }

          // merge arb tokenAddresses
          if (opts.arbTokenAddresses) {
            oldPref = oldPref || {} as Preferences;
            oldPref.arbTokenAddresses = oldPref.arbTokenAddresses || [];
            preferences.arbTokenAddresses = _.uniq(oldPref.arbTokenAddresses.concat(opts.arbTokenAddresses));
          }

          if (opts.arcTokenAddresses) {
            oldPref = oldPref || {} as Preferences;
            oldPref.arcTokenAddresses = oldPref.arcTokenAddresses || [];
            preferences.arcTokenAddresses = _.uniq(oldPref.arcTokenAddresses.concat(opts.arcTokenAddresses)
              .map(address => address.toLowerCase()));
          }

          if (opts.solTokenAddresses) {
            oldPref = oldPref || {} as Preferences;
            oldPref.solTokenAddresses = oldPref.solTokenAddresses || [];
            preferences.solTokenAddresses = _.uniq(oldPref.solTokenAddresses.concat(opts.solTokenAddresses));
          }

          // merge matic multisigMaticInfo
          if (opts.multisigMaticInfo) {
            oldPref = oldPref || {} as Preferences;
            oldPref.multisigMaticInfo = oldPref.multisigMaticInfo || [];

            preferences.multisigMaticInfo = _.uniq(
              oldPref.multisigMaticInfo.concat(opts.multisigMaticInfo).reduce((x: any[], y: any) => {
                let exists = false;
                for (let e of x) {
                  // add new token addresses linked to the multisig wallet
                  if (e.multisigContractAddress === y.multisigContractAddress) {
                    e.maticTokenAddresses = e.maticTokenAddresses || [];
                    y.maticTokenAddresses = _.uniq(e.maticTokenAddresses.concat(y.maticTokenAddresses));
                    e = Object.assign(e, y);
                    exists = true;
                  }
                }
                return exists ? x : [...x, y];
              }, []) as object[]
            );
          }
          this.storage.storePreferences(preferences, err => {
            return cb(err);
          });
        });
      });
    });
  }

  /**
   * Retrieves a preferences for the current wallet/copayer pair.
   * @param {Object} opts
   * @returns {Object} preferences
   */
  getPreferences(opts, cb) {
    this.storage.fetchPreferences(this.walletId, this.copayerId, (err, preferences) => {
      if (err) return cb(err);
      return cb(null, preferences || {});
    });
  }

  _canCreateAddress(ignoreMaxGap, cb) {
    if (ignoreMaxGap) return cb(null, true);

    const newest = { noChange: true, reverse: true, limit: Defaults.MAX_MAIN_ADDRESS_GAP };
    this.storage.fetchAddressesPage(this.walletId, newest, (err, addresses: IAddress[]) => {
      if (err) return cb(err);
      const latestAddresses = addresses.reverse();
      if (
        latestAddresses.length < Defaults.MAX_MAIN_ADDRESS_GAP ||
        latestAddresses.some(a => a.hasActivity)
      )
        return cb(null, true);

      const bc = this._getBlockchainExplorer(latestAddresses[0].coin, latestAddresses[0].network);
      if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
      let activityFound = false;
      let i = latestAddresses.length;
      async.whilst(
        () => {
          return i > 0 && !activityFound;
        },
        next => {
          bc.getAddressActivity(latestAddresses[--i].address, (err, res) => {
            if (err) return next(err);
            activityFound = !!res;
            return next();
          });
        },
        err => {
          if (err) return cb(err);
          if (!activityFound) return cb(null, false);

          const address = latestAddresses[i];
          address.hasActivity = true;
          this.storage.storeAddress(address, err => {
            return cb(err, true);
          });
        }
      );
    });
  }

  _store(wallet, address, cb, checkSync = false, forceSync = false) {
    const stoAddress = _.clone(address);
    ChainService.addressToStorageTransform(wallet.chain, wallet.network, stoAddress);
    this.storage.storeAddressAndWallet(wallet, stoAddress, (err, isDuplicate) => {
      if (err) return cb(err);
      this.syncWallet(
        wallet,
        err2 => {
          if (err2) {
            this.logw('Error syncing v8 addresses:', err2);
          }
          return cb(null, isDuplicate);
        },
        !checkSync,
        null,
        forceSync
      );
    });
  }

  /**
   * Creates a new address.
   * @param {Object} opts
   * @param {Boolean} [opts.ignoreMaxGap=false] - Ignore constraint of maximum number of consecutive addresses without activity
   * @param {Boolean} opts.noCashAddr (do not use cashaddr, only for backwards compat)
   * @returns {Address} address
   */
  createAddress(opts, cb) {
    opts = opts || {};

    const createNewAddress = (wallet, cb) => {
      let address;
      try {
        address = wallet.createAddress(!!opts.isChange);
      } catch (e) {
        this.logw('Error creating address:', e);
        return cb('Bad xPub');
      }

      this._store(
        wallet,
        address,
        (err, duplicate) => {
          if (err) return cb(err);
          if (duplicate) return cb(null, address);
          if (wallet.chain == 'bch' && opts.noCashAddr) {
            address = _.cloneDeep(address);
            address.address = BCHAddressTranslator.translate(address.address, 'copay');
          }

          this._notify(
            'NewAddress',
            {
              address: address.address
            },
            () => {
              return cb(null, address);
            }
          );
        },
        true
      );
    };

    const getFirstAddress = (wallet, cb) => {
      this.storage.fetchAddressesPage(this.walletId, { limit: 1 }, (err, addresses) => {
        if (err) return cb(err);
        if (addresses?.length) {
          const x = addresses[0];
          ChainService.addressFromStorageTransform(wallet.chain, wallet.network, x);
          return cb(null, x);
        }
        return createNewAddress(wallet, cb);
      });
    };

    this.getWallet({ doNotMigrate: opts.doNotMigrate }, (err, wallet) => {
      if (err) return cb(err);

      if (ChainService.isSingleAddress(wallet.chain)) {
        opts.ignoreMaxGap = true;
        opts.singleAddress = true;
      }

      this._canCreateAddress(opts.ignoreMaxGap || opts.singleAddress || wallet.singleAddress, (err, canCreate) => {
        if (err) return cb(err);
        if (!canCreate) return cb(Errors.MAIN_ADDRESS_GAP_REACHED);

        this._runLocked(
          cb,
          cb => {
            this.getWallet({ doNotMigrate: opts.doNotMigrate }, (err, wallet) => {
              if (err) return cb(err);
              if (!wallet.isComplete()) return cb(Errors.WALLET_NOT_COMPLETE);
              if (wallet.scanStatus == 'error') return cb(Errors.WALLET_NEED_SCAN);

              const createFn = opts.singleAddress || wallet.singleAddress ? getFirstAddress : createNewAddress;
              return createFn(wallet, (err, address) => {
                if (err) {
                  return cb(err);
                }
                return cb(err, address);
              });
            });
          },
          10 * 1000
        );
      });
    });
  }

  /**
   * Get all addresses.
   * @returns {Address[]}
   */

  getAddresses(opts: GetAddressesOpts, cb) {
    opts = opts || {};
    const { noChange, addresses: only, reverse, skip, limit } = opts;
    this.storage.fetchAddressesPage(this.walletId, { noChange, addresses: only, reverse, skip, limit }, (err, addresses) => {
      if (err) return cb(err);

      this.getWallet({}, (err, wallet) => {
        if (err) return cb(err);
        for (const x of addresses) {
          ChainService.addressFromStorageTransform(wallet.chain, wallet.network, x);
        }
        return cb(null, addresses);
      });
    });

  }

  /**
   * Verifies that a given message was actually sent by an authorized copayer.
   * @param {Object} opts
   * @param {string} opts.message - The message to verify.
   * @param {string} opts.signature - The signature of message to verify.
   * @returns {truthy} The result of the verification.
   */
  verifyMessageSignature(opts, cb) {
    if (!checkRequired(opts, ['message', 'signature'], cb)) return;

    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);

      const copayer = wallet.getCopayer(this.copayerId);

      const isValid = !!this._getSigningKey(opts.message, opts.signature, copayer.requestPubKeys);
      return cb(null, isValid);
    });
  }

  _getBlockchainExplorer(chain, network): V8 | undefined {
    let opts: Partial<{
      provider: string;
      chain: string;
      network: string;
      userAgent: string;
    }> = {};

    let provider;

    // blockchainExplorerOpts has lowercased fields
    chain = chain.toLowerCase();

    if (this.blockchainExplorer) return this.blockchainExplorer;
    if (this.blockchainExplorerOpts) {
      // chain and network can come from a request: look up own keys only, and copy what's found
      //  so the configured options (or an inherited object such as Object.prototype) are never written to
      const chainNetworkOpts = Utils.getOwn(Utils.getOwn(this.blockchainExplorerOpts, chain), network);
      const networkOpts = Utils.getOwn(this.blockchainExplorerOpts, network);
      if (chainNetworkOpts) {
        opts = { ...chainNetworkOpts };
        provider = opts.provider;
      } else if (networkOpts) {
        opts = { ...networkOpts };
      }
    }
    opts.provider = provider;
    opts.chain = chain;
    opts.network = Utils.getNetworkName(chain, network);
    opts.userAgent = WalletService.getServiceVersion();
    let bc: V8;
    try {
      bc = BlockChainExplorer(opts);
    } catch (ex) {
      this.logw('Could not instantiate blockchain explorer:', ex);
    }
    return bc;
  }

  getUtxosForCurrentWallet(opts, cb) {
    opts = opts || {};

    const utxoKey = utxo => utxo.txid + '|' + utxo.vout;

    let allAddresses,
      allUtxos,
      utxoIndex,
      addressStrs: string[],
      bc: V8,
      wallet: Wallet,
      blockchainHeight: number;
    async.series(
      [
        next => {
          const useWallet = (err, w) => {
            if (err) return next(err);

            wallet = w;

            if (wallet.scanStatus == 'error') return cb(Errors.WALLET_NEED_SCAN);

            bc = this._getBlockchainExplorer(wallet.chain, wallet.network);
            if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
            return next();
          };
          // the balance code passes the wallet it already has
          if (opts.wallet) return useWallet(null, opts.wallet);
          this.getWallet({}, useWallet);
        },
        next => {
          if (Array.isArray(opts.addresses)) {
            allAddresses = opts.addresses;
            return next();
          }

          // even with Grouping we need address for pubkeys and path (see last step)
          this.storage.fetchAddresses(this.walletId, (err, addresses) => {
            for (const x of addresses) {
              ChainService.addressFromStorageTransform(wallet.chain, wallet.network, x);
            }
            allAddresses = addresses;
            if (allAddresses.length == 0) return cb(null, []);

            return next();
          });
        },
        next => {
          return next();
        },
        next => {
          if (!wallet.isComplete()) return next();
          this._getBlockchainHeight(wallet.chain, wallet.network, (err, height, _hash) => {
            if (err) return next(err);
            blockchainHeight = height;
            next();
          });
        },
        next => {
          if (!wallet.isComplete()) return next();

          const dustThreshold = Bitcore_[wallet.chain].Transaction.DUST_AMOUNT;
          const isEscrowPayment = wallet.isZceCompatible() && opts.instantAcceptanceEscrow ? true : false;
          const replaceTxByFee = opts.replaceTxByFee ? true : false;
          bc.getUtxos(
            wallet,
            blockchainHeight,
            (err, utxos) => {
              if (err) return next(err);
              if (utxos.length == 0) return cb(null, []);

              let unusableAddresses = [];
              if (isEscrowPayment) {
                const unusableUtxos = utxos.filter(utxo => utxo.spent || utxo.address.startsWith('p'));
                unusableAddresses = unusableUtxos.map(utxo => utxo.address);
              }

              allUtxos = utxos.filter(x => x.satoshis >= dustThreshold && !unusableAddresses.includes(x.address));

              return next();
            },
            { includeSpent: isEscrowPayment || replaceTxByFee }
          );
        },
        next => {
          if (!wallet.isComplete() || !wallet.isZceCompatible()) return next();

          // Ensure no UTXOs which originate from addresses that were recently used to fund a currently
          // insufficiently confirmed ZCE-secured payment can be used to fund any subsequent transactions
          // until the ZCE-secured payment (and escrow reclaim tx) receives 11 confirmations.
          // Rationale: https://github.com/bitjson/bch-zce#wallet-utxo-selection

          const bchRollingBlockCheckpointNumber = 10;
          const bchReorgSafeBlockHeight = blockchainHeight - bchRollingBlockCheckpointNumber - 1;
          let lockedAddresses = [];
          bc.getTransactions(wallet, bchReorgSafeBlockHeight, (err, txs) => {
            if (err) return next(err);
            const unconfirmedZceTxs = txs.filter(tx => tx.category === 'move' && tx.address.startsWith('p'));
            async.each(
              unconfirmedZceTxs,
              (tx: any, next) => {
                this.getCoinsForTx({ txId: tx.txid }, (err, coins) => {
                  if (err) return next(err);
                  const inputAddresses = coins.inputs.map(input => input.address);
                  lockedAddresses = [...lockedAddresses, ...inputAddresses];
                  return next();
                });
              },
              err => {
                if (err) return next(err);
                allUtxos = allUtxos.map(utxo => {
                  if (lockedAddresses.includes(utxo.address)) {
                    utxo.locked = true;
                  }
                  return utxo;
                });
                return next();
              }
            );
          });
        },
        next => {
          utxoIndex = _.keyBy(allUtxos, utxoKey);

          this.getPendingTxs({ numberFormat: opts.numberFormat, wallet }, (err, txps) => {
            if (err) return next(err);

            const lockedInputs = txps.flatMap(t => t.inputs).map(utxoKey);
            for (const input of lockedInputs) {
              if (utxoIndex[input]) {
                utxoIndex[input].locked = true;
              }
            }
            logger.debug(`Got ${lockedInputs.length} locked utxos`);
            return next();
          });
        },
        next => {
          const now = Math.floor(Date.now() / 1000);
          // Fetch latest broadcasted txs and remove any spent inputs from the
          // list of UTXOs returned by the block explorer. This counteracts any out-of-sync
          // effects between broadcasting a tx and getting the list of UTXOs.
          // This is especially true in the case of having multiple instances of the block explorer.
          this.storage.fetchBroadcastedTxs(
            this.walletId,
            {
              minTs: now - 24 * 3600,
              limit: 100
            },
            (err, txs) => {
              if (err) return next(err);
              const spentInputs = txs.flatMap(t => t.inputs).map(utxoKey);
              const txIdArray = opts.inputs?.map(i => i.txid) || [];

              for (const input of spentInputs) {
                if (utxoIndex[input]) {
                  utxoIndex[input].spent = true;
                }
              }
              // except spent inputs of the RBF transaction if it's a replacement
              allUtxos = allUtxos.filter(utxo => {
                return !(
                  (!opts.replaceTxByFee && utxo.spent) ||
                  (utxo.spent && opts.replaceTxByFee && !txIdArray.includes(utxo.txid))
                );
              });
              logger.debug(`Got ${allUtxos.length} usable UTXOs`);
              return next();
            },
            wallet
          );
        },
        next => {
          // Needed for the clients to sign UTXOs
          const addressToPath = _.keyBy(allAddresses, 'address');
          for (const utxo of allUtxos) {
            if (!addressToPath[utxo.address]) {
              if (!opts.addresses) this.logw('Ignored UTXO!: ' + utxo.address);
              continue;
            }
            utxo.path = addressToPath[utxo.address].path;
            utxo.publicKeys = addressToPath[utxo.address].publicKeys;
            utxo.isChange = addressToPath[utxo.address].isChange;
          }
          return next();
        },
        next => {
          if (this._isSupportToken(wallet)) {
            this.storage.fetchAddresses(this.walletId, async (err, addresses) => {
              if (err) return next(err);
              if (_.size(addresses) < 1 || !addresses[0].address) return next('no addresss');
              let promiseList = [];
              _.each(addresses, address => {
                promiseList.push(this._getUxtosByChronik(wallet.chain, address));
              });

              await Promise.all(promiseList)
                .then(async utxos => {
                  utxos = utxos.reduce((accumulator, value) => accumulator.concat(value), []);
                  const utxoNonSlpChronik = _.filter(utxos, item => item.isNonSLP);
                  allUtxos = this._filterOutSlpUtxo(utxoNonSlpChronik, _.cloneDeep(allUtxos));
                  return next();
                })
                .catch(err => {
                  return next(err);
                });
            });
          } else {
            return next();
          }
        }
      ],
      (err: any) => {
        // TODO`
        if (err && err.statusCode == 404) {
          return this.registerWalletV8(wallet, cb);
        }
        return cb(err, allUtxos);
      }
    );
  }

  _filterOutSlpUtxo(utxoNonSlpChronik, allUtxos) {
    const utxoNonSlp = [];
    _.forEach(utxoNonSlpChronik, itemUtxos => {
      const utxosNonSlp = _.find(allUtxos, item => item.txid == itemUtxos.txid && item.vout == itemUtxos.outIdx);
      if (utxosNonSlp) utxoNonSlp.push(utxosNonSlp);
    });
    return utxoNonSlp;
  }

  _isSupportToken(wallet: any): boolean {
    const isSupportToken = _.get(config, `supportToken[${wallet.chain}].isSupportToken`, false);
    return wallet.isSlpToken && isSupportToken;
  }

  /**
   * Returns list of UTXOs
   * @param {Object} opts
   * @param {Array} [opts.addresses] - List of addresses. options. only one address is supported
   * @returns {Array} utxos - List of UTXOs.
   */
  getUtxos(opts, cb) {
    opts = opts || {};

    if (opts.coin) {
      return cb(new ClientError('coins option no longer supported'));
    }

    if (opts.addresses) {
      if (opts.addresses.length > 1) return cb(new ClientError('Addresses option only support 1 address'));

      this.getWallet({}, (err, wallet) => {
        if (err) return cb(err);
        console.log('wallet:', wallet.chain, wallet.network);
        const bc = this._getBlockchainExplorer(wallet.chain, wallet.network);
        if (!bc) {
          return cb(new Error('Could not get blockchain explorer instance'));
        }

        const address = opts.addresses[0];
        const A = Bitcore_[wallet.chain].Address;
        let addrObj: { network?: { name?: string } } = {};
        try {
          addrObj = new A(address);
        } catch {
          return cb(null, []);
        }
        if (!Utils.compareNetworks(addrObj.network.name.toLowerCase(), wallet.network.toLowerCase(), wallet.chain)) {
          return cb(null, []);
        }

        this._getBlockchainHeight(wallet.chain, wallet.network, (err, height, _hash) => {
          if (err) return cb(err);
          bc.getAddressUtxos(address, height, (err, allUtxos) => {
            if (err) return cb(err);
            if (this._isSupportToken(wallet)) {
              this.storage.fetchAddresses(this.walletId, async (err, addresses) => {
                if (err) return cb(err);
                if (_.size(addresses) < 1 || !addresses[0].address) return cb('no addresss');
                let promiseList = [];
                _.each(addresses, address => {
                  promiseList.push(this._getUxtosByChronik(wallet.chain, address));
                });
                await Promise.all(promiseList)
                  .then(async utxos => {
                    utxos = utxos.reduce((accumulator, value) => accumulator.concat(value), []);
                    const utxoNonSlpChronik = _.filter(utxos, item => item.isNonSLP);
                    allUtxos = this._filterOutSlpUtxo(utxoNonSlpChronik, _.cloneDeep(allUtxos));
                    return cb(null, allUtxos);
                  })
                  .catch(err => {
                    return cb(err);
                  });
              });
            } else {
              return cb(null, allUtxos);
            }
          });
        });
      });
    } else {
      this.getUtxosForCurrentWallet({}, cb);
    }
  }

  getUtxosForSelectedAddressAndWallet(opts, cb) {
    opts = opts || {};

    if (opts.addresses) {
      if (opts.addresses.length > 1) return cb(new ClientError('Addresses option only support 1 address'));

      let wallet = opts;

      const bc = this._getBlockchainExplorer(wallet.chain, wallet.network);
      if (!bc) {
        return cb(new Error('Could not get blockchain explorer instance'));
      }

      const address = opts.addresses[0];
      const A = Bitcore_[wallet.chain].Address;
      let addrObj: { network?: { name?: string } } = {};
      try {
        addrObj = new A(address);
      } catch (ex) {
        return cb(null, []);
      }
      if (addrObj.network.name != wallet.network) {
        return cb(null, []);
      }

      this._getBlockchainHeight(wallet.chain, wallet.network, (err, height, hash) => {
        if (err) return cb(err);
        bc.getAddressUtxos(address, height, async (err, allUtxos) => {
          if (err) return cb(err);
          let promiseList = [];
          if (wallet.isTokenSupport) {
            this._getUxtosByChronikOnlyByAddress(wallet.chain, address)
              .then(utxos => {
                // utxos = utxos.reduce((accumulator, value) => accumulator.concat(value), []);
                // const utxoNonSlpChronik = _.filter(utxos, item => !item.isNonSLP && item.slpMeta.tokenId === wallet.tokenId);
                // allUtxos = this._filterOutSlpUtxo(utxoNonSlpChronik, _.cloneDeep(allUtxos));
                const filteredUtxos = _.filter(
                  utxos,
                  item => !item.isNonSLP && item.slpMeta.tokenId === wallet.tokenId
                );
                return cb(null, filteredUtxos);
              })
              // await Promise.all(promiseList)
              //   .then(async
              //   })
              .catch(err => {
                return cb(err);
              });
          } else {
            return cb(null, allUtxos);
          }
        });
      });
    }
  }

  /**
   * Returns list of Coins for TX
   * @param {Object} opts
   * @param {string} opts.coin - The coin of the transaction.
   * @param {string} opts.network - the network of the transaction.
   * @param {string} opts.txId - the transaction id.
   * @returns {Obejct} coins - Inputs and Outputs of the transaction.
   */
  getCoinsForTx(opts, cb) {
    this.getWallet({}, (err, wallet) => {
      if (!ChainService.isUTXOChain(wallet.chain)) {
        // this prevents old BWC clients to break
        return cb(null, {
          inputs: [],
          outputs: []
        });
      }
      const bc = this._getBlockchainExplorer(wallet.chain, wallet.network);
      if (!bc) {
        return cb(new Error('Could not get blockchain explorer instance'));
      }

      bc.getCoinsForTx(opts.txId, (err, coins) => {
        if (err) return cb(err);
        return cb(null, coins);
      });
    });
  }

  /**
   * Returns tx Detail by txid (function support XEC and XPI )
   * @param {string} txId - the transaction id.
   * @returns {Obejct} tx detail
   */
  getTxDetail(txId, cb) {
    this.getWallet({}, async (err, wallet) => {
      try {
        const chronikClient: ChronikClient | LegacyChronikClient =
          wallet.chain === 'xec'
            ? ChainService.getChronikClient(wallet.chain)
            : ChainService.getLegacyChronikClient(wallet.chain);
        const txDetail: Tx | LegacyTx = await chronikClient.tx(txId);
        if (!txDetail) return cb('no txDetail');
        const inputAddresses = _.uniq(
          _.map(txDetail.inputs, (item: TxInput | LegacyTxInput) => {
            return this._convertAddressFormInputScript(item.inputScript, wallet.chain, true);
          })
        );
        const outputAddresses = _.uniq(
          _.map(txDetail.outputs, (item: TxOutput | LegacyTxOutput) => {
            return this._convertAddressFormInputScript(item.outputScript, wallet.chain, true);
          })
        );
        if (inputAddresses) {
          (txDetail as any).inputAddresses = inputAddresses;
          (txDetail as any).outputAddresses = outputAddresses;
          this.storage.updateCacheTxHistoryByTxId(wallet.id, txId, inputAddresses, (err, result) => {
            if (err) return cb(err);
            return cb(null, txDetail);
          });
        } else {
          return cb(null, txDetail);
        }
      } catch (err) {
        return cb(err);
      }
    });
  }

  /**
   * @param {string} txId - the transaction id.
   * @returns {Obejct} tx detail
   */
  async getTxDetailForXecWallet(txId, cb) {
    try {
      const chronikClient = ChainService.getChronikClient('xec');
      const txDetail: Tx = await chronikClient.tx(txId);
      if (!txDetail) return cb('no txDetail');
      const inputAddresses = _.uniq(
        _.map(txDetail.inputs, item => {
          return this._convertAddressFormInputScript(item.inputScript, 'xec', !!item.token);
        })
      );
      const outputAddresses = _.uniq(
        _.map(txDetail.outputs, item => {
          return this._convertAddressFormInputScript(item.outputScript, 'xec', !!item.token);
        })
      );
      if (inputAddresses) {
        (txDetail as any).inputAddresses = inputAddresses;
        (txDetail as any).outputAddresses = outputAddresses;
        return cb(null, txDetail);
      } else {
        return cb(null, txDetail);
      }
    } catch (err) {
      return cb(err);
    }
  }

  /**
   * @param {string} txId - the transaction id.
   * @returns {Obejct} tx detail
   */
  async getTxDetailForXecWalletWithPromise(txId): Promise<any> {
    return new Promise(async (resolve, reject) => {
      try {
        const chronikClient = ChainService.getChronikClient('xec');
        const txDetail: Tx = await chronikClient.tx(txId);
        if (!txDetail) return reject('no txDetail');
        const inputAddresses = _.uniq(
          _.map(txDetail.inputs, item => {
            return this._convertAddressFormInputScript(item.inputScript, 'xec', !!item.token);
          })
        );
        const outputAddresses = _.uniq(
          _.map(txDetail.outputs, item => {
            return this._convertAddressFormInputScript(item.outputScript, 'xec', !!item.token);
          })
        );
        if (inputAddresses) {
          (txDetail as any).inputAddresses = inputAddresses;
          (txDetail as any).outputAddresses = outputAddresses;
          return resolve(txDetail);
        } else {
          return resolve(txDetail);
        }
      } catch (err) {
        return reject(err);
      }
    });
  }

  /**
   * @param {string} txId - the transaction id.
   * @returns {Obejct} tx detail
   */
  async getTxDetailForWallet(txId, coin, cb) {
    try {
      const chronikClient: ChronikClient | LegacyChronikClient =
        coin === 'xec' ? ChainService.getChronikClient(coin) : ChainService.getLegacyChronikClient(coin);

      if (coin == 'xec') {
        const txDetail: Tx = await (chronikClient as ChronikClient).tx(txId);
        if (!txDetail) return cb('no txDetail');

        const inputAddresses = _.uniq(
          _.map(txDetail.inputs, item => {
            return this._convertAddressFormInputScript(item.inputScript, coin, !!item.token);
          })
        );
        const outputAddresses = _.uniq(
          _.map(txDetail.outputs, item => {
            return this._convertAddressFormInputScript(item.outputScript, coin, !!item.token);
          })
        );
        if (inputAddresses) {
          (txDetail as any).inputAddresses = inputAddresses;
          (txDetail as any).outputAddresses = outputAddresses;
          return cb(null, txDetail);
        } else {
          return cb(null, txDetail);
        }
      } else {
        const txDetail = (await (chronikClient as unknown as LegacyChronikClient).tx(txId)) as LegacyTx;
        if (!txDetail) return cb('no txDetail');
        const inputAddresses = _.uniq(
          _.map(txDetail.inputs, item => {
            return this._convertAddressFormInputScript(item.inputScript, coin, !!item.slpToken);
          })
        );
        const outputAddresses = _.uniq(
          _.map(txDetail.outputs, item => {
            return this._convertAddressFormInputScript(item.outputScript, coin, !!item.slpToken);
          })
        );
        if (inputAddresses) {
          (txDetail as any).inputAddresses = inputAddresses;
          (txDetail as any).outputAddresses = outputAddresses;
          return cb(null, txDetail);
        } else {
          return cb(null, txDetail);
        }
      }
    } catch (err) {
      return cb(err);
    }
  }

  /**
   * @param {string} txId - the transaction id.
   * @returns {Obejct} tx detail
   */
  async getTxDetailForWalletWithPromise(txId, coin): Promise<any> {
    return new Promise(async (resolve, reject) => {
      try {
        const chronikClient: ChronikClient | LegacyChronikClient =
          coin === 'xec' ? ChainService.getChronikClient(coin) : ChainService.getLegacyChronikClient(coin);

        if (coin == 'xec') {
          const txDetail: Tx = await (chronikClient as ChronikClient).tx(txId);
          if (!txDetail) return reject('no txDetail');

          const inputAddresses = _.uniq(
            _.map(txDetail.inputs, item => {
              return this._convertAddressFormInputScript(item.inputScript, coin, !!item.token);
            })
          );
          const outputAddresses = _.uniq(
            _.map(txDetail.outputs, item => {
              return this._convertAddressFormInputScript(item.outputScript, coin, !!item.token);
            })
          );
          if (inputAddresses) {
            (txDetail as any).inputAddresses = inputAddresses;
            (txDetail as any).outputAddresses = outputAddresses;
            return resolve(txDetail);
          } else {
            return resolve(txDetail);
          }
        } else {
          const txDetail: LegacyTx = await (chronikClient as unknown as LegacyChronikClient).tx(txId);
          if (!txDetail) return reject('no txDetail');
          const inputAddresses = _.uniq(
            _.map(txDetail.inputs, item => {
              return this._convertAddressFormInputScript(item.inputScript, coin, !!item.slpToken);
            })
          );
          const outputAddresses = _.uniq(
            _.map(txDetail.outputs, item => {
              return this._convertAddressFormInputScript(item.outputScript, coin, !!item.slpToken);
            })
          );
          if (inputAddresses) {
            (txDetail as any).inputAddresses = inputAddresses;
            (txDetail as any).outputAddresses = outputAddresses;
            return resolve(txDetail);
          } else {
            return resolve(txDetail);
          }
        }
      } catch (err) {
        return reject(err);
      }
    });
  }

  /**
   * Get wallet balance.
   * @param {Object} opts
   * @returns {Object} balance - Total amount & locked amount.
   */

  getBalance(opts, cb) {
    opts = opts || {};

    if (opts.coin) {
      return cb(new ClientError('coin is not longer supported in getBalance'));
    }
    let wallet = opts.wallet;

    const setWallet = cb1 => {
      if (wallet) return cb1();
      this.getWallet({}, (err, ret) => {
        if (err) return cb(err);
        wallet = ret;
        return cb1(null, wallet);
      });
    };

    setWallet(() => {
      if (!wallet.isComplete()) {
        const emptyBalance = {
          totalAmount: 0,
          lockedAmount: 0,
          totalConfirmedAmount: 0,
          lockedConfirmedAmount: 0,
          availableAmount: 0,
          availableConfirmedAmount: 0
        };
        return cb(null, emptyBalance);
      }

      this.syncWallet(wallet, err => {
        if (err) return cb(err);
        return ChainService.getWalletBalance(this, wallet, opts, cb);
      });
    });
  }

  getBalanceWithPromise(opts) {
    return new Promise((resolve, reject) => {
      this.getBalance(opts, (err, balance) => {
        if (err) return reject(err);
        else
          return resolve({
            walletId: opts.walletId,
            coin: opts.coinCode,
            network: opts.network,
            balance
          });
      });
    });
  }

  getBalanceDonation(opts, cb) {
    opts = opts || {};
    if (opts.coin) {
      return cb(new ClientError('coin is not longer supported in getBalance'));
    }
    let wallet = opts.wallet;
    this.walletId = config.donationWalletId;
    const setWallet = cb1 => {
      const walletIdDonation = config.donationWalletId;
      if (wallet) return cb1();
      this.getWalletFromIdentifier(walletIdDonation, (err, ret) => {
        if (err) return cb(err);
        wallet = ret;
        return cb1(null, wallet);
      });
    };

    setWallet(() => {
      if (!wallet.isComplete()) {
        const emptyBalance = {
          totalAmount: 0,
          lockedAmount: 0,
          totalConfirmedAmount: 0,
          lockedConfirmedAmount: 0,
          availableAmount: 0,
          availableConfirmedAmount: 0
        };
        return cb(null, emptyBalance);
      }

      this.syncWallet(wallet, err => {
        if (err) return cb(err);
        return ChainService.getWalletBalance(this, wallet, opts, cb);
      });
    });
  }

  getRemainingAmount(receiveAmountLotus, cb) {
    this.storage.fetchDonationInToday((err, donationInToday: DonationStorage) => {
      if (err) return 0;
      if (_.isEmpty(donationInToday)) return cb(config.donationRemaining.totalAmountLotusInDay);
      const remaningAmount =
        config.donationRemaining.totalAmountLotusInDay - _.size(donationInToday) * receiveAmountLotus;
      return cb(remaningAmount);
    });
  }

  _getUxtosByChronik(coin, addressInfo) {
    let scriptPayload;
    let address = addressInfo.address;
    if (address.includes('ecash:')) {
      address = address.replace(/ecash:/, '');
    }
    try {
      scriptPayload = ChainService.convertAddressToScriptPayload(coin, address);
      if (coin === 'xec') {
        let chronikClient: ChronikClient = ChainService.getChronikClient(coin);
        return chronikClient
          .script('p2pkh', scriptPayload)
          .utxos()
          .then(chronikUtxos => {
            const utxos = _.map(chronikUtxos.utxos, (utxo: ScriptUtxo) => {
              return {
                txid: utxo.outpoint.txid,
                outIdx: utxo.outpoint.outIdx,
                value: Number(utxo.sats),
                isNonSLP: utxo.token ? false : true,
                slpMeta: utxo.token,
                tokenId: utxo.token ? utxo.token.tokenId : undefined,
                amountToken: utxo.token && utxo.token.atoms ? Number(utxo.token.atoms) : undefined
              };
            });
            return utxos;
          })
          .catch(err => {
            return Promise.reject(err);
          });
      } else {
        let chronikClient: LegacyChronikClient = ChainService.getLegacyChronikClient(coin);
        return chronikClient
          .script('p2pkh', scriptPayload)
          .utxos()
          .then(chronikUtxos => {
            const utxos = _.flatMap(chronikUtxos, scriptUtxos => {
              return _.map(scriptUtxos.utxos, utxo => ({
                addressInfo,
                txid: utxo.outpoint.txid,
                outIdx: utxo.outpoint.outIdx,
                value: Number(utxo.value),
                isNonSLP: utxo.slpToken ? false : true,
                slpMeta: utxo.slpMeta,
                tokenId: utxo.slpMeta ? utxo.slpMeta.tokenId : undefined,
                amountToken: utxo.slpToken && utxo.slpToken.amount ? Number(utxo.slpToken.amount) : undefined
              }));
            });
            return utxos;
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }
    } catch {
      return Promise.reject('err funtion _getUxtosByChronik in aws');
    }
  }

  _getUxtosByChronikOnlyByAddress(coin, address) {
    let chronikClient;
    let scriptPayload;
    if (address.includes('ecash:')) {
      address = address.replace(/ecash:/, '');
    }
    try {
      scriptPayload = ChainService.convertAddressToScriptPayload(coin, address);
      chronikClient = coin === 'xec' ? ChainService.getChronikClient(coin) : ChainService.getLegacyChronikClient(coin);
    } catch {
      return Promise.reject('err funtion _getUxtosByChronik in aws');
    }
    if (coin === 'xec') {
      return (chronikClient as ChronikClient)
        .script('p2pkh', scriptPayload)
        .utxos()
        .then((chronikUtxos: ScriptUtxos) => {
          const utxos = _.flatMap(chronikUtxos, (scriptUtxos: ScriptUtxos) => {
            return _.map(scriptUtxos.utxos, utxo => ({
              txid: utxo.outpoint.txid,
              outIdx: utxo.outpoint.outIdx,
              value: Number(utxo.sats),
              isNonSLP: utxo.token ? false : true,
              slpMeta: utxo.token,
              tokenId: utxo.token ? utxo.token.tokenId : undefined,
              amountToken: utxo.token && utxo.token.atoms ? Number(utxo.token.atoms) : undefined
            }));
          });
          return utxos;
        })
        .catch(err => {
          return Promise.reject(err);
        });
    } else {
      return (chronikClient as LegacyChronikClient)
        .script('p2pkh', scriptPayload)
        .utxos()
        .then(chronikUtxos => {
          const utxos = _.flatMap(chronikUtxos, scriptUtxos => {
            return _.map(scriptUtxos.utxos, utxo => ({
              txid: utxo.outpoint.txid,
              outIdx: utxo.outpoint.outIdx,
              value: Number(utxo.value),
              isNonSLP: utxo.slpToken ? false : true,
              slpMeta: utxo.slpMeta,
              tokenId: utxo.slpMeta ? utxo.slpMeta.tokenId : undefined,
              amountToken: utxo.slpToken && utxo.slpToken.amount ? Number(utxo.slpToken.amount) : undefined
            }));
          });
          return utxos;
        })
        .catch(err => {
          return Promise.reject(err);
        });
    }
  }

  getUtxosToken(opts, cb) {
    opts = opts || {};
    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);
      this.storage.fetchAddresses(this.walletId, async (err, addresses) => {
        if (err) return cb(err);

        if (_.size(addresses) < 1 || !addresses[0].address) return cb('no addresss');
        let promiseList = [];
        _.each(addresses, address => {
          promiseList.push(this._getUxtosByChronik(wallet.chain, address));
        });

        await Promise.all(promiseList)
          .then(async utxos => {
            utxos = utxos.reduce((accumulator, value) => accumulator.concat(value), []);
            return cb(null, utxos);
          })
          .catch(err => {
            return cb(err);
          });
      });
    });
  }

  _getAndStoreTokenInfo(coin, tokenId): Promise<TokenInfo> {
    return new Promise((resolve, reject) => {
      return this.storage.fetchTokenInfoById(tokenId, (err, tokenInfo: TokenInfo) => {
        if (err) return reject(err);
        if (tokenInfo) return resolve(tokenInfo);
        return ChainService.getTokenInfo(coin, tokenId)
          .then((data: TokenInfo) => {
            if (data && data.id) {
              this.storage.storeTokenInfo(data, err => {
                if (err) return reject(err);
                return resolve(data);
              });
            } else {
              return reject(`No info for token ${tokenId}`);
            }
          })
          .catch(err => {
            return reject(err);
          });
      });
    });
  }

  getTokensWithPromise(opts) {
    return new Promise((resolve, reject) => {
      this.getTokens(opts, (err, result) => {
        if (err) return reject(err);
        return resolve(result);
      });
    });
  }

  getTokens(opts, cb) {
    opts = opts || {};
    const walletId = opts && opts.walletId ? opts.walletId : this.walletId;
    const groupToken = [];
    const caculateAmountToken = (utxoToken, decimals) => {
      const totalAmount = _.sumBy(utxoToken, 'amountToken');
      return totalAmount / Math.pow(10, decimals);
    };
    this.getWallet({ walletId }, (err, wallet) => {
      if (err) return cb(err);
      this.storage.fetchAddresses(walletId, async (err, addresses) => {
        if (err) return cb(err);

        if (_.size(addresses) < 1 || !addresses[0].address) return cb('no addresss');
        let promiseList = [];
        _.each(addresses, address => {
          promiseList.push(this._getUxtosByChronik(wallet.chain, address));
        });

        await Promise.all(promiseList)
          .then(async data => {
            data = data.reduce((accumulator, value) => accumulator.concat(value), []);
            if (_.isEmpty(data)) return cb(null, []);
            const groupTokenId = _.groupBy(data, 'tokenId');
            for (var tokenId in groupTokenId) {
              if (tokenId == 'undefined') continue;
              if (groupTokenId.hasOwnProperty(tokenId)) {
                try {
                  const tokenInfor: TokenInfo = await this._getAndStoreTokenInfo(wallet.chain, tokenId);
                  const tokenItem = {
                    tokenId,
                    tokenInfo: tokenInfor,
                    amountToken: caculateAmountToken(groupTokenId[tokenId], tokenInfor.decimals),
                    utxoToken: groupTokenId[tokenId]
                  };
                  groupToken.push(tokenItem);
                } catch (err) {
                  return cb(err);
                }
              }
            }
            return cb(null, groupToken);
          })
          .catch(err => {
            return cb(err);
          });
      });
    });
  }

  getAllTokenInfo(cb) {
    // return new Promise((resolve, reject) => {
    this.storage.fetchTokenInfo((err, tokenInfoList) => {
      if (err) return cb(err);
      return cb(null, tokenInfoList);
    });
    // })
  }

  getRemainingInfo(opts, cb) {
    const infor: DonationInfo = {};
    this.convertUSDToSatoshiLotus(config.donationRemaining.minMoneydonation, 'xpi', receiveAmountLotus => {
      this.getRemainingAmount(receiveAmountLotus, remaningAmount => {
        infor.remaining = remaningAmount;
        infor.minMoneydonation = config.donationRemaining.minMoneydonation;
        infor.receiveAmountLotus = receiveAmountLotus;
        infor.donationToAddresses = config.donationRemaining.donationToAddresses;
        infor.donationCoin = config.donationRemaining.donationCoin;
        return cb(null, infor);
      });
    });
  }

  getWalletFundRemaining(opts, cb) {
    const infor: DonationInfo = {};
    this.convertUSDToSatoshiLotus(config.donationRemaining.minMoneydonation, 'xpi', receiveAmountLotus => {
      this.getRemainingAmount(receiveAmountLotus, remaningAmount => {
        infor.remaining = remaningAmount;
        infor.minMoneydonation = config.donationRemaining.minMoneydonation;
        infor.receiveAmountLotus = receiveAmountLotus;
        infor.donationToAddresses = config.donationRemaining.donationToAddresses;
        infor.donationCoin = config.donationRemaining.donationCoin;
        return cb(null, infor);
      });
    });
  }

  /**
   * Get wallet balance at a specific time.
   * @param {Object} opts
   * @param {string} opts.time - Date or time accepted by the bitcore-node API.
   * @returns {Object} balance - The chain-state provider balance at the requested time.
   */
  getBalanceAtTime(opts, cb) {
    opts = opts || {};
    if (!opts.time) {
      return cb(new ClientError('time is required in getBalanceAtTime'));
    }
    let wallet = opts.wallet;

    const setWallet = cb1 => {
      if (wallet) return cb1();
      this.getWallet({}, (err, ret) => {
        if (err) return cb(err);
        wallet = ret;
        return cb1(null, wallet);
      });
    };

    setWallet(() => {
      if (!wallet.isComplete()) {
        return cb(null, { confirmed: 0, unconfirmed: 0, balance: 0 });
      }

      this.syncWallet(wallet, err => {
        if (err) return cb(err);
        const bc = this._getBlockchainExplorer(wallet.chain, wallet.network);
        if (!bc) {
          return cb(new Error('Could not get blockchain explorer instance'));
        }
        return bc.getBalanceAtTime({ ...wallet, tokenAddress: opts.tokenAddress }, opts.time, cb);
      });
    });
  }

  /**
   * Return info needed to send all funds in the wallet
   * @param {Object} opts
   * @param {number} opts.feeLevel[='normal'] - Optional. Specify the fee level for this TX ('priority', 'normal', 'economy', 'superEconomy') as defined in Defaults.FEE_LEVELS.
   * @param {number} opts.feePerKb - Optional. Specify the fee per KB for this TX (in satoshi).
   * @param {string} opts.excludeUnconfirmedUtxos[=false] - Optional. Do not use UTXOs of unconfirmed transactions as inputs
   * @param {string} opts.returnInputs[=false] - Optional. Return the list of UTXOs that would be included in the tx.
   * @param {string} opts.usePayPro[=false] - Optional. Use fee estimation for paypro
   * @param {string} opts.from - Optional. Specify the sender ETH address.
   * @returns {Object} sendMaxInfo
   */
  getSendMaxInfo(opts, cb) {
    opts = opts || {};

    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);

      const feeArgs = boolToNum(!!opts.feeLevel) + boolToNum(_.isNumber(opts.feePerKb));
      if (feeArgs > 1) return cb(new ClientError('Only one of feeLevel/feePerKb can be specified'));

      if (feeArgs == 0) {
        opts.feeLevel = 'normal';
      }

      const feeLevels = Defaults.FEE_LEVELS[wallet.chain];
      if (opts.feeLevel) {
        if (!feeLevels.some(lvl => lvl.name === opts.feeLevel))
          return cb(new ClientError('Invalid fee level. Valid values are ' + feeLevels.map(lvl => lvl.name).join(', ')));
      }

      if (Utils.isNumber(opts.feePerKb)) {
        if (opts.feePerKb < Defaults.MIN_FEE_PER_KB || opts.feePerKb > Defaults.MAX_FEE_PER_KB[wallet.chain])
          return cb(new ClientError('Invalid fee per KB'));
      }

      return ChainService.getWalletSendMaxInfo(this, wallet, opts, cb);
    });
  }

  _sampleFeeLevels(chain, network, points, cb) {
    const bc = this._getBlockchainExplorer(chain, network);
    if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
    bc.estimateFee(points, (err, result) => {
      if (err) {
        this.logw('Error estimating fee:', err);
        return cb(err);
      }

      const failed = [];
      const levels = _.fromPairs(
        points.map(p => {
          const feePerKb = Utils.isObject(result) && result[p] && Utils.isNumber(result[p]) ? +result[p] : -1;
          if (feePerKb < 0) failed.push(p);

          // NOTE: ONLY BTC/BCH/DOGE/LTC expect feePerKb to be Bitcoin amounts
          // EVM expects wei, Solana expects Lamports.

          return ChainService.convertFeePerKb(chain, p, feePerKb);
        })
      );

      if (failed.length) {
        const logger = network == 'livenet' ? this.logw : this.logi;
        logger.call(this, 'Could not compute fee estimation in ' + network + ': ' + failed.join(', ') + ' blocks.');
      }

      return cb(null, levels, failed.length);
    });
  }

  estimateFee(opts) {
    opts = opts || {};
    return new Promise((resolve, reject) => {
      const bc = this._getBlockchainExplorer(opts.chain, opts.network);
      if (!bc) return reject(new Error('Could not get blockchain explorer instance'));
      bc.estimateFeeV2(opts, (err, result) => {
        if (err) {
          this.logw('Error estimating fee:', err);
          return reject(err);
        }
        return resolve(result);
      });
    });
  }

  estimatePriorityFee(opts) {
    opts = opts || {};
    return new Promise((resolve, reject) => {
      const bc = this._getBlockchainExplorer(opts.chain, opts.network);
      if (!bc) return reject(new Error('Could not get blockchain explorer instance'));
      bc.estimatePriorityFee(opts, (err, result) => {
        if (err) {
          this.logw('Error estimating priority fee:', err);
          return reject(err);
        }
        return resolve(result);
      });
    });
  }

  /**
   * Returns fee levels for the current state of the network.
   * @param {Object} opts
   * @param {string} [opts.coin = 'btc'] - The coin to estimate fee levels from.
   * @param {string} [opts.chain = 'btc'] - The coin to estimate fee levels from.
   * @param {string} [opts.network = 'livenet'] - The Bitcoin network to estimate fee levels from.
   * @returns {Object} feeLevels - A list of fee levels & associated amount per kB in satoshi.
   */
  getFeeLevels(opts, cb) {
    opts = opts || {};
    if (!opts.chain) {
      opts.chain = opts.coin; // chain === coin for stored clients
    }

    opts.chain = opts.chain || Defaults.CHAIN;
    if (!Utils.checkValueInCollection(opts.chain, Constants.CHAINS)) return cb(new ClientError('Invalid chain'));

    opts.network = Utils.getNetworkName(opts.chain, opts.network) || 'livenet';
    if (!Utils.checkValueInCollection(opts.network, Constants.NETWORKS[opts.chain])) return cb(new ClientError('Invalid network'));

    const cacheKey = 'feeLevel:' + opts.chain + ':' + opts.network;

    this.storage.checkAndUseGlobalCache(cacheKey, Defaults.FEE_LEVEL_CACHE_DURATION, (err, values, oldvalues) => {
      if (err) return cb(err);
      if (values) return cb(null, values, true);

      const feeLevels = Defaults.FEE_LEVELS[opts.chain];

      /*
      if (opts.chain === 'doge') {
        const defaultDogeFeeLevels = feeLevels[0];
        const result: {
          feePerKb?: number;
          nbBlocks?: number;
          level: string;
        } = {
          level: defaultDogeFeeLevels.name,
          nbBlocks: defaultDogeFeeLevels.nbBlocks,
          feePerKb: defaultDogeFeeLevels.defaultValue
        };
        return cb(null, [result]);
      }
      */

      const samplePoints = () => {
        const definedPoints = _.uniq(feeLevels.map(lvl => lvl.nbBlocks));
        return _.uniq(
          _.flatten(
            definedPoints.map((p: number) => {
              return _.range(p, p + Defaults.FEE_LEVELS_FALLBACK + 1);
            })
          )
        );
      };

      const getFeeLevel = (feeSamples, level, n, fallback) => {
        let result;

        if (feeSamples[n] >= 0) {
          result = {
            nbBlocks: n,
            feePerKb: feeSamples[n]
          };
        } else {
          if (fallback > 0) {
            result = getFeeLevel(feeSamples, level, n + 1, fallback - 1);
          } else {
            result = {
              feePerKb: level.defaultValue,
              nbBlocks: null
            };
          }
        }
        return result;
      };

      this._sampleFeeLevels(opts.chain, opts.network, samplePoints(), (err, feeSamples, failed) => {
        if (err) {
          if (oldvalues) {
            this.logw('##  There was an error estimating fees. Using old cached values. Error:', err);
            return cb(null, oldvalues, true);
          }
        }

        const values = feeLevels.map(level => {
          const result: {
            feePerKb?: number;
            nbBlocks?: number;
            level: string;
          } = {
            level: level.name
          };
          if (err) {
            result.feePerKb = level.defaultValue;
            result.nbBlocks = null;
          } else {
            const feeLevel = getFeeLevel(feeSamples, level, level.nbBlocks, Defaults.FEE_LEVELS_FALLBACK);
            result.feePerKb = +(feeLevel.feePerKb * (level.multiplier || 1)).toFixed(0);
            result.nbBlocks = feeLevel.nbBlocks;
          }
          return result;
        });

        // Ensure monotonically decreasing values
        for (let i = 1; i < values.length; i++) {
          values[i].feePerKb = Math.min(values[i].feePerKb, values[i - 1].feePerKb);
        }

        if (failed > 0) {
          this.logw('Not caching default values. Failed: ' + failed);
          return cb(null, values);
        }

        this.storage.storeGlobalCache(cacheKey, values, err => {
          if (err) {
            this.logw('Could not store fee level cache:', err);
          }
          return cb(null, values);
        });
      });
    });
  }

  _canCreateTx(cb) {
    this.storage.fetchLastTxs(this.walletId, this.copayerId, 5 + Defaults.BACKOFF_OFFSET, (err, txs) => {
      if (err) return cb(err);

      if (!txs.length) return cb(null, true);

      const lastRejections = _.takeWhile(txs, {
        status: 'rejected'
      });

      const exceededRejections = lastRejections.length - Defaults.BACKOFF_OFFSET;
      if (exceededRejections <= 0) return cb(null, true);

      const lastTxTs = txs[0].createdOn;
      const now = Math.floor(Date.now() / 1000);
      const timeSinceLastRejection = now - lastTxTs;
      const backoffTime = Defaults.BACKOFF_TIME;

      if (timeSinceLastRejection <= backoffTime)
        this.logd('Not allowing to create TX: timeSinceLastRejection/backoffTime', timeSinceLastRejection, backoffTime);

      return cb(null, timeSinceLastRejection > backoffTime);
    });
  }

  _validateOutputs(opts, wallet) {
    if (_.isEmpty(opts.outputs)) return new ClientError('No outputs were specified');

    for (let i = 0; i < opts.outputs.length; i++) {
      const output = opts.outputs[i];
      output.valid = false;

      if (ChainService.isUTXOChain(wallet.chain) && output.script) {
        const error = ChainService.checkScriptOutput(wallet.chain, output);
        if (error) return error;
        output.valid = true;
      } else {
        try {
          ChainService.validateAddress(wallet, output.toAddress, opts);
        } catch (addrErr) {
          return addrErr;
        }

        if (!checkRequired(output, ['toAddress', 'amount'])) {
          return new ClientError('Argument missing in output #' + (i + 1) + '.');
        }

        if (!ChainService.checkValidTxAmount(wallet.chain, output)) {
          return new ClientError('Invalid amount');
        }

        const error = ChainService.checkDust(wallet.chain, output, opts);
        if (error) return error;
        output.valid = true;
      }
    }
    return null;
  }

  _validateAndSanitizeTxOpts(wallet, opts, cb) {
    const gasFeeFields = ['gasPrice', 'maxGasFee', 'priorityGasFee'];
    const hasGasFeeOverride = gasFeeFields.some(key => opts[key] != null);
    if (hasGasFeeOverride) {
      if (!Constants.EVM_CHAINS[wallet.chain.toUpperCase()]) {
        return cb(new ClientError('Gas fee overrides are only supported for EVM chains'));
      }
      for (const key of gasFeeFields) {
        if (opts[key] != null && (!Number.isSafeInteger(opts[key]) || opts[key] <= 0)) {
          return cb(new ClientError(`${key} must be a positive safe integer in wei`));
        }
      }
      if (opts.gasPrice != null && Number(opts.txType || 0) !== 0) {
        return cb(new ClientError('gasPrice requires a type 0 transaction'));
      }
      if ((opts.maxGasFee != null || opts.priorityGasFee != null) && Number(opts.txType) !== 2) {
        return cb(new ClientError('maxGasFee and priorityGasFee require a type 2 transaction'));
      }
      if ((opts.maxGasFee != null) !== (opts.priorityGasFee != null)) {
        return cb(new ClientError('maxGasFee and priorityGasFee must be supplied together'));
      }
      if (opts.priorityGasFee > opts.maxGasFee) {
        return cb(new ClientError('priorityGasFee must not exceed maxGasFee'));
      }
      if (opts.feePerKb != null || opts.fee != null) {
        return cb(new ClientError('Gas fee overrides cannot be combined with feePerKb or fee'));
      }
      // sendMax calculates its amount before getFee, using a separate fee estimate.
      if (opts.sendMax) {
        return cb(new ClientError('Gas fee overrides are not supported with sendMax'));
      }
    }
    async.series(
      [
        next => {
          const feeArgs =
            boolToNum(!!opts.feeLevel) + boolToNum(Utils.isNumber(opts.feePerKb)) + boolToNum(Utils.isNumber(opts.fee));
          if (feeArgs > 1) return next(new ClientError('Only one of feeLevel/feePerKb/fee can be specified'));

          if (feeArgs == 0 && !hasGasFeeOverride) {
            opts.feeLevel = 'normal';
          }

          const feeLevels = Defaults.FEE_LEVELS[wallet.chain];
          if (opts.feeLevel) {
            if (!feeLevels.some(lvl => lvl.name === opts.feeLevel))
              return next(
                new ClientError('Invalid fee level. Valid values are ' + feeLevels.map(lvl => lvl.name).join(', '))
              );
          }

          // An explicit gas fee determines the price, not the named fee level.
          if (hasGasFeeOverride) {
            delete opts.feeLevel;
          }

          const error = ChainService.checkUtxos(wallet.chain, opts);
          if (error) {
            if (Array.isArray(opts.inputs)) return next(Errors.INSUFFICIENT_FUNDS);
            return next(new ClientError('fee can only be set when inputs are specified'));
          }
          next();
        },
        next => {
          if (wallet.singleAddress && opts.changeAddress)
            return next(new ClientError('Cannot specify change address on single-address wallet'));
          next();
        },

        next => {
          if (!opts.sendMax) return next();
          if (!Array.isArray(opts.outputs) || opts.outputs.length > 1) {
            return next(new ClientError('Only one output allowed when sendMax is specified'));
          }
          if (Utils.isNumber(opts.outputs[0].amount))
            return next(new ClientError('Amount is not allowed when sendMax is specified'));
          if (Utils.isNumber(opts.fee))
            return next(
              new ClientError('Fee is not allowed when sendMax is specified (use feeLevel/feePerKb instead)')
            );

          this.getSendMaxInfo(
            {
              feeLevel: opts.feeLevel,
              feePerKb: opts.feePerKb,
              excludeUnconfirmedUtxos: !!opts.excludeUnconfirmedUtxos,
              returnInputs: true,
              numSignatures: opts.numSignatures,
              txType: opts.txType
            },
            (err, info) => {
              if (err) return next(err);
              if (Array.isArray(info.inputs) && !info.inputs.length) return next(Errors.INSUFFICIENT_FUNDS);
              opts.outputs[0].amount = info.amount;
              opts.inputs = info.inputs;
              return next();
            }
          );
        },
        next => {
          if (opts.validateOutputs === false) return next();
          const validationError = this._validateOutputs(opts, wallet);
          if (validationError) {
            return next(validationError);
          }
          next();
        },
        next => {
          // check outputs are on 'copay' format for BCH
          if (wallet.chain != 'bch') return next();
          if (!opts.noCashAddr) return next();

          // TODO remove one cashaddr is used internally (noCashAddr flag)?
          opts.origAddrOutputs = opts.outputs.map(x => {
            const ret: {
              toAddress?: string;
              amount?: number;
              message?: string;
              script?: string;
            } = {
              toAddress: x.toAddress,
              amount: x.amount
            };
            if (x.message) ret.message = x.message;
            if (x.script) ret.script = x.script;

            return ret;
          });
          opts.returnOrigAddrOutputs = false;
          for (const x of opts.outputs) {
            if (!x.toAddress) continue;

            let newAddr;
            try {
              newAddr = Bitcore_['bch'].Address(x.toAddress).toLegacyAddress();
            } catch (e) {
              return next(e);
            }
            if (x.txAddress != newAddr) {
              x.toAddress = newAddr;
              opts.returnOrigAddrOutputs = true;
            }
          }
          next();
        }
      ],
      cb
    );
  }

  _getFeePerKb(wallet, opts, cb) {
    if (Utils.isNumber(opts.feePerKb)) return cb(null, opts.feePerKb);
    this.getFeeLevels(
      {
        chain: wallet.chain,
        network: wallet.network
      },
      (err, levels) => {
        if (err) return cb(err);
        const level = levels.find(l => l.level === opts.feeLevel);
        if (!level) {
          const msg = `Could not compute fee for "${opts.feeLevel}" level`;
          this.logw(msg);
          return cb(new ClientError(msg));
        }
        return cb(null, level.feePerKb);
      }
    );
  }

  getFee(coinInfo, opts): Promise<any> {
    return new Promise((resolve, reject) => {
      // This is used for sendmax flow
      // if (_.isNumber(opts.fee)) {
      //   return resolve({ feePerKb: opts.fee });
      // }
      const coinCode = coinInfo.isToken ? 'xec' : coinInfo.code;
      this._getFeePerKb({ coin: coinCode }, opts, (err, inFeePerKb) => {
        if (err) {
          return reject(err);
        }
        let feePerKb = inFeePerKb;
        return resolve({ coin: coinInfo, feePerKb });
      });
    });
  }

  _getTransactionCount(wallet, address, cb) {
    const bc = this._getBlockchainExplorer(wallet.chain, wallet.network);
    if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
    bc.getTransactionCount(address, (err, nonce) => {
      if (err) {
        this.logw('Error estimating nonce:', err);
        return cb(err);
      }
      return cb(null, nonce);
    });
  }

  getNonce(opts) {
    const bc = this._getBlockchainExplorer(opts.chain || opts.coin || Defaults.EVM_CHAIN, opts.network);
    return new Promise((resolve, reject) => {
      if (!bc) return reject(new Error('Could not get blockchain explorer instance'));
      bc.getTransactionCount(opts.address, (err, nonce) => {
        if (err) {
          this.logw('Error estimating nonce:', err);
          return reject(err);
        }
        return resolve(nonce);
      });
    });
  }

  estimateGas(opts) {
    const bc = this._getBlockchainExplorer(opts.chain || opts.coin || Defaults.EVM_CHAIN, opts.network);
    return new Promise((resolve, reject) => {
      if (!bc) return reject(new Error('Could not get blockchain explorer instance'));
      bc.estimateGas(opts, (err, gasLimit) => {
        if (err) {
          this.logw('Error estimating gas limit:', err);
          return reject(err);
        }
        return resolve(gasLimit);
      });
    });
  }

  getMultisigContractInstantiationInfo(opts) {
    const bc = this._getBlockchainExplorer(opts.chain || Defaults.EVM_CHAIN, opts.network);
    return new Promise((resolve, reject) => {
      if (!bc) return reject(new Error('Could not get blockchain explorer instance'));
      bc.getMultisigContractInstantiationInfo(opts, (err, contractInstantiationInfo) => {
        if (err) {
          this.logw('Error getting contract instantiation info:', err);
          return reject(err);
        }
        return resolve(contractInstantiationInfo);
      });
    });
  }

  getMultisigContractInfo(opts) {
    const bc = this._getBlockchainExplorer(opts.chain || Defaults.EVM_CHAIN, opts.network);
    return new Promise((resolve, reject) => {
      if (!bc) return reject(new Error('Could not get blockchain explorer instance'));
      bc.getMultisigContractInfo(opts, (err, contractInfo) => {
        if (err) {
          this.logw('Error getting contract instantiation info:', err);
          return reject(err);
        }
        return resolve(contractInfo);
      });
    });
  }

  getTokenContractInfo(opts) {
    const bc = this._getBlockchainExplorer(opts.chain || Defaults.EVM_CHAIN, opts.network);
    return new Promise((resolve, reject) => {
      if (!bc) return reject(new Error('Could not get blockchain explorer instance'));
      bc.getTokenContractInfo(opts, (err, contractInfo) => {
        if (err) {
          this.logw('Error getting contract info:', err);
          return reject(err);
        }
        return resolve(contractInfo);
      });
    });
  }

  /**
   * Get ERC20 token allowance for a given owner/spender pair.
   * @param {Object} opts
   * @param {string} opts.chain - EVM chain name (e.g. 'eth', 'matic')
   * @param {string} opts.network - Network name (e.g. 'mainnet', 'sepolia')
   * @param {string} opts.tokenAddress - Token contract address
   * @param {string} opts.ownerAddress - Token owner address
   * @param {string} opts.spenderAddress - Spender contract address
   * @returns {Promise<number>} Token allowance amount
   */
  getTokenAllowance(opts) {
    if (!checkRequired(opts, ['chain', 'network', 'tokenAddress', 'ownerAddress', 'spenderAddress'])) {
      return Promise.reject(new ClientError('getTokenAllowance request missing arguments'));
    }
    const bc = this._getBlockchainExplorer(opts.chain, opts.network);
    return new Promise((resolve, reject) => {
      if (!bc) return reject(new Error('Could not get blockchain explorer instance'));
      bc.getTokenAllowance(opts, (err, allowance) => {
        if (err) {
          this.logw('Error getting token allowance:', err);
          return reject(err);
        }
        return resolve(allowance);
      });
    });
  }

  getMultisigTxpsInfo(opts) {
    const bc = this._getBlockchainExplorer(opts.chain || Defaults.EVM_CHAIN, opts.network);
    return new Promise((resolve, reject) => {
      if (!bc) return reject(new Error('Could not get blockchain explorer instance'));
      bc.getMultisigTxpsInfo(opts, (err, multisigTxpsInfo) => {
        if (err) {
          this.logw('Error getting contract txps hash:', err);
          return reject(err);
        }
        return resolve(multisigTxpsInfo);
      });
    });
  }

  createTx(opts, cb) {
    this._createTx(opts, (err, txp) => {
      if (err) return cb(err);
      if (opts.numberFormat) {
        txp = TxProposal.formatNumbers(txp, opts.numberFormat);
      }
      return cb(null, txp);
    });
  }


  /**
   * Creates a new transaction proposal.
   * @param {Object} opts
   * @param {String} opts.walletId - Select wallet to create tx.
   * @param {string} opts.txProposalId - Optional. If provided it will be used as this TX proposal ID. Should be unique in the scope of the wallet.
   * @param {String} opts.coin - tx coin.
   * @param {String} opts.chain - tx chain.
   * @param {Array} opts.outputs - List of outputs.
   * @param {string} opts.outputs[].toAddress - Destination address.
   * @param {number} opts.outputs[].amount - Amount to transfer in satoshi.
   * @param {string} opts.outputs[].message - A message to attach to this output.
   * @param {string} opts.message - A message to attach to this transaction.
   * @param {number} opts.feeLevel[='normal'] - Optional. Specify the fee level for this TX ('priority', 'normal', 'economy', 'superEconomy') as defined in Defaults.FEE_LEVELS.
   * @param {number} opts.feePerKb - Optional. Specify the fee per KB for this TX (in satoshi).
   * @param {string} opts.changeAddress - Optional. Use this address as the change address for the tx. The address should belong to the wallet. In the case of singleAddress wallets, the first main address will be used.
   * @param {Boolean} opts.sendMax - Optional. Send maximum amount of funds that make sense under the specified fee/feePerKb conditions. (defaults to false).
   * @param {string} opts.payProUrl - Optional. Paypro URL for peers to verify TX
   * @param {Boolean} opts.excludeUnconfirmedUtxos[=false] - Optional. Do not use UTXOs of unconfirmed transactions as inputs
   * @param {Boolean} opts.validateOutputs[=true] - Optional. Perform validation on outputs.
   * @param {Boolean} opts.dryRun[=false] - Optional. Simulate the action but do not change server state.
   * @param {Array} opts.inputs - Optional. Inputs for this TX
   * @param {Array} opts.txpVersion - Optional. Version for TX Proposal (current = 4, only =3 allowed).
   * @param {number} opts.fee - Optional. Use an fixed fee for this TX (only when opts.inputs is specified)
   * @param {Boolean} opts.noShuffleOutputs - Optional. If set, TX outputs won't be shuffled. Defaults to false
   * @param {Boolean} opts.noCashAddr - do not use cashaddress for bch
   * @param {Boolean} opts.signingMethod[=ecdsa] - do not use cashaddress for bch
   * @param {string} opts.tokenAddress - optional. ERC20 Token Contract Address
   * @param {string} opts.multisigContractAddress - optional. MULTISIG ETH Contract Address
   * @param {Boolean} opts.isTokenSwap - Optional. To specify if we are trying to make a token swap
   * @param {Boolean} opts.enableRBF - Optional. enable BTC Replace By Fee
   * @param {Boolean} opts.replaceTxByFee - Optional. Ignore locked utxos check ( used for replacing a transaction designated as RBF)
   * @param {number} opts.txType - Optional. Type of EVM transaction
   * @param {number} opts.gasPrice - Optional. Type 0 gas price in wei. Overrides feeLevel; incompatible with fee/feePerKb/sendMax.
   * @param {number} opts.maxGasFee - Optional. Type 2 maximum fee per gas in wei; requires priorityGasFee.
   * @param {number} opts.priorityGasFee - Optional. Positive type 2 priority fee per gas in wei; requires maxGasFee and must not exceed it. Gas fee overrides cannot be used with fee/feePerKb/sendMax.
   * @param {number} opts.gasLimitBuffer - Optional. Percentage of buffer to add to the gasLimit
   * @param {number} opts.priorityFeePercentile - Optional. Percentile of targeted priority fee rate
   * @param {Boolean} opts.multiTx - Optional. Proposal will create multiple transactions
   * @param {string} opts.blockHash - Optional. Recent Solana Blockhash
   * @param {number} opts.blockHeight - Optional.  Recent Solana Slot
   * @param {string} opts.nonceAddress - Optional. Address of the senders nonceAccount
   * @param {string} opts.category - Optional. Type transaction [treansfer (default*), create account, create spl account )
   * @param {Object} opts.fromKeyPair - Optional. Keypair to create an account
   * @param {number} opts.priorityFee - Optional. Percentile of targeted priority fee rate
   * @param {number} opts.computeUnits - Optional. Amount of allocated compute units
   * @param {string} opts.memo - Optional. Solana transaction memo
   * @param {number} opts.decimals - Optional. Numbet of decimal of a desited token
   * @param {string} opts.fromAta - Optional. ATA addres of the sender (Solana)
   * @param {number} opts.numSignatures - Optional. Number of signatures required for the transation. For Solana fee calculation.
   * @param {Boolean} opts.refreshOnPublish - Optional. Allows publish function to refresh txp data
   * @returns {TxProposal} Transaction proposal. outputs address format will use the same format as inpunt.
   */
  private _createTx(opts, cb) {
    opts = opts ? _.clone(opts) : {};

    const checkTxpAlreadyExists = (txProposalId, cb) => {
      if (!txProposalId) return cb();
      this.storage.fetchTx(this.walletId, txProposalId, cb);
    };

    this._runLocked(
      cb,
      cb => {
        let changeAddress, feePerKb, gasPrice, gasLimit, fee, maxGasFee, priorityGasFee;
        this.getWallet({}, (err, wallet) => {
          if (err) return cb(err);
          if (!wallet.isComplete()) return cb(Errors.WALLET_NOT_COMPLETE);

          if (wallet.scanStatus == 'error') return cb(Errors.WALLET_NEED_SCAN);

          if (config.suspendedChains && config.suspendedChains.includes(wallet.chain)) {
            const Err = Errors.NETWORK_SUSPENDED;
            Err.message = Err.message.replace('$network', wallet.chain.toUpperCase());
            return cb(Err);
          }

          checkTxpAlreadyExists(opts.txProposalId, (err, txp) => {
            if (err) return cb(err);
            if (txp) return cb(null, txp);

            async.series(
              [
                next => {
                  if (ChainService.isUTXOChain(wallet.chain)) return next();
                  this.getAddresses({ reverse: true, limit: 1, noChange: true }, (err, mainAddr) => {
                    if (err) return next(err);
                    opts.from = mainAddr[0].address;
                    next();
                  });
                },
                next => {
                  this._validateAndSanitizeTxOpts(wallet, opts, next);
                },
                next => {
                  this._canCreateTx((err, canCreate) => {
                    if (err) return next(err);
                    if (!canCreate) return next(Errors.TX_CANNOT_CREATE);
                    next();
                  });
                },
                async next => {
                  if (opts.sendMax) return next();
                  try {
                    changeAddress = await ChainService.getChangeAddress(this, wallet, opts);
                  } catch (error) {
                    return next(error);
                  }
                  return next();
                },
                async next => {
                  logger.info('Calculating fee for new tx: %o', {
                    from: opts.from, fee: opts.fee, input: opts.inputs?.length, gasLimit: opts.gasLimit, gasLimitBuffer: opts.gasLimitBuffer
                  });
                  if (!isNaN(opts.fee) && (opts.inputs || []).length > 0) return next();
                  try {
                    ({ feePerKb, gasPrice, maxGasFee, priorityGasFee, gasLimit, fee } = await ChainService.getFee(this, wallet, opts));
                    logger.info('ChainService.getFee return value %o', {
                      from: opts.from, feePerKb, gasPrice, maxGasFee, priorityGasFee, gasLimit, fee
                    });
                  } catch (error) {
                    return next(error);
                  }
                  next();
                },
                async next => {
                  // SOL is skipped since its a non necessary field that is expected to be provided by the client.
                  if (!opts.nonce && !Constants.SVM_CHAINS[wallet.chain.toUpperCase()] && !opts.deferNonce) {
                    try {
                      opts.nonce = await ChainService.getTransactionCount(this, wallet, opts.from);
                    } catch (error) {
                      return next(error);
                    }
                  }
                  return next();
                },
                async next => {
                  if (Constants.SVM_CHAINS[wallet.chain.toUpperCase()] && !opts.nonceAddress) { 
                    this._getBlockchainHeight(wallet.chain, wallet.network, (err, height, hash) => {
                      if (err) return next(err);
                      opts.blockHeight = height;
                      opts.blockHash = hash;
                      opts.refreshOnPublish = true;
                      return next();
                    });
                  } else {
                    return next();
                  }
                },
                async next => {
                  opts.signingMethod = opts.signingMethod || 'ecdsa';
                  opts.coin = opts.coin || wallet.coin;
                  if (!opts.chain) {
                    opts.chain = opts.coin; // chain === coin for stored clients
                  }

                  if (!['ecdsa', 'schnorr'].includes(opts.signingMethod)) {
                    return next(Errors.WRONG_SIGNING_METHOD);
                  }

                  //  schnorr only on BCH
                  if (opts.coin != 'bch' && opts.signingMethod == 'schnorr') return next(Errors.WRONG_SIGNING_METHOD);

                  return next();
                },
                next => {
                  // TanTodo: checking message onchain
                  if (opts.messageOnChain) {
                    if (Buffer.from(opts.messageOnChain).length > 206) {
                      return next(Errors.LONG_MESSAGE);
                    }
                  }
                  return next();
                },
                next => {
                  try {
                    let txOptsFee = fee;

                    if (!txOptsFee) {
                      const useInputFee = opts.inputs && isNaN(opts.feePerKb);
                      const isNotUtxoCoin = !ChainService.isUTXOChain(wallet.chain);
                      const shouldUseOptsFee = useInputFee || isNotUtxoCoin;

                      if (shouldUseOptsFee) {
                        txOptsFee = opts.fee;
                      }
                    }

                    const txOpts = {
                      id: opts.txProposalId,
                      walletId: this.walletId,
                      creatorId: this.copayerId,
                      coin: opts.coin,
                      chain: opts.chain?.toLowerCase() || Utils.getChain(opts.coin), // getChain -> backwards compatibility
                      network: wallet.network,
                      outputs: opts.outputs,
                      message: opts.message,
                      from: opts.from,
                      sendMax: opts.sendMax,
                      changeAddress,
                      feeLevel: opts.feeLevel,
                      feePerKb,
                      payProUrl: opts.payProUrl,
                      walletM: wallet.m,
                      walletN: wallet.n,
                      excludeUnconfirmedUtxos: !!opts.excludeUnconfirmedUtxos,
                      instantAcceptanceEscrow: opts.instantAcceptanceEscrow,
                      addressType: wallet.addressType,
                      customData: opts.customData,
                      inputs: opts.inputs,
                      version: opts.txpVersion,
                      fee: txOptsFee,
                      noShuffleOutputs: opts.noShuffleOutputs,
                      gasPrice,
                      maxGasFee,
                      priorityGasFee,
                      txType: opts.txType,
                      nonce: opts.nonce,
                      gasLimit, // For Multisend and Backward compatibility for BWC < v7.1.1
                      data: opts.data, // Backward compatibility for BWC < v7.1.1
                      tokenAddress: opts.tokenAddress,
                      multisigContractAddress: opts.multisigContractAddress,
                      multiSendContractAddress: opts.multiSendContractAddress,
                      destinationTag: opts.destinationTag,
                      invoiceID: opts.invoiceID,
                      signingMethod: opts.signingMethod,
                      isTokenSwap: opts.isTokenSwap,
                      isDonation: opts.isDonation,
                      receiveLotusAddress: opts.receiveLotusAddress,
                      enableRBF: opts.enableRBF,
                      replaceTxByFee: opts.replaceTxByFee,
                      multiTx: opts.multiTx,
                      blockHash: opts.blockHash,
                      blockHeight: opts.blockHeight,
                      nonceAddress: opts.nonceAddress,
                      category: opts.category,
                      fromKeyPair: opts.fromKeyPair,
                      priorityFee: opts.priorityFee,
                      computeUnits: opts.computeUnits,
                      memo: opts.memo,
                      fromAta: opts.fromAta,
                      decimals: opts.decimals,
                      refreshOnPublish: opts.refreshOnPublish,
                      deferNonce: opts.deferNonce,
                      flags: opts.flags
                    };
                    txp = TxProposal.create(txOpts);
                    next();
                  } catch (e) {
                    logger.error('Error creating TX: %o', e.stack || e.message || e);
                    return next(e);
                  }
                },
                async next => {
                  if (opts.chain != 'xrp') return next();
                  this.getBalance({ chain: opts.chain, wallet }, async (err, bal) => {
                    if (err) return next(err);
                    ChainService.getReserve(this, wallet, (err, reserve) => {
                      if (err) return next(err);
                      if (reserve > bal.totalConfirmedAmount - txp.getTotalAmount() - txp.fee) return next(Errors.BALANCE_BELOW_RESERVE);
                      return next();
                    });
                  });
                },
                next => {
                  return ChainService.selectTxInputs(this, txp, wallet, opts, next);
                },
                async next => {
                  if (!wallet.isZceCompatible() || !opts.instantAcceptanceEscrow) return next();
                  try {
                    opts.inputs = txp.inputs;
                    const escrowAddress = await ChainService.getChangeAddress(this, wallet, opts);
                    txp.escrowAddress = escrowAddress;
                  } catch (error) {
                    return next(error);
                  }
                  if (opts.dryRun) return next();
                  this._store(wallet, txp.escrowAddress, next, true);
                },
                next => {
                  if (!txp.multiSendContractAddress || !txp.tokenAddress) {
                    return next();
                  }
                  // Check that the multisend contract is approved in the token contract for the total amount
                  const bc = this._getBlockchainExplorer(wallet.chain, wallet.network);
                  if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
                  bc.getTokenAllowance({
                    tokenAddress: txp.tokenAddress,
                    ownerAddress: txp.from,
                    spenderAddress: txp.multiSendContractAddress
                  }, (err, allowance) => {
                    if (err) { return next(err); }
                    if (BigInt(allowance) < txp.getTotalAmountBigInt()) {
                      return next(new Error(`Insufficient token allowance. Allowed: ${BigInt(allowance)}, Want: ${txp.getTotalAmountBigInt()}`));
                    }
                    return next();
                  });
                },
                next => {
                  if (!changeAddress || wallet.singleAddress || opts.dryRun || opts.changeAddress) return next();

                  this._store(wallet, txp.changeAddress, next, true);
                },
                next => {
                  if (opts.dryRun) return next();

                  if (txp.coin == 'bch' && txp.changeAddress) {
                    const format = opts.noCashAddr ? 'copay' : 'cashaddr';
                    txp.changeAddress.address = BCHAddressTranslator.translate(txp.changeAddress.address, format);
                  }

                  this.storage.storeTx(wallet.id, txp, next);
                }
              ],
              err => {
                if (err) return cb(err);

                if (txp.coin == 'bch') {
                  if (opts.returnOrigAddrOutputs) {
                    logger.info('Returning Orig BCH address outputs for compat');
                    txp.outputs = opts.origAddrOutputs;
                  }
                }
                return cb(null, txp);
              }
            );
          });
        });
      },
      10 * 1000
    );
  }


  publishTx(opts, cb) {
    this._publishTx(opts, (err, txp) => {
      if (err) return cb(err);
      if (opts.numberFormat) {
        txp = TxProposal.formatNumbers(txp, opts.numberFormat);
      }
      return cb(null, txp);
    });
  }

  /**
   * Publish an already created tx proposal so inputs are locked and other copayers in the wallet can see it.
   * @param {Object} opts
   * @param {string} opts.txProposalId - The tx id.
   * @param {string} opts.proposalSignature - S(raw tx). Used by other copayers to verify the proposal.
   * @param {Boolean} [opts.noCashAddr] - do not use cashaddress for bch
   */
  private _publishTx(opts, cb) {
    if (!checkRequired(opts, ['txProposalId', 'proposalSignature'], cb)) return;

    this._runLocked(cb, cb => {
      this.getWallet({}, (err, wallet) => {
        if (err) return cb(err);

        if (config.suspendedChains && config.suspendedChains.includes(wallet.chain)) {
          const Err = Errors.NETWORK_SUSPENDED;
          Err.message = Err.message.replace('$network', wallet.chain.toUpperCase());
          return cb(Err);
        }

        this.storage.fetchTx(this.walletId, opts.txProposalId, (err, txp) => {
          if (err) return cb(err);
          if (!txp) return cb(Errors.TX_NOT_FOUND);
          if (!txp.isTemporary() && !txp.hasMutableTxData()) return cb(null, txp);
          // Broadcasted proposals should not be published again. Only temporary or pending proposals can be published.
          if (txp.isBroadcasted()) return cb(Errors.TX_ALREADY_BROADCASTED);
          if (!txp.isTemporary() && txp.status !== 'pending') return cb(Errors.TX_NOT_PENDING);

          const copayer = wallet.getCopayer(this.copayerId);

          let raw;
          try {
            raw = txp.getRawTx();
          } catch (ex) {
            return cb(ex);
          }

          let signingKey = this._getSigningKey(raw, opts.proposalSignature, copayer.requestPubKeys);
          if (!signingKey) {
            // The signature didn't match the current (refreshed) raw tx. Fall back to the previously-published
            // raw tx -- but only if it is bound to THIS proposal (differs from the current tx solely in the
            // field BWS mutates at publish: blockhash/nonce). Without that check a tampered stored proposal
            // could reuse an old, still-valid proposalSignature over prePublishRaw. Mirrors the client
            // Verifier.checkPrePublishRaw guard.
            if (txp.hasMutableTxData() && txp.prePublishRaw && ChainService.isPrePublishRawBound(txp)) {
              raw = txp.prePublishRaw;
              signingKey = this._getSigningKey(raw, opts.proposalSignature, copayer.requestPubKeys);
            }
          }
          if (!signingKey) {
            return cb(new ClientError('Invalid proposal signature'));
          }

          // Save signature info for other copayers to check
          if (!txp.proposalSignature) { // May already be set if republishing
            txp.proposalSignature = opts.proposalSignature;
            if (signingKey.selfSigned) {
              txp.proposalSignaturePubKey = signingKey.key;
              txp.proposalSignaturePubKeySig = signingKey.signature;
            }
          }

          ChainService.checkTxUTXOs(this, txp, opts, err => {
            if (err) return cb(err);
            txp.status = 'pending';
            ChainService.refreshTxData(this, txp, opts, (err, txp) => {
              if (err) return cb(err);
              if (txp.hasMutableTxData() && !txp.prePublishRaw) {
                // We save the original raw transaction for verification on republish
                txp.prePublishRaw = raw;
              }
              this.storage.storeTx(this.walletId, txp, err => {
                if (err) return cb(err);
                const action = txp.isRepublishEnabled() && txp.prePublishRaw ? 'UpdatedTxProposal' : 'NewTxProposal';
                this._notifyTxProposalAction(action, txp, () => {
                  if (txp.coin == 'bch' && txp.changeAddress) {
                    const format = opts.noCashAddr ? 'copay' : 'cashaddr';
                    txp.changeAddress.address = BCHAddressTranslator.translate(txp.changeAddress.address, format);
                  }
                  return cb(null, txp);
                });
              });
            });
          });
        });
      });
    });
  }

  /**
   * Retrieves a tx from storage.
   * @param {Object} opts
   * @param {string} opts.txProposalId - The tx proposal id.
   * @returns {Object} txProposal
   */
  getTx(opts, cb: (err: any, txp?: TxProposal) => void) {
    // the tx and its note are both completed from the wallet, so read it once
    this.storage.fetchWallet(this.walletId, (err, wallet) => {
      if (err) return cb(err);
      this.storage.fetchTx(this.walletId, opts.txProposalId, (err, txp) => {
        if (err) return cb(err);
        if (!txp) return cb(Errors.TX_NOT_FOUND);

        if (!txp.txid) return cb(null, txp);

        this.storage.fetchTxNote(this.walletId, txp.txid, (err, note) => {
          if (err) {
            this.logw(`Error fetching tx note for ${txp.txid}:`, err);
          }
          txp.note = note;
          return cb(null, txp);
        }, wallet);
      }, wallet);
    });
  }

  /**
   * Retrieves a tx from storage using txid
   * @param {Object} opts
   * @param {string} opts.txid - The tx blockchain id.
   * @returns {Object} txProposal
   */
  getTxByHash(opts, cb) {
    if (!checkRequired(opts, 'txid', cb)) return;

    // Scoped to this.walletId: the global storage.fetchTxByHash
    // would return any wallet's TxProposal for a known txid, disclosing a
    // foreign wallet's proposal data to any authenticated copayer. The
    // internal global consumers (BlockchainMonitor, getWalletFromIdentifier)
    // are unaffected; they keep calling storage.fetchTxByHash directly.
    this.storage.fetchWallet(this.walletId, (err, wallet) => {
      if (err) return cb(err);
      this.storage.fetchTxByHashForWallet(this.walletId, opts.txid, (err, txp) => {
        if (err) return cb(err);
        if (!txp) return cb(Errors.TX_NOT_FOUND);

        if (!txp.txid) return cb(null, txp);

        this.storage.fetchTxNote(this.walletId, txp.txid, (err, note) => {
          if (err) {
            this.logw(`Error fetching tx note for ${txp.txid}:`, err);
          }
          txp.note = note;
          return cb(null, txp);
        }, wallet);
      }, wallet);
    });
  }

  /**
   * Edit note associated to a txid.
   * @param {Object} opts
   * @param {string} opts.txid - The txid of the tx on the blockchain.
   * @param {string} opts.body - The contents of the note.
   */
  editTxNote(opts, cb) {
    if (!checkRequired(opts, 'txid', cb)) return;

    this._runLocked(cb, cb => {
      this.storage.fetchTxNote(this.walletId, opts.txid, (err, note) => {
        if (err) return cb(err);

        if (!note) {
          note = TxNote.create({
            walletId: this.walletId,
            txid: opts.txid,
            copayerId: this.copayerId,
            body: opts.body
          });
        } else {
          note.edit(opts.body, this.copayerId);
        }
        this.storage.storeTxNote(note, err => {
          if (err) return cb(err);
          this.storage.fetchTxNote(this.walletId, opts.txid, cb);
        });
      });
    });
  }

  /**
   * Get tx notes.
   * @param {Object} opts
   * @param {string} opts.txid - The txid associated with the note.
   */
  getTxNote(opts, cb) {
    if (!checkRequired(opts, 'txid', cb)) return;
    this.storage.fetchTxNote(this.walletId, opts.txid, cb);
  }

  /**
   * Get tx notes.
   * @param {Object} opts
   * @param {string} opts.minTs[=0] - The start date used to filter notes.
   */
  getTxNotes(opts, cb) {
    opts = opts || {};
    this.storage.fetchTxNotes(this.walletId, opts, cb);
  }

  /**
   * removeWallet
   *
   * @param opts
   * @param cb
   * @return {undefined}
   */
  removeWallet(opts, cb) {
    this._runLocked(cb, cb => {
      this.storage.removeWallet(this.walletId, cb);
    });
  }

  getRemainingDeleteLockTime(txp) {
    const now = Math.floor(Date.now() / 1000);

    const lockTimeRemaining = txp.createdOn + Defaults.DELETE_LOCKTIME - now;
    if (lockTimeRemaining < 0) return 0;

    // not the creator? need to wait
    if (txp.creatorId !== this.copayerId) return lockTimeRemaining;

    // has other approvers? need to wait
    const approvers = txp.getApprovers();
    if (approvers.length > 1 || (approvers.length == 1 && approvers[0] !== this.copayerId)) return lockTimeRemaining;

    return 0;
  }

  /**
   * removePendingTx
   *
   * @param opts
   * @param {string} opts.txProposalId - The tx id.
   * @return {undefined}
   */
  removePendingTx(opts, cb) {
    if (!checkRequired(opts, ['txProposalId'], cb)) return;

    this._runLocked(cb, cb => {
      this.getTx(
        {
          txProposalId: opts.txProposalId
        },
        (err, txp: TxProposal) => {
          if (err) return cb(err);

          if (!txp.isPending()) return cb(Errors.TX_NOT_PENDING);

          const deleteLockTime = this.getRemainingDeleteLockTime(txp);
          if (deleteLockTime > 0) return cb(Errors.TX_CANNOT_REMOVE);

          this.storage.removeTx(this.walletId, txp.id, async () => {
            try { 
              const inputPaths = Array.isArray(txp.inputPaths) && txp.inputPaths?.length ? txp.inputPaths : [txp.inputPaths || 'm/0/0']; // doesn't actually matter what's in the array
              await Promise.all(inputPaths.map((_, i) => this.storage.removeTssSigSession({ id: `${txp.id}:input${i}` })));
            } catch (err) {
              logger.warn('Error removing tss sig session for wallet %s txp %s: %o', this.walletId, txp.id, err);
            }
            this._notifyTxProposalAction('TxProposalRemoved', txp, cb);
          });
        }
      );
    });
  }

  _broadcastRawTx(chain, network, raw, cb) {
    const bc = this._getBlockchainExplorer(chain, network);
    if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
    bc.broadcast(raw, (err, txid) => {
      if (err) {
        this.logw('Error broadcasting tx: %o %o %o %o', chain, network, raw, err);
        return cb(err);
      }
      return cb(null, txid);
    });
  }

  _broadcastRawTxByChronik(chronikClient, hex, skipSlpCheck, cb) {
    return chronikClient
      .broadcastTx(hex, skipSlpCheck)
      .then(txidObj => {
        return cb(null, txidObj.txid);
      })
      .catch(err => {
        return cb(err);
      });
  }

  /**
   * Broadcast a raw transaction.
   * @param {Object} opts
   * @param {string} [opts.coin = 'btc'] - The coin for this transaction.
   * @param {string} [opts.chain = 'btc'] - The coin for this transaction.
   * @param {string} [opts.network = 'livenet'] - The Bitcoin network for this transaction.
   * @param {string} [opts.skipSlpCheck = false] - If set this prop to false, chronik will check tx doesn't burn. Default to false
   * @param {string} opts.rawTx - Raw tx data.
   */
  broadcastRawTx(opts, cb) {
    if (!checkRequired(opts, ['network', 'rawTx'], cb)) return;
    const ischronik = opts.ischronik ? opts.ischronik : undefined;
    opts.coin = opts.coin || Defaults.COIN;
    if (!opts.chain) {
      opts.chain = opts.coin; // chain === coin for stored clients
    }
    if (!Utils.checkValueInCollection(opts.coin, Constants.CHAINS)) return cb(new ClientError('Invalid coin'));

    opts.chain = opts.chain || opts.coin || Defaults.COIN;
    if (!Utils.checkValueInCollection(opts.chain, Constants.CHAINS)) return cb(new ClientError('Invalid chain'));
    if (!ischronik) {
      this._broadcastRawTx(opts.coin, opts.network, opts.rawTx, cb);
    } else {
      const coin = opts.coin;
      const chronikClient =
        coin === 'xec' ? ChainService.getChronikClient(coin) : ChainService.getLegacyChronikClient(coin);
      this._broadcastRawTxByChronik(chronikClient, opts.rawTx, !!opts.skipSlpCheck, async (err, txid) => {
        if (err || !txid) {
          logger.warn(`Broadcast failed: ${err}`);
          if (err) return cb(err);
          else return cb(new Error('Can not find txId'));
        } else {
          const extraArgs = {};

          const data = _.assign(
            {
              txid,
              creatorId: this.copayerId ? this.copayerId : null,
              amount: null,
              message: null,
              tokenAddress: null,
              multisigContractAddress: null
            },
            extraArgs
          );
          this._notify('NewOutgoingTx', data, extraArgs);
          return cb(null, txid);
        }
      });
    }
  }

  _checkTxInBlockchain(txp, cb) {
    if (!txp.txid) return cb();
    const bc = this._getBlockchainExplorer(txp.chain, txp.network);
    if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
    bc.getTransaction(txp.txid, (err, tx) => {
      if (err) return cb(err);
      return cb(null, !!tx);
    });
  }

  /**
   * Sign a transaction proposal.
   * @param {Object} opts
   * @param {string} opts.txProposalId - The identifier of the transaction.
   * @param {string} opts.signatures - The signatures of the inputs of this tx for this copayer (in appearance order)
   * @param {string} opts.maxTxpVersion - Client's maximum supported txp version
   * @param {boolean} opts.supportBchSchnorr - indication whether to use schnorr for signing tx
   * @param {string} opts.numberFormat - Optional. If specified, the tx proposal will ensure the numbers are in the format specified (e.g. 'string'). This is to ensure precision handling matches the client's
   */
  signTx(opts, cb) {
    if (!checkRequired(opts, ['txProposalId', 'signatures'], cb)) return;
    opts.maxTxpVersion = opts.maxTxpVersion || 3;

    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);

      if (config.suspendedChains && config.suspendedChains.includes(wallet.chain)) {
        const Err = Errors.NETWORK_SUSPENDED;
        Err.message = Err.message.replace('$network', wallet.chain.toUpperCase());
        return cb(Err);
      }

      this.getTx(
        {
          txProposalId: opts.txProposalId
        },
        async (err, txp: TxProposal) => {
          if (err) return cb(err);

          if (this._upgradeNeeded(UPGRADES.version_$gt_maxTxpVersion, { maxTxpVersion: opts.maxTxpVersion, version: txp.version })) {
            return cb(Errors.UPGRADE_NEEDED.withMessage('Your client does not support signing this transaction. Please upgrade'));
          }

          const action = _.find(txp.actions, {
            copayerId: this.copayerId
          });
          if (action) return cb(Errors.COPAYER_VOTED);
          if (!txp.isPending()) return cb(Errors.TX_NOT_PENDING);

          // Client-supplied nonce override
          if (opts.nonce != null && [...Object.keys(Constants.EVM_CHAINS), 'XRP'].includes(wallet.chain.toUpperCase())) {
            txp.nonce = Number(opts.nonce);
          }

          if (this._upgradeNeeded(UPGRADES.BCH_schnorr, { signingMethod: txp.signingMethod, supportBchSchnorr: opts.supportBchSchnorr })) {
            return cb(Errors.UPGRADE_NEEDED);
          }

          if ([...Object.keys(Constants.EVM_CHAINS), 'XRP'].includes(wallet.chain.toUpperCase())) {
            try {
              const txps = await this.getPendingTxsPromise({});
              for (const t of txps) {
                if (t.id !== txp.id && t.nonce != null && txp.nonce != null && t.nonce <= txp.nonce && t.status !== 'rejected') {
                  return cb(Errors.TX_NONCE_CONFLICT);
                }
              }
              // A deferred txp matching a broadcasted txp's nonce means its JIT-assigned
              // value went stale. Non-deferred txps may reuse an in-flight nonce
              // intentionally (e.g. speed-up).
              if (txp.nonce != null && txp.deferNonce) {
                const broadcastedTxps = await util.promisify(this.storage.fetchBroadcastedTxs).call(this.storage, this.walletId, {
                  minTs: Math.floor(Date.now() / 1000) - Defaults.BROADCASTED_NONCE_SCAN_WINDOW
                });
                for (const t of broadcastedTxps || []) {
                  if (t.id !== txp.id && t.nonce != null && Number(t.nonce) === Number(txp.nonce)) {
                    return cb(Errors.TX_NONCE_CONFLICT);
                  }
                }
              }
            } catch (err) {
              return cb(err);
            }
          }
          

          const copayer = wallet.getCopayer(this.copayerId);
          const xPubKey = wallet.tssKeyId ? wallet.clientDerivedPublicKey : copayer.xPubKey;

          try {
            if (!txp.sign(this.copayerId, opts.signatures, xPubKey, opts.numberFormat)) {
              this.logw('Error signing transaction (BAD_SIGNATURES)');
              this.logw('Client version:', this.clientVersion);
              this.logw('Arguments:', JSON.stringify(opts));
              this.logw('Transaction proposal:', JSON.stringify(txp));
              const raw = ChainService.getBitcoreTx(txp).uncheckedSerialize();
              this.logw('Raw tx:', raw);
              return cb(Errors.BAD_SIGNATURES);
            }
          } catch (ex) {
            this.logw('Error signing transaction proposal:', ex);
            return cb(ex);
          }

          if (wallet.tssKeyId) {
            try {
              // Add the other copayers to the txp.copayers array
              //  so the client can see who participated in the signing.
              // Note we hardcode to input0 as that should always be present and should suffice for
              //  gathering copayers. However, there is a possibility that input1 (or any input >0)
              //  could contain a different set of copayers, depending on the client's implementation
              //  of TSS. While technically possible, it's unlikely and the impact is mostly aesthetic.
              const tssSigSeshId = `${txp.id}:input0`;
              const tssSigSession = await storage.fetchTssSigSession({ id: tssSigSeshId });
              if (!tssSigSession) {
                throw new Error('TSS signature session not found: ' + tssSigSeshId);
              }
              const copayerIds = tssSigSession.participants.map(p => p.copayerId);
              for (const copayerId of copayerIds) {
                if (copayerId === this.copayerId) continue;
                txp.addAction(copayerId, 'accept', null, opts.signatures, xPubKey);
              }
            } catch (err) {
              this.logw('Error finding accepting copayers for TSS txp: %o %o', txp.id, err);
            }
          }

          this.storage.storeTx(this.walletId, txp, err => {
            if (err) return cb(err);

            async.series(
              [
                next => {
                  this._notifyTxProposalAction(
                    'TxProposalAcceptedBy',
                    txp,
                    {
                      copayerId: this.copayerId
                    },
                    next
                  );
                },
                next => {
                  if (txp.isAccepted()) {
                    this._notifyTxProposalAction('TxProposalFinallyAccepted', txp, next);
                  } else {
                    next();
                  }
                }
              ],
              () => {
                return cb(null, txp);
              }
            );
          });
        }
      );
    });
  }

  prepareTx(opts, cb) {
    this._prepareTx(opts, (err, txp) => {
      if (err) return cb(err);
      if (opts.numberFormat) {
        txp = TxProposal.formatNumbers(txp, opts.numberFormat);
      }
      return cb(null, txp);
    });
  }  

  /**
   * Prepare a transaction proposal for signing.
   * Assigns JIT values (nonce, and in the future: fee, gas) to a deferred txp.
   * Called by the client just before signing.
   * @param {Object} opts
   * @param {string} opts.txProposalId - The identifier of the transaction.
   */
  private _prepareTx(opts, cb) {
    if (!checkRequired(opts, ['txProposalId'], cb)) return;

    this._runLocked(cb, cb => {
      this.getWallet({}, (err, wallet) => {
        if (err) return cb(err);

        this.storage.fetchTx(this.walletId, opts.txProposalId, async (err, txp) => {
          if (err) return cb(err);
          if (!txp) return cb(Errors.TX_NOT_FOUND);
          if (!txp.isPending()) return cb(Errors.TX_NOT_PENDING);

          if (!txp.deferNonce) {
            // Not a deferred-nonce txp. Return it as-is
            return cb(null, txp);
          }

          if (!Constants.EVM_CHAINS[wallet.chain.toUpperCase()] && wallet.chain.toUpperCase() !== 'XRP') {
            return cb(null, txp);
          }

          try {
            // 1. Get confirmed nonce from blockchain
            const confirmedNonce = await ChainService.getTransactionCount(this, wallet, txp.from);

            // 2. Get pending TXP nonces from BWS's own database
            const pendingTxps = await this.getPendingTxsPromise({});
            const pendingNonces = pendingTxps
              .filter(t => t.id !== txp.id && t.nonce != null && t.status !== 'rejected')
              .map(t => Number(t.nonce));

            // 2b. Broadcasted-but-unmined txps still occupy their nonces but appear in
            // neither the confirmed count nor the pending set
            const broadcastedTxps = await util.promisify(this.storage.fetchBroadcastedTxs).call(this.storage, this.walletId, {
              minTs: Math.floor(Date.now() / 1000) - Defaults.BROADCASTED_NONCE_SCAN_WINDOW
            });
            const inFlightNonces = (broadcastedTxps || [])
              .filter(t => t.nonce != null && Number(t.nonce) >= Number(confirmedNonce))
              .map(t => Number(t.nonce));

            // 3. Calculate gap-free nonce
            let suggestedNonce = Number(confirmedNonce);
            const allNonces = [...pendingNonces, ...inFlightNonces].sort((a, b) => a - b);
            for (const n of allNonces) {
              if (n === suggestedNonce) {
                suggestedNonce++;
              }
            }

            txp.nonce = suggestedNonce;

            // 4. Store the updated txp
            this.storage.storeTx(this.walletId, txp, err => {
              if (err) return cb(err);
              return cb(null, txp);
            });
          } catch (err) {
            return cb(err);
          }
        });
      });
    });
  }

  _processBroadcast(txp, opts, cb) {
    $.checkState(txp.txid, 'Failed state: txp.txid undefined at <_processBroadcast()>');
    opts = opts || {};
    txp.setBroadcasted();
    this.storage.storeTx(this.walletId, txp, err => {
      if (err) return cb(err);

      const extraArgs = {
        txid: txp?.txids?.length ? txp.txids : txp.txid
      };
      if (opts.byThirdParty) {
        this._notifyTxProposalAction('NewOutgoingTxByThirdParty', txp, extraArgs);
      } else {
        this._notifyTxProposalAction('NewOutgoingTx', txp, extraArgs);
      }

      return cb(null, txp);
    });
  }

  checkIsDonation(txp): boolean {
    const addressObjDonation = _.find(
      config.donationRemaining.donationToAddresses,
      (item: CoinDonationToAddress) => item.coin == txp.coin && item.network == txp.network
    );
    if (_.isEmpty(addressObjDonation)) return false;
    return txp.isDonation && txp.outputs[0].toAddress == addressObjDonation.address;
  }

  _sendLotusDonation(client, key, txDonation, cb) {
    this.createTx(txDonation, (err, txp) => {
      if (err) return cb(err);
      let proposalSignature;
      try {
        const t = commonBWC.Utils.buildTx(txp);
        const hash = t.uncheckedSerialize();
        proposalSignature = commonBWC.Utils.signMessage(hash, client.credentials.requestPrivKey);
      } catch (error) {
        return cb(error);
      }

      const optPublish = {
        proposalSignature,
        txProposalId: txp.id
      };
      this.publishTx(optPublish, (err, txp) => {
        if (err) return cb(err);
        let signatures;
        try {
          signatures = key.sign(client.getRootPath(), txp);
        } catch (error) {
          return cb(error);
        }

        const optSigh = {
          maxTxpVersion: 3,
          signatures,
          supportBchSchnorr: true,
          txProposalId: txp.id
        };
        this.signTx(optSigh, (err, txp) => {
          if (err) return cb(err);
          this.broadcastTx({ txProposalId: txp.id }, (err, txp) => {
            if (err) return cb(err);
            return cb(null, txp.txid);
          });
        });
      });
    });
  }
  _createOtpTxSwap(coinCode, network, addressUserReceive, amountTo) {
    const tx = {
      coin: coinCode,
      dryRun: false,
      excludeUnconfirmedUtxos: false,
      feeLevel: 'normal',
      isTokenSwap: null,
      message: null,
      network,
      outputs: [
        {
          amount: _.toSafeInteger(amountTo),
          message: null,
          toAddress: addressUserReceive
        }
      ],
      payProUrl: null,
      txpVersion: 3
    };
    return tx;
  }

  _sendSwap(client, key, txSwap, cb) {
    this.createTx(txSwap, (err, txp) => {
      if (err) return cb(err);
      let proposalSignature;
      try {
        const t = commonBWC.Utils.buildTx(txp);
        const hash = t.uncheckedSerialize();
        proposalSignature = commonBWC.Utils.signMessage(hash, client.credentials.requestPrivKey);
      } catch (error) {
        return cb(error);
      }

      const optPublish = {
        proposalSignature,
        txProposalId: txp.id,
        walletId: txSwap.walletId,
        copayerId: txSwap.copayerId
      };
      this.publishTx(optPublish, (err, txp) => {
        if (err) return cb(err);
        let signatures;
        try {
          signatures = key.sign(client.getRootPath(), txp);
        } catch (error) {
          return cb(error);
        }

        const optSigh = {
          maxTxpVersion: 3,
          signatures,
          supportBchSchnorr: true,
          txProposalId: txp.id
        };
        this.signTx(optSigh, (err, txp) => {
          if (err) return cb(err);
          this.broadcastTx({ txProposalId: txp.id }, (err, txp) => {
            if (err) return cb(err);
            return cb(null, txp.txid);
          });
        });
      });
    });
  }

  async _sendSwapWithToken(coin, wallet, mnemonic, tokenId, token, TOKENQTY, etokenAddress, cb) {
    try {
      const txId = await ChainService.sendToken(coin, wallet, mnemonic, tokenId, token, TOKENQTY, etokenAddress);
      return cb(null, txId);
    } catch (e) {
      return cb(e);
    }
  }

  async _burnToken(coin, wallet, mnemonic, tokenId, TOKENQTY, splitTxId, cb) {
    try {
      const txId = await ChainService.burnToken(coin, wallet, mnemonic, tokenId, TOKENQTY, splitTxId);
      return cb(null, txId);
    } catch (e) {
      return cb(e);
    }
  }

  _getKeyLotus(client, cb) {
    let key;
    const walletData = walletLotus;
    try {
      let imported = Client.upgradeCredentialsV1(walletData);
      client.fromString(JSON.stringify(imported.credentials));

      key = new Key({ seedType: 'object', seedData: imported.key });
    } catch (e) {
      try {
        client.fromObj(walletData.cred);
        key = new Key({ seedType: 'object', seedData: walletData.key });
      } catch (e) {
        return cb(e);
      }
    }
    return cb(null, client, key);
  }

  _getKeyFundWithMnemonic(client, cb) {
    let key;
    try {
      let opts = { words: '' };
      this.storage.fetchKeys((err, result: Keys) => {
        if (err) return cb(err);
        if (!result) return cb(new Error('Can not find key fund'));
        const keyFundDecrypted = this.decrypt(config.sharedKey, result.keyFund);
        const ctArray = Array.from(new Uint8Array(keyFundDecrypted)); // ciphertext as byte array\
        const ctStr = ctArray.map(byte => String.fromCharCode(byte)).join(''); // ciphertext as string
        opts.words = ctStr;
        this.importWithPromise(opts, client, true)
          .then(result => {
            return cb(null, result);
          })
          .catch(e => {
            return cb(e);
          });
      });
    } catch (e) {
      return cb(e);
    }
  }

  _getKeyFundConversionWithMnemonic(client, cb) {
    let key;
    try {
      let opts = { words: '' };
      this.storage.fetchKeysConversion((err, result: KeysConversion) => {
        if (err) return cb(err);
        if (!result) return cb(new Error('Can not find key fund for conversion'));
        const keyFundDecrypted = this.decrypt(config.sharedKey, result.keyFund);
        const ctArray = Array.from(new Uint8Array(keyFundDecrypted)); // ciphertext as byte array\
        const ctStr = ctArray.map(byte => String.fromCharCode(byte)).join(''); // ciphertext as string
        opts.words = ctStr;
        this.importWithPromise(opts, client, true, true)
          .then(result => {
            return cb(null, result);
          })
          .catch(e => {
            return cb(e);
          });
      });
    } catch (e) {
      return cb(e);
    }
  }

  importWithPromise(opts, client, isFund, isConversion = false) {
    return new Promise((resolve, reject) => {
      try {
        Client.serverAssistedImport(
          opts,
          {
            baseUrl: client.request.baseUrl
          },
          (err, key, walletClients) => {
            if (err) return reject(err);
            if (walletClients && walletClients.length > 0) {
              if (isConversion) {
                clientsFundConversion = walletClients;
                mnemonicKeyFundConversion = opts.words;
              } else {
                if (isFund) {
                  clientsFund = walletClients;
                  mnemonicKeyFund = opts.words;
                  keyFund = key;
                } else {
                  clientsReceive = walletClients;
                }
              }
            }
            return resolve(walletClients);
          }
        );
      } catch (e) {
        return reject(e);
      }
    });
  }
  initializeCoinConfig(cb) {
    let listAvailableCoin = [];
    let listCoinConfig = [];
    // let listCoinConfigExistedInDb = [];
    let listNewCoinConfigToStoreInDb = [];
    let listNewCoinConfigToUpdateInDb = [];
    let promiseList = [];
    listAvailableCoin = config.coinSupportForSwap;
    this.storage.fetchAllCoinConfig(async (err, listCoinConfigExistedInDb) => {
      if (err) return cb(err);
      if (listAvailableCoin && listAvailableCoin.length > 0) {
        listAvailableCoin.forEach(coin => {
          // if coin config not exist in db => create new coin config
          if (
            !listCoinConfigExistedInDb ||
            listCoinConfigExistedInDb.length === 0 ||
            listCoinConfigExistedInDb.findIndex(x => x.code === coin.code && x.network === coin.network) === -1
          ) {
            listNewCoinConfigToStoreInDb.push(CoinConfig.create(coin));
          }
          // if coin config exist in db but no support before => enable again
          else if (
            listCoinConfigExistedInDb.findIndex(
              x => x.code === coin.code && x.network === coin.network && !coin.isSupport
            ) > -1
          ) {
            const coinUpdateFound = listCoinConfigExistedInDb.find(
              x => x.code === coin.code && x.network === coin.network && !coin.isSupport
            );
            coinUpdateFound.isSupport = true;
            listNewCoinConfigToUpdateInDb.push(coinUpdateFound);
          }
        });

        // checking if coin config existed in db but not found in available coin  => not show to user in config file

        const listCoinConfigExistedInDbEnableSupport = listCoinConfigExistedInDb.filter(coin => coin.isSupport);
        if (listCoinConfigExistedInDbEnableSupport && listCoinConfigExistedInDbEnableSupport.length > 0) {
          listCoinConfigExistedInDbEnableSupport.forEach(coinConfigInDb => {
            const avaialableCoinFound = listAvailableCoin.find(
              coin => coin.code === coinConfigInDb.code && coin.network === coinConfigInDb.network
            );
            if (!avaialableCoinFound) {
              coinConfigInDb.isSupport = false;
              listNewCoinConfigToUpdateInDb.push(coinConfigInDb);
            }
          });
        }
        if (listNewCoinConfigToStoreInDb.length > 0) {
          promiseList.push(this.storeListConfigWithPromie(listNewCoinConfigToStoreInDb));
        }
        if (listNewCoinConfigToUpdateInDb.length > 0) {
          listNewCoinConfigToUpdateInDb.forEach(coinConfig => {
            promiseList.push(this.updateConfigWithPromie(coinConfig));
          });
        }
        await Promise.all(promiseList)
          .then(async result => {
            return cb(null);
          })
          .catch(err => {
            return cb(err);
          });
      }
    });
  }

  storeListConfigWithPromie(listNewCoinConfigToStoreInDb): Promise<any> {
    return new Promise((resolve, reject) => {
      this.storage.storeListCoinConfig(listNewCoinConfigToStoreInDb, (err, result) => {
        if (err) return reject(err);
        return resolve(result);
      });
    });
  }

  updateConfigWithPromie(coinConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      this.storage.updateCoinConfig(coinConfig, (err, result) => {
        if (err) return reject(err);
        return resolve(result);
      });
    });
  }

  async rescanWalletsInKeys(cb) {
    // if (!clientsFund || !clientsReceive) {
    //   return cb(new Error('Can not find key fund and receive '));
    // }
    let listCoinConfigMapped = [];
    this.getKeyFundAndReceiveWithFundMnemonic(err => {
      if (err) return cb(err);
      this.storage.fetchAllCoinConfig(async (err, listCoinConfig: CoinConfig[]) => {
        if (err) return cb(err);

        if (clientsReceive && listCoinConfig.length > 0) {
          listCoinConfigMapped = await this.mappingWalletClientsToCoinConfig(clientsReceive, false, listCoinConfig);
        }

        if (clientsFund) {
          listCoinConfigMapped = await this.mappingWalletClientsToCoinConfig(clientsFund, true, listCoinConfigMapped);
        }

        if (listCoinConfigMapped.length > 0) {
          this.storage.updateListCoinConfig(listCoinConfigMapped, (err, result) => {
            if (err) return cb(err);
            return cb(null, result);
          });
        } else {
          return cb(new Error('Can not rescan wallet'));
        }
      });
    });
  }

  filterCoinconfig(opts, cb) { }

  async mappingWalletClientsToCoinConfig(walletClients, isSwap: boolean, listCoinConfig: CoinConfig[]) {
    let listCoinFound = [];
    let listTokenFound = [];
    if (walletClients) {
      // get all wallets in walletClients
      listCoinFound = walletClients.map(s => ({
        code: s.credentials.coin,
        network: s.credentials.network,
        walletId: s.credentials.walletId
        // isToken: false,
      }));
      const xecWalletFound = listCoinFound.find(s => s.code === 'xec' && s.network === 'livenet');
      if (xecWalletFound) {
        // get list token inside
        let listToken = null;
        listToken = await this.getTokensWithPromise({ walletId: xecWalletFound.walletId });
        if (listToken) {
          const listTokenConverted = _.map(listToken, item => {
            return {
              tokenId: item.tokenId,
              tokenInfo: item.tokenInfo,
              amountToken: item.amountToken,
              utxoToken: item.utxoToken
            } as TokenItem;
          });
          listTokenFound = listTokenConverted.map(s => ({
            code: s.tokenInfo.symbol.toLowerCase(),
            network: 'livenet'
            // isToken: true,
            // tokenInfo: s.tokenInfo,
          }));
        }
      }

      const listFound = listCoinFound.concat(listTokenFound);
      if (listFound.length > 0) {
        listCoinConfig.forEach(coinConfig => {
          const isCoinConfigFound =
            listFound.findIndex(s => s.code === coinConfig.code && s.network === coinConfig.network) > -1;
          if (isSwap) {
            coinConfig.isSwap = isCoinConfigFound;
            const isTokenFoundOnFundWallet =
              listTokenFound.findIndex(s => s.code === coinConfig.code && s.network === coinConfig.network) > -1;
            if (isTokenFoundOnFundWallet) {
              coinConfig.isReceive = true;
            }
          } else {
            coinConfig.isReceive = isCoinConfigFound;
          }
        });
      }
    }
    return listCoinConfig;
  }

  _getKeyReceive(client, cb) {
    let key;
    try {
      let opts = { words: '' };
      this.storage.fetchKeys((err, result: Keys) => {
        if (err) return cb(err);
        const keyReceiveDecrypted = this.decrypt(config.sharedKey, result.keyReceive);
        const ctArray = Array.from(new Uint8Array(keyReceiveDecrypted)); // ciphertext as byte array
        const ctStr = ctArray.map(byte => String.fromCharCode(byte)).join(''); // ciphertext as string
        opts.words = ctStr;
        this.importWithPromise(opts, client, false)
          .then(result => {
            return cb(null, result);
          })
          .catch(e => {
            return cb(e);
          });
      });
    } catch (e) {
      return cb(e);
    }
  }

  getWalletLotusDonation(cb) {
    this.copayerId = _.get(walletLotus, 'cred.copayerId', '');
    this.walletId = _.get(walletLotus, 'cred.walletId', '');
    const clientBwc = new Client();
    this._getKeyLotus(clientBwc, (err, client, key) => {
      if (err) return cb(err);
      this.createAddress({}, function (err, x) {
        if (err) return cb(err);
        return cb(null, client, key, x.address);
      });
    });
  }

  getKeyFundAndReceiveWithFundMnemonic(cb) {
    const clientBwc = new Client();
    this._getKeyFundWithMnemonic(clientBwc, err => {
      if (err) return cb(err);
      this._getKeyReceive(clientBwc, err => {
        if (err) return cb(err);
        return cb(null, true);
      });
    });
  }

  getKeyConversionWithFundMnemonic(cb) {
    const clientBwc = new Client();
    // this._getKeyFundConversionWithMnemonic(clientBwc, err => {
    //   if (err) return cb(err);
    //   return cb(null, true);
    // });
  }

  _createOtpTxDonation(addressDonation, receiveLotusAddress, receiveAmountLotus) {
    const tx = {
      coin: 'xpi',
      dryRun: false,
      excludeUnconfirmedUtxos: false,
      feeLevel: 'normal',
      from: addressDonation,
      isTokenSwap: null,
      message: null,
      outputs: [
        {
          amount: receiveAmountLotus,
          message: null,
          toAddress: receiveLotusAddress
        }
      ],
      payProUrl: null,
      txpVersion: 3
    };
    return tx;
  }

  checkQueueHandleSendLotus(client, key, addressDonation, isWalletLotusDonation) {
    setInterval(() => {
      if (this.storage && this.storage.queue) {
        this.storage.queue.get((err, data) => {
          if (data) {
            const ackQueue = this.storage.queue.ack(data.ack, (err, id) => { });
            const saveError = (donationStorage, err) => {
              donationStorage.error = JSON.stringify(err);
              this.storage.updateDonation(donationStorage, err => {
                return ackQueue;
              });
            };
            const donationStorage: DonationStorage = data.payload;
            this.storage.storeDonation(donationStorage, err => {
              if (!isWalletLotusDonation) return saveError(donationStorage, 'Lotus Donation not exist Wallet AWS');
              if (err) return saveError(donationStorage, err);
              this.getRemainingInfo({}, (err, remainingData: DonationInfo) => {
                if (err) return saveError(donationStorage, err);
                if (remainingData.remaining < 0) saveError(donationStorage, 'RemainingLotus is over today');
                const txDonation = this._createOtpTxDonation(
                  addressDonation,
                  donationStorage.receiveLotusAddress,
                  remainingData.receiveAmountLotus
                );
                this._sendLotusDonation(client, key, txDonation, (err, txid) => {
                  if (err) return saveError(donationStorage, err);
                  donationStorage.txidGiveLotus = txid;
                  donationStorage.isGiven = true;
                  this.storage.updateDonation(donationStorage, err => {
                    return ackQueue;
                  });
                });
              });
            });
          }
        });
        this.storage.queue.clean(err => { });
      }
    }, 300000);
  }

  checkOrderInSwapQueue() {
    checkOrderInSwapQueueInterval = setInterval(() => {
      let listOrderInQueueIds = [];
      if (this.storage && this.storage.orderQueue) {
        this.storage.fetchAllOrderInfoInQueue((err, listOrderInQueue) => {
          if (listOrderInQueue && listOrderInQueue.length > 0) {
            listOrderInQueueIds = listOrderInQueue.map(s => s.payload);
          }
          this.storage.fetchAllOrderInfoNotInQueue((err, result) => {
            if (err) logger.debug('fetchAllOrderInfoNotInQueue error', err);
            else {
              if (result && result.length > 0) {
                const listOrderInfo: Order[] = result.map(item => Order.fromObj(item));
                this.storage.orderQueue.add(
                  listOrderInfo.filter(order => !listOrderInQueueIds.includes(order.id)).map(orderInfo => orderInfo.id),
                  (err, ids) => {
                    if (err) logger.debug('orderQueue add listOrderInfo error', err);
                  }
                );
              }
            }
          });
        });
      }
    }, 30 * 1000);
  }

  checkQueueHandleSwap() {
    swapQueueInterval = setInterval(() => {
      if (this.storage && this.storage.orderQueue) {
        this.storage.orderQueue.get(async (err, data) => {
          const saveError = (orderInfo, data, error, status?) => {
            let isOrderOutOfFund = false;
            if (error.message) {
              if (!error.code || (error.code && error.code !== 'ORDER_EXPIRED')) {
                orderInfo.error = error.message;
              }
            } else {
              orderInfo.error = JSON.stringify(error);
            }

            if (error.code && error.code !== 'ORDER_EXPIRED') {
              orderInfo.pendingReason = error.code;
            }

            if (error.code === 'EXCEED_DAILY_LIMIT') {
              if (orderInfo.listTxIdUserDeposit && orderInfo.listTxIdUserDeposit.length > 0) {
                orderInfo.status = 'pending';
              } else {
                orderInfo.status = 'expired';
              }
            } else if (error.code === 'ORDER_EXPIRED') {
              if (orderInfo.status === 'processing') {
                orderInfo.status = 'pending';
                if (orderInfo.pendingReason === 'OUT_OF_FUND') {
                  isOrderOutOfFund = true;
                }
              } else {
                orderInfo.status = 'expired';
              }
            } else {
              orderInfo.status = 'processing';
            }

            // TanDraft: calling if this order is having any notification yet ?
            let orderInfoNotiOpts = {};
            if (orderInfo.pendingReason) {
              orderInfoNotiOpts = {
                orderId: orderInfo.id,
                pendingReason: orderInfo.pendingReason
              };
            } else {
              orderInfoNotiOpts = {
                orderId: orderInfo.id,
                error: orderInfo.error
              };
            }
            if ((orderInfo.status === 'processing' && orderInfo.pendingReason !== 'OUT_OF_FUND') || isOrderOutOfFund) {
              this.storage.fetchOrderInfoNoti(orderInfoNotiOpts, (err, result) => {
                if (err) logger.debug(err);
                if (!result) {
                  this.storage.updateOrder(orderInfo, err => {
                    if (err) logger.debug(err);
                    this.storage.storeOrderInfoNoti(OrderInfoNoti.create(orderInfoNotiOpts), (err, result) => {
                      if (err) logger.debug(err);
                      // send message to channel Failure Convert Alert
                      botSwap.sendMessage(
                        config.swapTelegram.channelFailId,
                        'Order no.' + orderInfo.id + ' :: Failure reason :: ' + orderInfo.error,
                        {
                          parse_mode: 'HTML'
                        }
                      );
                      this.storage.orderQueue.ack(data.ack, (err, id) => { });
                    });
                  });
                }
              });
            } else {
              this.storage.updateOrder(orderInfo, err => {
                if (err) logger.debug(err);
                this.storage.orderQueue.ack(data.ack, (err, id) => { });
              });
            }
          };
          if (data) {
            const orderInfo = await this._getOrderInfo({ id: data.payload });
            if (['waiting', 'processing'].includes(orderInfo.status)) {
              try {
                logger.debug('orderinfo in queue detected: ', data);
                console.log('orderinfo in queue detected: ', data);
                const configSwap: ConfigSwap = await this.getConfigSwapWithPromise();
                const isValidOrder = await this.checkRequirementBeforeQueueExcetue(configSwap, orderInfo);
                if (isValidOrder) {
                  // get utxos for deposit address => checking amount user sent to deposit address
                  logger.debug('Order info is valid: ', orderInfo);
                  this.getUtxosForSelectedAddressAndWallet(
                    {
                      coin: orderInfo.isFromToken ? 'xec' : orderInfo.fromCoinCode,
                      network: orderInfo.fromNetwork,
                      addresses: orderInfo.isFromToken
                        ? [this._convertEtokenAddressToEcashAddress(orderInfo.adddressUserDeposit)]
                        : [orderInfo.adddressUserDeposit],
                      isTokenSupport: orderInfo.isFromToken,
                      tokenId: orderInfo.fromTokenId
                    },
                    (err, utxos) => {
                      try {
                        let amountDepositDetect = 0;
                        if (utxos && utxos.length > 0) {
                          // TanDraft: calling Order_Info_Noti check if having any txId in db

                          orderInfo.listTxIdUserDeposit = [];
                          _.each(utxos, utxo => {
                            if (orderInfo.isFromToken) {
                              amountDepositDetect += utxo.amountToken;
                            } else {
                              amountDepositDetect += utxo.satoshis;
                            }
                            // TanTODO: tmp  comment out notification for swap
                            // const orderInfoNotiOpts = {
                            //   orderId: orderInfo.id,
                            //   receivedTxId: utxo.txid
                            // };
                            // this.storage.fetchOrderInfoNoti(orderInfoNotiOpts, (err, result) => {
                            //   if (err) logger.debug(err);
                            //   if (!result) {
                            //     this.storage.storeOrderInfoNoti(
                            //       OrderInfoNoti.create(orderInfoNotiOpts),
                            //       (err, result) => {
                            //         if (err) logger.debug(err);
                            //         botSwap.sendMessage(
                            //           config.swapTelegram.channelSuccessId,
                            //           'Order no.' +
                            //             orderInfo.id +
                            //             ':: Amount received' +
                            //             '\n\n' +
                            //             this._addExplorerLinkIntoTxIdWithCoin(
                            //               utxo.txid,
                            //               orderInfo.fromCoinCode,
                            //               'View tx on the Explorer'
                            //             ),
                            //           {
                            //             parse_mode: 'HTML'
                            //           }
                            //         );
                            //       }
                            //     );
                            //   }
                            // });
                            orderInfo.listTxIdUserDeposit.push(utxo.txid);
                          });
                        }
                        const coinConfigReceiveSelected = configSwap.coinReceive.find(
                          coinConfig =>
                            coinConfig.code === orderInfo.toCoinCode && coinConfig.network === orderInfo.toNetwork
                        );
                        const fundAmountSat = _.toSafeInteger(coinConfigReceiveSelected.fundConvertToSat);
                        if (coinConfigReceiveSelected.dailyLimit && coinConfigReceiveSelected.dailyLimit > 0) {
                          if (coinConfigReceiveSelected.dailyLimitUsage > coinConfigReceiveSelected.dailyLimit) {
                            saveError(orderInfo, data, Errors.EXCEED_DAILY_LIMIT);
                            return;
                          }
                        }
                        if (amountDepositDetect > 0) {
                          const coinCode = orderInfo.isToToken ? 'xec' : orderInfo.toCoinCode;
                          const fundingWallet = clientsFund.find(
                            s => s.credentials.coin === coinCode && s.credentials.network === orderInfo.toNetwork
                          );
                          // checking rate again before creating tx
                          this._getRatesWithCustomFormat(async (err, rateList) => {
                            const updatedRate =
                              rateList[orderInfo.fromCoinCode].USD / rateList[orderInfo.toCoinCode].USD;
                            orderInfo.updatedRate = updatedRate;
                            // calculate updated rate compare with created rate , if more than 5% (later dynamic) , suspend transaction
                            if ((Math.abs(updatedRate - orderInfo.createdRate) / orderInfo.createdRate) * 100 > 5) {
                              saveError(orderInfo, data, Errors.NOT_STABLE_RATE, 'expired');
                              return;
                            }
                            // elseif((!orderInfo.amountFrom || orderInfo.amountFrom === 0)){
                            else {
                              const coinConfigSelected = configSwap.coinSwap.find(
                                coinConfig => coinConfig.code == orderInfo.fromCoinCode
                              );
                              const maxAmountSat = _.toSafeInteger(coinConfigSelected.maxConvertToSat);
                              const minAmountSat = _.toSafeInteger(coinConfigSelected.minConvertToSat);
                              orderInfo.actualSent = amountDepositDetect / orderInfo.fromSatUnit;
                              if (amountDepositDetect < minAmountSat) {
                                saveError(orderInfo, data, Errors.BELOW_MIN_LIMIT);
                                return;
                              }

                              if (maxAmountSat > 0 && amountDepositDetect > maxAmountSat) {
                                saveError(orderInfo, data, Errors.EXCEED_MAX_LIMIT);
                                return;
                              }
                              let amountUserDepositConverted = amountDepositDetect / orderInfo.fromSatUnit;
                              amountUserDepositConverted = _.toSafeInteger(amountUserDepositConverted);
                              this.walletId = fundingWallet.credentials.walletId;
                              this.copayerId = fundingWallet.credentials.copayerId;
                              let amountDepositInToCoinCodeUnit =
                                (amountDepositDetect / orderInfo.fromSatUnit) *
                                orderInfo.toSatUnit *
                                orderInfo.createdRate;

                              // TANTODO: in future remove for livenet , also apply for testnet
                              if (orderInfo.toNetwork === 'livenet') {
                                const feeCalculated = await this.calculateFee(
                                  amountDepositInToCoinCodeUnit / orderInfo.toSatUnit,
                                  orderInfo,
                                  rateList[orderInfo.toCoinCode.toLowerCase()].USD,
                                  configSwap.coinReceive.find(
                                    coin => coin.code === orderInfo.toCoinCode && coin.network === orderInfo.toNetwork
                                  )
                                );
                                if (amountDepositInToCoinCodeUnit < feeCalculated) {
                                  saveError(orderInfo, data, Errors.INVALID_AMOUNT);
                                  return;
                                }
                                amountDepositInToCoinCodeUnit -= feeCalculated;
                              }
                              if (amountDepositInToCoinCodeUnit > fundAmountSat) {
                                saveError(orderInfo, data, Errors.OUT_OF_FUND);
                                return;
                              }
                              if (amountDepositDetect === orderInfo.amountFrom) {
                                if (
                                  (Math.abs(amountDepositInToCoinCodeUnit - amountDepositInToCoinCodeUnit) /
                                    amountDepositInToCoinCodeUnit) *
                                  100 >
                                  2
                                ) {
                                  saveError(orderInfo, data, Errors.INVALID_AMOUNT);
                                } else {
                                  amountDepositInToCoinCodeUnit = orderInfo.amountTo;
                                }
                              }
                              if (orderInfo.isToToken) {
                                await this._sendSwapWithToken(
                                  'xec',
                                  fundingWallet,
                                  mnemonicKeyFund,
                                  orderInfo.toTokenId,
                                  null,
                                  amountDepositInToCoinCodeUnit,
                                  orderInfo.addressUserReceive,
                                  async (err, txId) => {
                                    if (err) {
                                      saveError(orderInfo, data, err);
                                      return;
                                    }
                                    orderInfo.status = 'complete';
                                    orderInfo.listTxIdUserReceive.push(txId);
                                    orderInfo.isSentToUser = true;
                                    orderInfo.actualReceived = amountDepositInToCoinCodeUnit / orderInfo.toSatUnit;
                                    if (coinConfigReceiveSelected.dailyLimit > 0) {
                                      const convertedActualReceivedToUsd =
                                        orderInfo.actualReceived * rateList[orderInfo.toCoinCode.toLowerCase()].USD;
                                      if (!coinConfigReceiveSelected.dailyLimitUsage) {
                                        coinConfigReceiveSelected.dailyLimitUsage = 0;
                                      }
                                      coinConfigReceiveSelected.dailyLimitUsage += convertedActualReceivedToUsd;
                                      await this._storeDailyLimitUsageForCoinConfig(coinConfigReceiveSelected);
                                    }
                                    this._sendSwapNotificationSuccess(configSwap, orderInfo, txId);
                                    this.storage.updateOrder(orderInfo, err => {
                                      if (err) saveError(orderInfo, data, err);
                                      return this.storage.orderQueue.ack(data.ack, (err, id) => { });
                                    });
                                  }
                                );
                              } else {
                                const txOptsSwap = this._createOtpTxSwap(
                                  orderInfo.isToToken ? 'xec' : orderInfo.toCoinCode,
                                  orderInfo.toNetwork,
                                  orderInfo.toCoinCode === 'bch'
                                    ? orderInfo.addressUserReceive.replace(/bitcoincash:/, '')
                                    : orderInfo.addressUserReceive,
                                  amountDepositInToCoinCodeUnit
                                );

                                this._sendSwap(fundingWallet, keyFund, txOptsSwap, async (err, txId) => {
                                  if (err) saveError(orderInfo, data, err);
                                  else {
                                    orderInfo.status = 'complete';
                                    orderInfo.listTxIdUserReceive.push(txId);
                                    orderInfo.isSentToUser = true;
                                    orderInfo.actualReceived = amountDepositInToCoinCodeUnit / orderInfo.toSatUnit;
                                    if (coinConfigReceiveSelected.dailyLimit > 0) {
                                      const convertedActualReceivedToUsd =
                                        orderInfo.actualReceived * rateList[orderInfo.toCoinCode.toLowerCase()].USD;
                                      if (!coinConfigReceiveSelected.dailyLimitUsage) {
                                        coinConfigReceiveSelected.dailyLimitUsage = 0;
                                      }
                                      coinConfigReceiveSelected.dailyLimitUsage += convertedActualReceivedToUsd;
                                      await this._storeDailyLimitUsageForCoinConfig(coinConfigReceiveSelected);
                                    }
                                    this._sendSwapNotificationSuccess(configSwap, orderInfo, txId);
                                    this.storage.updateOrder(orderInfo, err => {
                                      if (err) saveError(orderInfo, data, err);
                                      return this.storage.orderQueue.ack(data.ack, (err, id) => { });
                                    });
                                  }
                                });
                              }
                            }
                          });
                        }
                      } catch (e) {
                        saveError(orderInfo, data, e);
                      }
                    }
                  );
                }
              } catch (e) {
                saveError(orderInfo, data, e);
              }
              this.storage.updateOrder(orderInfo, err => {
                if (err) saveError(orderInfo, data, err);
                return this.storage.orderQueue.ack(data.ack, (err, id) => { });
              });
            } else {
              this.storage.orderQueue.ack(data.ack, (err, id) => { });
            }
          }
        });
        this.storage.orderQueue.clean(err => { });
      }
    }, 2000);
  }

  checkQueueHandleConversion() {
    conversionQueueInterval = setInterval(() => {
      if (this.storage && this.storage.conversionOrderQueue) {
        this.storage.conversionOrderQueue.get(async (err, data) => {
          const saveError = (conversionOrderInfo: IConversionOrder, data, error, status?) => {
            conversionOrderInfo.status = status || 'pending';
            if (error.message) {
              conversionOrderInfo.error = error.message;
            } else {
              conversionOrderInfo.error = JSON.stringify(error);
            }
            if (error.code) {
              conversionOrderInfo.pendingReason = error.code;
            }
            this.storage.updateConversionOrder(conversionOrderInfo, err => {
              // send message to channel Failure Convert Alert
              bot.sendMessage(
                config.telegram.channelFailId,
                conversionOrderInfo.addressFrom +
                ' :: Converted amount: ' +
                conversionOrderInfo.amountConverted.toFixed(3) +
                ' ' +
                config.conversion.tokenCodeUnit +
                '\n\n' +
                this._addExplorerLinkIntoTxIdWithCoin(
                  conversionOrderInfo.txIdFromUser,
                  'xec',
                  'View tx on the Explorer'
                ),
                { parse_mode: 'HTML' }
              );

              // send message to channel Debug Convert Alert
              bot.sendMessage(
                config.telegram.channelDebugId,
                new Date().toUTCString() +
                ' ::  error: ' +
                conversionOrderInfo.error +
                '\n\n' +
                this._addExplorerLinkIntoTxIdWithCoin(
                  conversionOrderInfo.txIdFromUser,
                  'xec',
                  'View tx on the Explorer'
                ),
                { parse_mode: 'HTML' }
              );
              if (err) throw new Error(err);
            });
          };
          if (data) {
            const conversionOrderInfo = await this._getConversionOrderInfo({ txIdFromUser: data.payload });
            if (conversionOrderInfo.status === 'waiting') {
              try {
                this.getTxDetailForXecWallet(conversionOrderInfo.txIdFromUser, async (err, result: TxDetail) => {
                  if (err) {
                    saveError(conversionOrderInfo, data, err);
                    return;
                  } else {
                    if (result) {
                      const outputsConverted = _.uniq(
                        _.map(result.outputs, item => {
                          return this._convertOutputTokenScript(item);
                        })
                      );
                      // convert outputscript to output address
                      const accountTo = outputsConverted.find(
                        output => !result.inputAddresses.includes(output.address)
                      );
                      accountTo.address = this._convertEtokenAddressToEcashAddress(accountTo.address);
                      accountTo.amount = accountTo.amount - 5000 - accountTo.amount / 100;
                      this._getRatesWithCustomFormat((err, rateList) => {
                        if (isNaN(rateList['xec'].USD)) {
                          saveError(conversionOrderInfo, data, Errors.NOT_FOUND_RATE_XEC);
                          return;
                        }
                        if (isNaN(rateList[config.conversion.tokenCodeLowerCase].USD)) {
                          saveError(conversionOrderInfo, data, Errors.NOT_FOUND_RATE_TOKEN);
                          return;
                        }
                        const rate = rateList['xec'].USD / rateList[config.conversion.tokenCodeLowerCase].USD;
                        const amountElpsSatoshis = accountTo.amount * rate;
                        const amountElps = amountElpsSatoshis / 10 ** 2;
                        conversionOrderInfo.addressFrom = result.inputAddresses[0];
                        conversionOrderInfo.amountConverted = amountElps;

                        if (!clientsFundConversion) {
                          saveError(conversionOrderInfo, data, Errors.NOT_FOUND_KEY_CONVERSION);
                          return;
                        } else {
                          const xecWallet = clientsFundConversion.find(
                            s =>
                              s.credentials.coin === 'xec' &&
                              s.credentials.network === 'livenet' &&
                              (s.credentials.rootPath.includes('1899') || s.credentials.rootPath.includes('145'))
                          );
                          if (!xecWallet) {
                            saveError(conversionOrderInfo, data, Errors.NOT_FOUND_KEY_CONVERSION);
                            return;
                          }
                          this.storage.fetchAddressByWalletId(
                            xecWallet.credentials.walletId,
                            accountTo.address.replace(/ecash:/, ''),
                            async (err, wallet) => {
                              if (err) {
                                saveError(conversionOrderInfo, data, err);
                                return;
                              }
                              if (!wallet) {
                                saveError(conversionOrderInfo, data, Errors.INVALID_ADDRESS_TO);
                                return;
                              } else {
                                let xecBalance = null;
                                xecBalance = await this.getBalanceWithPromise({
                                  walletId: xecWallet.credentials.walletId,
                                  coinCode: xecWallet.credentials.coin,
                                  network: xecWallet.credentials.network
                                }).catch(e => {
                                  saveError(conversionOrderInfo, data, e);
                                  return;
                                });
                                if (xecBalance && xecBalance.balance && _.isNumber(xecBalance.balance.totalAmount)) {
                                  if (xecBalance.balance.totalAmount <= 546) {
                                    saveError(conversionOrderInfo, data, Errors.INSUFFICIENT_FUND_XEC);
                                    this._handleWhenFundIsNotEnough(
                                      Errors.INSUFFICIENT_FUND_XEC.code,
                                      xecBalance.balance.totalAmount / 100,
                                      accountTo.address
                                    );
                                    return;
                                  }
                                  if (xecBalance.balance.totalAmount < config.conversion.minXecSatConversion) {
                                    this._handleWhenFundIsNotEnough(
                                      Errors.BELOW_MINIMUM_XEC.code,
                                      xecBalance.balance.totalAmount / 100,
                                      accountTo.address
                                    );
                                  }
                                } else {
                                  this._handleWhenFundIsNotEnough(
                                    Errors.INSUFFICIENT_FUND_XEC.code,
                                    0,
                                    accountTo.address
                                  );
                                  return;
                                }
                                // get balance of XEC Wallet and token elps
                                let balanceTokenFound = null;
                                balanceTokenFound = await this.getTokensWithPromise({
                                  walletId: xecWallet.credentials.walletId
                                });
                                if (balanceTokenFound && balanceTokenFound.length > 0) {
                                  const listBalanceTokenConverted = _.map(balanceTokenFound, item => {
                                    return {
                                      tokenId: item.tokenId,
                                      tokenInfo: item.tokenInfo,
                                      amountToken: item.amountToken,
                                      utxoToken: item.utxoToken
                                    } as TokenItem;
                                  });
                                  const tokenElps = listBalanceTokenConverted.find(
                                    // TANTODO: replace with tyd token id
                                    s => s.tokenId === config.conversion.tokenId
                                  );
                                  if (tokenElps) {
                                    if (tokenElps.amountToken < amountElps || tokenElps.amountToken < 1) {
                                      this._handleWhenFundIsNotEnough(
                                        Errors.INSUFFICIENT_FUND_TOKEN.code,
                                        tokenElps.amountToken,
                                        accountTo.address
                                      );
                                      saveError(conversionOrderInfo, data, Errors.INSUFFICIENT_FUND_TOKEN);
                                      return;
                                    }
                                    // from txId get txDetail
                                    if (tokenElps.amountToken < config.conversion.minTokenConversion) {
                                      this._handleWhenFundIsNotEnough(
                                        Errors.BELOW_MINIMUM_TOKEN.code,
                                        tokenElps.amountToken,
                                        accountTo.address
                                      );
                                    } else {
                                      this._sendSwapWithToken(
                                        'xec',
                                        xecWallet,
                                        mnemonicKeyFundConversion,
                                        tokenElps.tokenId,
                                        tokenElps,
                                        amountElpsSatoshis,
                                        result.inputAddresses[0],
                                        (err, txId) => {
                                          if (err) {
                                            saveError(conversionOrderInfo, data, err);
                                            return;
                                          }
                                          if (txId) {
                                            conversionOrderInfo.status = 'complete';
                                            conversionOrderInfo.txIdSentToUser = txId;
                                            bot.sendMessage(
                                              config.telegram.channelSuccessId,
                                              new Date().toUTCString() +
                                              ' :: ' +
                                              result.inputAddresses[0] +
                                              ' :: Converted amount: ' +
                                              amountElps.toFixed(3) +
                                              ' ' +
                                              config.conversion.tokenCodeUnit +
                                              '\n\n' +
                                              this._addExplorerLinkIntoTxIdWithCoin(
                                                conversionOrderInfo.txIdSentToUser,
                                                'xec',
                                                'View tx on the Explorer'
                                              ),
                                              { parse_mode: 'HTML' }
                                            );
                                            this.storage.updateConversionOrder(conversionOrderInfo, (err, result) => {
                                              setTimeout(() => {
                                                this.checkConversion(accountTo.address, (err, result) => {
                                                  if (err) logger.debug('error for checking conversion: ', err);
                                                });
                                              }, 1000 * 10); // 10 seconds later recheck fund to notify if we don't have enough balance after transaction
                                              if (err) {
                                                saveError(conversionOrderInfo, data, err);
                                                return;
                                              } else {
                                                this.storage.conversionOrderQueue.ack(data.ack, (err, id) => { });
                                              }
                                            });
                                          }
                                        }
                                      );
                                    }
                                  } else {
                                    saveError(conversionOrderInfo, data, Errors.NOT_FOUND_TOKEN_WALLET);
                                    return;
                                  }
                                } else {
                                  saveError(conversionOrderInfo, data, Errors.NOT_FOUND_TOKEN_WALLET);
                                  return;
                                }
                              }
                            }
                          );
                        }
                      });
                    }
                  }
                });
              } catch (e) {
                saveError(conversionOrderInfo, data, e);
              }
            } else {
              this.storage.conversionOrderQueue.ack(data.ack, (err, id) => { });
            }
          }
        });
        this.storage.conversionOrderQueue.clean(err => { });
      }
    }, 2000);
  }

  checkQueueHandleMerchantOrder() {
    merchantOrderQueueInterval = setInterval(() => {
      if (this.storage && this.storage.merchantOrderQueue) {
        this.storage.merchantOrderQueue.get(async (err, data, msg) => {
          const saveError = (merchantOrder: MerchantOrder, data, error) => {
            merchantOrder.status = 'pending';
            if (error.message) {
              merchantOrder.error = error.message;
            } else {
              merchantOrder.error = JSON.stringify(error);
            }
            this.storage.updateMerchantOrder(merchantOrder, err => {
              const actualAmountConverted =
                !!error.code && error.code === 'NOT_STABLE_RATE'
                  ? `:: Actual amount convert on server : ${merchantOrder.amountCalculated} ${config.conversion.tokenCodeUnit}`
                  : '';
              const stringConvert =
                !merchantOrder.isToken && !!merchantOrder.amountFrom && merchantOrder.amountFrom > 0
                  ? `:: Not able to convert ${merchantOrder.amountFrom} ${merchantOrder.coin.toUpperCase()} to ${merchantOrder.amount
                  } ${config.conversion.tokenCodeUnit}`
                  : '';
              // send message to channel Failure Convert Alert
              const failMessage = `${merchantOrder.userAddress} :: Elps amount: ${merchantOrder.amount.toFixed(3)} ${config.conversion.tokenCodeUnit
                } ${stringConvert} ${actualAmountConverted}`;
              bot.sendMessage(
                config.merchantOrder.channelFailId,
                failMessage +
                '\n\n' +
                this._addExplorerLinkIntoTxIdWithCoin(merchantOrder.txIdFromUser, 'xec', 'View tx on the Explorer'),
                { parse_mode: 'HTML' }
              );

              // send message to channel Debug Convert Alert
              const dateStr = new Date().toUTCString();
              const debugMessage = `${dateStr} :: error: ${merchantOrder.error} ${stringConvert} ${actualAmountConverted}`;
              bot.sendMessage(
                config.merchantOrder.channelDebugId,
                debugMessage +
                '\n\n' +
                this._addExplorerLinkIntoTxIdWithCoin(merchantOrder.txIdFromUser, 'xec', 'View tx on the Explorer'),
                { parse_mode: 'HTML' }
              );
              if (err) throw new Error(err);
            });
          };
          if (data) {
            const merchantOrder = await this._getMerchantOrder({ txIdFromUser: data.payload });
            if (merchantOrder.status === 'waiting') {
              try {
                // check valid signature if order payment type is burn
                if (merchantOrder.paymentType === PaymentType.BURN) {
                  // TANTMP: tmp disalbe signature for testing qpay from miniapp
                  // if (!merchantOrder.signature) {
                  //   saveError(merchantOrder, data, new Error('Missing signature'));
                  //   return;
                  // }
                  // const messageSignature =
                  //   merchantOrder.txIdFromUser + '-' + merchantOrder.merchantCode + '-' + merchantOrder.amount;
                  // let messagePrefix = '';
                  // let bchAddress = '';
                  // if (merchantOrder.coin === 'xec') {
                  //   const decoded = ecashaddr.decode(merchantOrder.userAddress);
                  //   bchAddress = ecashaddr.encode('bitcoincash', decoded.type, decoded.hash);
                  // } else {
                  //   bchAddress = Bitcore_[merchantOrder.coin].Address(merchantOrder.userAddress).toCashAddress();
                  // }
                  // let legacyAddress = bchjs.SLP.Address.toLegacyAddress(bchAddress);
                  // if (merchantOrder.coin === 'xec') {
                  //   messagePrefix = Constants.MESSAGE_PREFIX.XEC;
                  // } else {
                  //   messagePrefix = Constants.MESSAGE_PREFIX.XPI;
                  // }
                  // if (!messageLib.verify(messageSignature, legacyAddress, merchantOrder.signature, messagePrefix)) {
                  //   saveError(merchantOrder, data, new Error('Invalid signature'));
                  //   return;
                  // }
                }
                const txDetail =
                  merchantOrder.coin === 'xec'
                    ? await this.getTxDetailForXecWalletWithPromise(merchantOrder.txIdFromUser)
                    : await this.getTxDetailForWalletWithPromise(merchantOrder.txIdFromUser, merchantOrder.coin);
                const outputsConverted = _.uniq(
                  _.map(txDetail.outputs, item => {
                    return this._convertOutputScript(merchantOrder.coin, item);
                  })
                );
                let accountTo = null;
                // convert outputscript to output address
                accountTo = outputsConverted.find(
                  output => !!output && !!output.address && !txDetail.inputAddresses.includes(output.address)
                );
                if (merchantOrder.isToken && !!txDetail.slpTxData.slpMeta.tokenId) {
                  if (
                    !txDetail ||
                    !txDetail.slpTxData ||
                    !txDetail.slpTxData.slpMeta ||
                    txDetail.slpTxData.slpMeta.tokenId !== config.conversion.tokenId
                  ) {
                    saveError(merchantOrder, data, new Error('Invalid token support'));
                    return;
                  }
                  accountTo = outputsConverted.find(
                    output =>
                      !!output &&
                      !!output.address &&
                      !txDetail.inputAddresses.includes(output.address) &&
                      output.address.includes('etoken')
                  );
                  accountTo.address = this._convertEtokenAddressToEcashAddress(accountTo.address);
                }
                if (!accountTo) {
                  saveError(merchantOrder, data, new Error('Can not find destination address from user tx detail'));
                }

                if (!clientsFundConversion) {
                  saveError(merchantOrder, data, Errors.NOT_FOUND_KEY_CONVERSION);
                  return;
                } else {
                  const xecWallet = clientsFundConversion.find(
                    s => s.credentials.coin === 'xec' && s.credentials.network === 'livenet' && s.credentials.isSlpToken
                  );
                  if (!xecWallet) {
                    saveError(merchantOrder, data, Errors.NOT_FOUND_KEY_CONVERSION);
                    return;
                  }
                  let walletSelected = xecWallet;
                  const xpiWallet = clientsFundConversion.find(
                    s => s.credentials.coin === 'xpi' && s.credentials.network === 'livenet'
                  );
                  if (merchantOrder.coin === 'xpi' && !xpiWallet) {
                    saveError(merchantOrder, data, Errors.NOT_FOUND_KEY_CONVERSION);
                    return;
                  }
                  if (merchantOrder.coin === 'xpi') {
                    walletSelected = xpiWallet;
                  }
                  const addressOfFundingWallet = await this._fetchAddressByWalletIdWithPromise(
                    walletSelected.credentials.walletId,
                    accountTo.address.replace(/ecash:/, '')
                  );
                  let xecBalance = null;
                  xecBalance = await this.getBalanceWithPromise({
                    walletId: xecWallet.credentials.walletId,
                    coinCode: xecWallet.credentials.coin,
                    network: xecWallet.credentials.network
                  }).catch(e => {
                    saveError(merchantOrder, data, e);
                    return;
                  });
                  const walletEcashAddress = await this._getWalletAddressByWalletId(xecWallet.credentials.walletId);
                  if (xecBalance && xecBalance.balance && _.isNumber(xecBalance.balance.totalAmount)) {
                    if (xecBalance.balance.totalAmount <= 546) {
                      saveError(merchantOrder, data, Errors.INSUFFICIENT_FUND_XEC);
                      this._handleWhenFundIsNotEnough(
                        Errors.INSUFFICIENT_FUND_XEC.code,
                        xecBalance.balance.totalAmount / 100,
                        walletEcashAddress
                      );
                      return;
                    }
                    if (xecBalance.balance.totalAmount < config.conversion.minXecSatConversion) {
                      this._handleWhenFundIsNotEnough(
                        Errors.BELOW_MINIMUM_XEC.code,
                        xecBalance.balance.totalAmount / 100,
                        walletEcashAddress
                      );
                    }
                  } else {
                    this._handleWhenFundIsNotEnough(Errors.INSUFFICIENT_FUND_XEC.code, 0, walletEcashAddress);
                    return;
                  }
                  // get balance of XEC Wallet and token elps
                  let balanceTokenFound = null;
                  balanceTokenFound = await this.getTokensWithPromise({
                    walletId: xecWallet.credentials.walletId
                  });
                  if (balanceTokenFound && balanceTokenFound.length > 0) {
                    const listBalanceTokenConverted = _.map(balanceTokenFound, item => {
                      return {
                        tokenId: item.tokenId,
                        tokenInfo: item.tokenInfo,
                        amountToken: item.amountToken,
                        utxoToken: item.utxoToken
                      } as TokenItem;
                    });
                    const tokenElps = listBalanceTokenConverted.find(
                      // TANTODO: replace with tyd token id
                      s => s.tokenId === config.conversion.tokenId
                    );
                    if (tokenElps) {
                      if (tokenElps.amountToken < 1) {
                        this._handleWhenFundIsNotEnough(
                          Errors.INSUFFICIENT_FUND_TOKEN.code,
                          tokenElps.amountToken,
                          walletEcashAddress
                        );
                        saveError(merchantOrder, data, Errors.INSUFFICIENT_FUND_TOKEN);
                        return;
                      }
                      // from txId get txDetail
                      if (tokenElps.amountToken < config.conversion.minTokenConversion) {
                        this._handleWhenFundIsNotEnough(
                          Errors.BELOW_MINIMUM_TOKEN.code,
                          tokenElps.amountToken,
                          walletEcashAddress
                        );
                      } else {
                        // get merchant info by merchant code
                        let amountCoinUserSentToServer = 0;
                        let amountElps = 0;
                        const listMerchant = await this.getListMerchantInfo();
                        const merchant = listMerchant.find(s => s.code === merchantOrder.merchantCode);
                        const merchantEtokenAddress = this._convertFromEcashWithPrefixToEtoken(merchant.walletAddress);
                        if (merchantOrder.isToken) {
                          amountElps = accountTo.amount / 10 ** tokenElps.tokenInfo.decimals;
                        } else {
                          const rateList = await this._getRatesCustomFormatWithPromise();
                          if (isNaN(rateList['xec'].USD)) {
                            saveError(merchantOrder, data, Errors.NOT_FOUND_RATE_XEC);
                            return;
                          }
                          if (isNaN(rateList[config.conversion.tokenCodeLowerCase].USD)) {
                            saveError(merchantOrder, data, Errors.NOT_FOUND_RATE_TOKEN);
                            return;
                          }
                          accountTo.amount = accountTo.amount / Constants.UNITS[merchantOrder.coin].toSatoshis;
                          amountCoinUserSentToServer = accountTo.amount;
                          accountTo.amount = this._calculateRaipayFee(merchantOrder.coin, accountTo.amount);
                          const rate =
                            rateList[merchantOrder.coin].USD / rateList[config.conversion.tokenCodeLowerCase].USD;
                          amountElps = accountTo.amount * rate;
                        }
                        amountElps = _.toSafeInteger(amountElps * 10 ** tokenElps.tokenInfo.decimals);
                        amountElps = amountElps / 10 ** tokenElps.tokenInfo.decimals;
                        merchantOrder.amountCalculated = amountElps;
                        if ((Math.abs(amountElps - merchantOrder.amount) / merchantOrder.amount) * 100 > 2) {
                          saveError(merchantOrder, data, Errors.NOT_STABLE_RATE);
                          return;
                        }
                        amountElps = merchantOrder.amount;
                        const amountElpsSataoshi = amountElps * 10 ** tokenElps.tokenInfo.decimals;
                        if (tokenElps.amountToken < amountElps) {
                          this._handleWhenFundIsNotEnough(
                            Errors.INSUFFICIENT_FUND_TOKEN.code,
                            tokenElps.amountToken,
                            walletEcashAddress
                          );
                          saveError(merchantOrder, data, Errors.INSUFFICIENT_FUND_TOKEN);
                          return;
                        }
                        if (amountElps)
                          if (merchantOrder.paymentType === PaymentType.BURN) {
                            // burn token right here
                            this._sendSwapWithToken(
                              'xec',
                              xecWallet,
                              mnemonicKeyFundConversion,
                              tokenElps.tokenId,
                              tokenElps,
                              amountElpsSataoshi,
                              null,
                              (err, txId) => {
                                if (err) {
                                  saveError(merchantOrder, data, err);
                                  return;
                                }
                                if (txId) {
                                  this._burnToken(
                                    'xec',
                                    xecWallet,
                                    mnemonicKeyFundConversion,
                                    tokenElps.tokenId,
                                    amountElpsSataoshi,
                                    txId,
                                    async (err, txId) => {
                                      if (err) {
                                        saveError(merchantOrder, data, err);
                                        return;
                                      }
                                      merchantOrder.txIdMerchantPayment = txId;
                                      merchantOrder.status = 'complete';
                                      this._handleSendSuccesMerchantOrder(
                                        amountCoinUserSentToServer,
                                        amountElps,
                                        merchantOrder,
                                        merchant.name
                                      );
                                      this.storage.updateMerchantOrder(merchantOrder, (err, result) => {
                                        setTimeout(() => {
                                          this.checkMerchantConversion(walletEcashAddress, 'xec', (err, result) => {
                                            if (err) logger.debug('error for checking conversion: ', err);
                                          });
                                        }, 1000 * 10); // 10 seconds later recheck fund to notify if we don't have enough balance after transaction
                                        if (err) {
                                          saveError(merchantOrder, data, err);
                                          return;
                                        } else {
                                          this.storage.merchantOrderQueue.ack(data.ack, (err, id) => { });
                                        }
                                      });
                                    }
                                  );
                                }
                              }
                            );
                          } else {
                            // send elps to merchant address
                            this._sendSwapWithToken(
                              'xec',
                              xecWallet,
                              mnemonicKeyFundConversion,
                              tokenElps.tokenId,
                              tokenElps,
                              amountElpsSataoshi,
                              merchantEtokenAddress,
                              async (err, txId) => {
                                if (err) {
                                  saveError(merchantOrder, data, err);
                                  return;
                                }
                                if (txId) {
                                  merchantOrder.txIdMerchantPayment = txId;
                                  merchantOrder.status = 'complete';
                                  this._handleSendSuccesMerchantOrder(
                                    amountCoinUserSentToServer,
                                    amountElps,
                                    merchantOrder,
                                    merchant.name
                                  );
                                  this.storage.updateMerchantOrder(merchantOrder, (err, result) => {
                                    setTimeout(() => {
                                      this.checkMerchantConversion(walletEcashAddress, 'xec', (err, result) => {
                                        if (err) logger.debug('error for checking conversion: ', err);
                                      });
                                    }, 1000 * 10); // 10 seconds later recheck fund to notify if we don't have enough balance after transaction
                                    if (err) {
                                      saveError(merchantOrder, data, err);
                                      return;
                                    } else {
                                      this.storage.merchantOrderQueue.ack(data.ack, (err, id) => { });
                                    }
                                  });
                                }
                              }
                            );
                          }
                      }
                    } else {
                      saveError(merchantOrder, data, Errors.NOT_FOUND_TOKEN_WALLET);
                      return;
                    }
                  } else {
                    saveError(merchantOrder, data, Errors.NOT_FOUND_TOKEN_WALLET);
                    return;
                  }
                }
              } catch (e) {
                saveError(merchantOrder, data, e);
              }
            } else {
              this.storage.merchantOrderQueue.ack(data.ack, (err, id) => { });
            }
          }
        });
        this.storage.merchantOrderQueue.clean(err => { });
      }
    }, 2000);
  }
  async _handleSendSuccesMerchantOrder(
    amountCoinUserSentToServer,
    amountElps,
    merchantOrder: MerchantOrder,
    merchantName,
    isPaidByUser = false
  ) {
    if (amountCoinUserSentToServer > 0) {
      bot.sendMessage(
        config.merchantOrder.channelSuccessId,
        merchantOrder.userAddress +
        ' :: Converted ' +
        amountCoinUserSentToServer +
        ' ' +
        merchantOrder.coin.toUpperCase() +
        ' to ' +
        amountElps.toFixed(2) +
        ' ' +
        config.conversion.tokenCodeUnit +
        ' :: ' +
        this._getPaymentTypeString(merchantOrder.paymentType) +
        ' : ' +
        amountElps.toFixed(2) +
        ' ' +
        config.conversion.tokenCodeUnit +
        ' to ' +
        merchantName +
        '\n\n' +
        this._addExplorerLinkIntoTxIdWithCoin(merchantOrder.txIdMerchantPayment, 'xec', 'View tx on the Explorer'),
        { parse_mode: 'HTML' }
      );
    } else {
      bot.sendMessage(
        config.merchantOrder.channelSuccessId,
        merchantOrder.userAddress +
        ' :: ' +
        this._getPaymentTypeString(merchantOrder.paymentType) +
        ' : ' +
        amountElps.toFixed(2) +
        ' ' +
        config.conversion.tokenCodeUnit +
        ' to ' +
        merchantName +
        (isPaidByUser ? ' :: is Paid by user' : '') +
        '\n\n' +
        this._addExplorerLinkIntoTxIdWithCoin(
          isPaidByUser ? merchantOrder.txIdFromUser : merchantOrder.txIdMerchantPayment,
          'xec',
          'View tx on the Explorer'
        ),
        { parse_mode: 'HTML' }
      );
    }
    if (!!merchantOrder.listEmailContent && merchantOrder.listEmailContent.length > 2) {
      let contentEmail = merchantOrder.listEmailContent[2];
      bot.sendMessage(config.merchantOrder.channelSuccessId, contentEmail, { parse_mode: 'HTML' });
    }
    await this._handleEmailNotificationForMerchantOrder(merchantOrder);
  }

  _getPaymentTypeString(paymentType: PaymentType): string {
    switch (paymentType) {
      case PaymentType.BURN:
        return 'BURNED';
      case PaymentType.SEND:
        return 'PAID';
      default:
        return '';
    }
  }
  // get fee coin
  _calculateRaipayFee(coin: string, amount: number): number {
    if (!!raipayFee && raipayFee.length > 0) {
      const raipayFeeConverted: RaipayFee[] = raipayFee.map(fee => RaipayFee.create(fee));
      const feeSelected = raipayFeeConverted.find(s => s.coin === coin);
      if (!!feeSelected) {
        amount -= (feeSelected.feePercentage * amount) / 100;
        amount -= feeSelected.feeQuantity;
        return amount;
      } else return amount;
    } else {
      return amount;
    }
  }
  _sendSwapNotificationSuccess(configSwap: ConfigSwap, orderInfo: Order, txId: string) {
    const coinConfigReceive = configSwap.coinReceive.find(coin => coin.code === orderInfo.toCoinCode);
    if (coinConfigReceive) {
      const balanceTo = coinConfigReceive.fundConvertToSat / orderInfo.toSatUnit - orderInfo.actualReceived;
      const unitFrom = orderInfo.isFromToken ? orderInfo.fromTokenInfo.symbol : orderInfo.fromCoinCode.toUpperCase();
      const unitTo = orderInfo.isToToken ? orderInfo.toTokenInfo.symbol : orderInfo.toCoinCode.toUpperCase();
      botSwap.sendMessage(
        config.swapTelegram.channelSuccessId,
        'Completed :: ' +
        'Order no.' +
        orderInfo.id +
        ' :: ' +
        orderInfo.actualSent.toLocaleString('en-US') +
        ' ' +
        unitFrom +
        ' to ' +
        orderInfo.actualReceived.toLocaleString('en-US') +
        ' ' +
        unitTo +
        ' :: ' +
        'Balance: ' +
        balanceTo.toLocaleString('en-US') +
        ' ' +
        unitTo +
        '\n\n' +
        this._addExplorerLinkIntoTxIdWithCoin(txId, orderInfo.toCoinCode, 'View tx on the Explorer'),
        {
          parse_mode: 'HTML'
        }
      );
      const balanceToSat = balanceTo * orderInfo.toSatUnit;
      if (balanceToSat < coinConfigReceive.minConvertToSat) {
        const moneyWithWingsIcon = '\u{1F4B8}';
        botSwap.sendMessage(
          config.swapTelegram.channelFailId,
          moneyWithWingsIcon +
          ' FUND ' +
          orderInfo.toCoinCode.toUpperCase() +
          ' IS OUT OF FUND, PLEASE TOP UP! \n' +
          'Remaining balance: ' +
          balanceTo +
          ' ' +
          unitTo
        );
      }
    }
  }
  _storeDailyLimitUsageForCoinConfig(coinConfig: CoinConfig): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.storage.updateDailyLimitCoinConfig(coinConfig, (err, result) => {
        if (err) reject(err);
        resolve(true);
      });
    });
  }

  _addExplorerLinkIntoTxIdWithCoin(txId: string, coinCode?: string, message?: string): string {
    let link = 'https://explorer.e.cash/tx/';
    if (coinCode && coinCode.toLowerCase() === 'xpi') {
      link = 'https://explorer.givelotus.org/tx/';
    }
    const linkWithTxid = link + txId;
    if (!message) {
      return `<a href=\"${linkWithTxid}\">${txId}</a>`;
    } else {
      return `<a href=\"${linkWithTxid}\">${message}</a>`;
    }
  }

  _handleWhenFundIsNotEnough(pendingReason: string, remaining: number, addressTopupEcash: string) {
    const addressTopupEtoken = this._convertFromEcashWithPrefixToEtoken(addressTopupEcash);
    const moneyWithWingsIcon = '\u{1F4B8}';
    if (!isNotiFundXecBelowMinimumToTelegram && pendingReason === Errors.BELOW_MINIMUM_XEC.code) {
      bot.sendMessage(
        config.telegram.channelFailId,
        moneyWithWingsIcon +
        ' FUND XEC REACHED THRESHOLD LIMIT, PLEASE TOP UP! - Remaining: ' +
        remaining +
        ' XEC - ' +
        addressTopupEcash
      );
      isNotiFundXecBelowMinimumToTelegram = true;
      setTimeout(() => {
        isNotiFundXecBelowMinimumToTelegram = false;
      }, 1000 * 60 * 30);
    } else if (!isNotiFundTokenBelowMinimumToTelegram && pendingReason === Errors.BELOW_MINIMUM_TOKEN.code) {
      bot.sendMessage(
        config.telegram.channelFailId,
        moneyWithWingsIcon +
        ' FUND TOKEN REACHED THRESHOLD LIMIT, PLEASE TOP UP! - Remaining: ' +
        remaining +
        ' ' +
        config.conversion.tokenCodeUnit +
        ' - ' +
        addressTopupEtoken
      );
      isNotiFundTokenBelowMinimumToTelegram = true;
      setTimeout(() => {
        isNotiFundTokenBelowMinimumToTelegram = false;
      }, 1000 * 60 * 30);
    }
    if (!isNotiFundXecInsufficientMinimumToTelegram && pendingReason === Errors.INSUFFICIENT_FUND_XEC.code) {
      bot.sendMessage(
        config.telegram.channelFailId,
        moneyWithWingsIcon +
        ' INSUFFICIENT XEC FUND. SWAP SERVICE IS PENDING PLEASE TOP UP! - Remaining: ' +
        remaining +
        ' XEC - ' +
        addressTopupEcash
      );
      isNotiFundXecInsufficientMinimumToTelegram = true;
      setTimeout(() => {
        isNotiFundXecInsufficientMinimumToTelegram = false;
      }, 1000 * 60 * 30);
    } else if (!isNotiFundTokenInsufficientMinimumToTelegram && pendingReason === Errors.INSUFFICIENT_FUND_TOKEN.code) {
      bot.sendMessage(
        config.telegram.channelFailId,
        moneyWithWingsIcon +
        ' INSUFFICIENT TOKEN FUND. SWAP SERVICE IS PENDING PLEASE TOP UP! - Remaining: ' +
        remaining +
        ' ' +
        config.conversion.tokenCodeUnit +
        ' - ' +
        addressTopupEtoken
      );
      isNotiFundTokenInsufficientMinimumToTelegram = true;
      setTimeout(() => {
        isNotiFundTokenInsufficientMinimumToTelegram = false;
      }, 1000 * 60 * 30);
    }
  }
  /**
   * Returns order info.
   * @param {Object} opts
   * @param {String} opts.txIdFromUser - The order info id requested.
   * @returns {Object} order - The order info.
   */
  _getConversionOrderInfo(opts): Promise<ConversionOrder> {
    return new Promise((resolve, reject) => {
      this.storage.fetchConversionOrderInfoByTxIdFromUser(opts.txIdFromUser, (err, result) => {
        if (err) reject(err);
        const conversionOrderInfo = ConversionOrder.fromObj(result);
        resolve(conversionOrderInfo);
      });
    });
  }

  _getMerchantOrder(opts): Promise<MerchantOrder> {
    return new Promise((resolve, reject) => {
      this.storage.fetchMerchantOrderByTxIdFromUser(opts.txIdFromUser, (err, result) => {
        if (err) return reject(err);
        const merchantOrder = MerchantOrder.fromObj(result);
        return resolve(merchantOrder);
      });
    });
  }

  stopHandleSwapQueue(): boolean {
    try {
      clearInterval(swapQueueInterval);
      return true;
    } catch (e) {
      logger.debug(e);
      return false;
    }
  }

  restartHandleSwapQueue(cb) {
    try {
      clearInterval(swapQueueInterval);
      this.getKeyFundAndReceiveWithFundMnemonic(err => {
        if (err) return cb(err);
        this.checkQueueHandleSwap();
        return cb(null, true);
      });
    } catch (e) {
      logger.debug(e);
      return cb(e);
    }
  }

  checkSwapQueue(cb) {
    try {
      if (!!swapQueueInterval) {
        return cb(null, true);
      } else {
        return cb(null, false);
      }
    } catch (e) {
      logger.debug(e);
      return cb(e);
    }
  }

  initCheckQueue() {
    this.checkMerchantOrderQueueAndNoti();
    this.checkConversionOrderQueueAndNoti();
    this.checkSwapQueueAndNoti();
  }

  checkMerchantOrderQueueAndNoti() {
    setInterval(() => {
      if (!merchantOrderQueueInterval) {
        merchantQueueFailed += 1;
        if (merchantQueueFailed > NOTI_AFTER_MANY_RESTART) {
          merchantQueueFailed = 0;
          merchantNotiCount += 1;
          // notification to telegram
          if (merchantNotiCount < MAXIMUM_NOTI + 1) {
            botSwap.sendMessage(
              config.queueNoti.channelId,
              `Merchant service is not running. Try to restart (${merchantNotiCount})…`
            );
          }
        } else {
          this.restartHandleMerchantQueue((err, result) => {
            if (err) logger.debug('Restart merchant order queue error: ', err);
          });
        }
      } else {
        if (merchantQueueFailed > 0) {
          botSwap.sendMessage(config.queueNoti.channelId, 'Merchant service is running');
        }
        merchantNotiCount = 0;
        merchantQueueFailed = 0;
      }
    }, GAP_RESTART_QUEUE * 10 * 1000); // 5 min
  }

  checkConversionOrderQueueAndNoti() {
    setInterval(() => {
      if (!conversionQueueInterval) {
        conversionQueueFailed += 1;
        if (conversionQueueFailed > NOTI_AFTER_MANY_RESTART) {
          conversionQueueFailed = 0;
          conversionNotiCount += 1;
          // notification to telegram
          if (conversionNotiCount < MAXIMUM_NOTI + 1) {
            botSwap.sendMessage(
              config.queueNoti.channelId,
              `Conversion service is not running. Try to restart (${conversionNotiCount})…`
            );
          }
        } else {
          this.restartHandleConversionQueue((err, result) => {
            if (err) logger.debug('Restart conversion order queue error: ', err);
          });
        }
      } else {
        if (conversionQueueFailed > 0) {
          botSwap.sendMessage(config.queueNoti.channelId, 'Conversion service is running');
        }
        conversionNotiCount = 0;
        conversionQueueFailed = 0;
      }
    }, GAP_RESTART_QUEUE * 10 * 1000); // 5 min
  }

  checkSwapQueueAndNoti() {
    setInterval(() => {
      if (!swapQueueInterval) {
        swapQueueFailed += 1;
        if (swapQueueFailed > NOTI_AFTER_MANY_RESTART) {
          swapQueueFailed = 0;
          swapNotiCount += 1;
          // notification to telegram
          if (swapNotiCount < MAXIMUM_NOTI + 1) {
            botSwap.sendMessage(
              config.queueNoti.channelId,
              `Swap service is not running. Try to restart (${swapNotiCount})…`
            );
          }
        } else {
          this.restartHandleSwapQueue((err, result) => {
            if (err) logger.debug('Restart swap queue error: ', err);
          });
        }
      } else {
        if (swapQueueFailed > 0) {
          botSwap.sendMessage(config.queueNoti.channelId, 'Swap service is running');
        }
        swapNotiCount = 0;
        swapQueueFailed = 0;
      }
    }, GAP_RESTART_QUEUE * 60 * 1000); // 5 min
  }

  restartHandleConversionQueue(cb) {
    try {
      clearInterval(conversionQueueInterval);
      this.getKeyConversionWithFundMnemonic(err => {
        if (err) return cb(err);
        this.checkQueueHandleConversion();
        return cb(null, true);
      });
    } catch (e) {
      logger.debug(e);
      return cb(e);
    }
  }

  stopHandleConversionQueue(cb): boolean {
    try {
      clearInterval(conversionQueueInterval);
      return cb(null, true);
    } catch (e) {
      logger.debug(e);
      return cb(e);
    }
  }

  restartHandleMerchantQueue(cb) {
    try {
      clearInterval(merchantOrderQueueInterval);
      this.getKeyConversionWithFundMnemonic(err => {
        if (err) return cb(err);
        this.checkQueueHandleMerchantOrder();
        return cb(null, true);
      });
    } catch (e) {
      logger.debug(e);
      return cb(e);
    }
  }

  stopHandleMerchantQueue(cb): boolean {
    try {
      clearInterval(merchantOrderQueueInterval);
      return cb(null, true);
    } catch (e) {
      logger.debug(e);
      return cb(e);
    }
  }

  calculateFee(amount: number, order: Order, rateUsd: number, coinConfig: CoinConfig): Promise<number> {
    return new Promise(async (resolve, reject) => {
      // amount should be in to coin code unit
      let feeCalculated = 0;
      let networkFee = 0;
      if (coinConfig.serviceFee > 0) {
        feeCalculated = (coinConfig.serviceFee * amount) / 100;
      }
      if (!coinConfig.isToken) {
        if (coinConfig.networkFee > 0) {
          feeCalculated += coinConfig.networkFee;
        }
      }
      if (coinConfig.settleFee > 0) {
        // settle fee default calculated in usd
        const settleFeecConvertedToCoinUnit = coinConfig.settleFee / rateUsd;
        feeCalculated += settleFeecConvertedToCoinUnit;
      }
      resolve(order.toSatUnit * feeCalculated);
    });
  }

  async checkRequirementBeforeQueueExcetue(configSwap: ConfigSwap, orderInfo: Order) {
    let listCoinReceiveCode = [];
    let listCoinSwapCode = [];
    if (orderInfo) {
      if (!(orderInfo.fromCoinCode && orderInfo.toCoinCode && orderInfo.createdRate && orderInfo.addressUserReceive)) {
        throw new Error(Errors.MISSING_REQUIRED_FIELD as unknown as string);
      }

      if (
        orderInfo.isFromToken &&
        (!orderInfo.fromTokenId || !(orderInfo.fromTokenInfo && orderInfo.fromTokenInfo.decimals))
      ) {
        throw new Error(Errors.MISSING_REQUIRED_FIELD as unknown as string);
      }

      if (orderInfo.isToToken && (!orderInfo.toTokenId || !(orderInfo.toTokenInfo && orderInfo.toTokenInfo.decimals))) {
        throw new Error(Errors.MISSING_REQUIRED_FIELD as unknown as string);
      }

      const now = new Date();
      if (orderInfo.createdOn && orderInfo.endedOn && orderInfo.endedOn < now) {
        throw Errors.ORDER_EXPIRED;
      }
    } else throw new Error('Not found Order info');

    if (configSwap) {
      if (!configSwap.coinReceive || !configSwap.coinSwap) {
        throw new Error('Not found coin config for exchange');
      }

      const indexCoinReceiveFound = configSwap.coinReceive.findIndex(
        config => config.network === orderInfo.toNetwork && config.code === orderInfo.toCoinCode
      );
      const indexCoinSwapfound = configSwap.coinSwap.findIndex(
        config => config.network === orderInfo.fromNetwork && config.code === orderInfo.fromCoinCode
      );
      if (indexCoinReceiveFound < 0 || indexCoinSwapfound < 0) {
        throw new Error(Errors.NOT_FOUND_COIN_IN_CONFIG as unknown as string);
      }
    } else throw new Error('Not found config swap');
    return true;
  }

  confirmationAndBroadcastRawTx(wallet, txp, sub, cb) {
    this.storage.storeTxConfirmationSub(sub, err => {
      if (err) logger.error('Could not store Tx confirmation subscription: %o', err);

      let raw;
      try {
        raw = txp.getRawTx();
      } catch (ex) {
        return cb(ex);
      }
      this._broadcastRawTx(wallet.chain, wallet.network, raw, (err, txid) => {
        if (err || txid != txp.txid) {
          const broadcastErr = err?.response ? this._cleanLogArgs(err)[0] : err?.stack || err?.message || err;
          this.logw('Broadcast failed: %o %o %o %o %o', wallet.id, wallet.chain, wallet.network, raw, broadcastErr);

          // Check if tx already in blockchain
          this._checkTxInBlockchain(txp, (err, isInBlockchain) => {
            if (err) return cb(err);
            if (!isInBlockchain) return cb(broadcastErr || 'broadcast error');

            this._processBroadcast(
              txp,
              {
                byThirdParty: true
              },
              cb
            );
          });
        } else {
          this._processBroadcast(
            txp,
            {
              byThirdParty: false
            },
            err => {
              if (err) return cb(err);
              return cb(null, txp);
            }
          );
        }
      });
    });
  }

  convertCoinToUSD(amount, coin, cp) {
    this.getFiatRates({}, (err, rates) => {
      if (err) return err;
      let unitToSatoshi = 100000000;
      if (coin === 'xpi') {
        unitToSatoshi = 1000000;
      } else if (coin === 'xec') {
        unitToSatoshi = 100;
      }
      const rateCoin = _.find(rates[coin], item => item.code == 'USD');
      if (_.isEmpty(rateCoin || rateCoin.rate)) return cp('no rate');
      const amountUSD = amount * (1 / unitToSatoshi) * rateCoin.rate;
      return cp(null, amountUSD);
    });
  }

  convertUSDToSatoshiLotus(amountUSD, coin, cp) {
    const option = {
      coin,
      code: 'USD'
    };
    this.getFiatRatesByCoin(option, (err, rate) => {
      let satoshiLotus = 0;
      if (err) return cp(satoshiLotus);
      const rateCoin = rate[0].rate ? rate[0].rate : rate.rate;
      if (rateCoin == 0 || !rateCoin) return cp(satoshiLotus);
      const amoutLotus = _.toNumber(((1.1 * amountUSD) / rateCoin).toFixed(2)); // bonus 10% xpi;
      satoshiLotus = amoutLotus * 1e6;
      return cp(satoshiLotus);
    });
  }

  checkAmoutToSendLostus(txp, cb) {
    this.convertCoinToUSD(txp.outputs[0].amount, txp.coin, (err, amountUsd) => {
      if (err) return cb(err);
      if (amountUsd + amountUsd * 0.1 < config.donationRemaining.minMoneydonation)
        return cb('not enough money donation to receive lotus');
      this.getRemainingInfo({}, (err, remainingData: DonationInfo) => {
        if (err) return cb(err);
        if (remainingData.remaining < remainingData.receiveAmountLotus) return cb('not enough Lotus to give');
        return cb(null, true);
      });
    });
  }

  getCurrentRate(orderInfo: Order, cb) {
    // checking rate again before sending txp
    this._getRatesWithCustomFormat((err, rateList) => {
      const rate = rateList[orderInfo.fromCoinCode].USD / rateList[orderInfo.toCoinCode].USD;
      return cb(null, rate);
    });
  }

  _getRatesWithCustomFormat(cb) {
    let rateList = [];
    // for (const coin of this.currencyProvider.getAvailableCoins()) {
    //   rateList[coin.toLowerCase()] = { USD: 0 };
    // }
    this.getFiatRates({}, (err, fiatRates) => {
      try {
        _.map(fiatRates, (rates, coin: any) => {
          const coinRates = {};
          _.each(rates, r => {
            const rate = { [r.code]: r.rate };
            Object.assign(coinRates, rate);
          });
          rateList[coin.toLowerCase()] = !_.isEmpty(coinRates) ? coinRates : { USD: 0 };
        });
        return cb(null, rateList);
      } catch (error) {
        return cb(error);
      }
    });
  }

  _getRatesCustomFormatWithPromise(): Promise<any> {
    return new Promise((resolve, reject) => {
      let rateList = [];
      this.getFiatRates({}, (err, fiatRates) => {
        try {
          _.map(fiatRates, (rates, coin: any) => {
            const coinRates = {};
            _.each(rates, r => {
              const rate = { [r.code]: r.rate };
              Object.assign(coinRates, rate);
            });
            rateList[coin.toLowerCase()] = !_.isEmpty(coinRates) ? coinRates : { USD: 0 };
          });
          return resolve(rateList);
        } catch (error) {
          return reject(error);
        }
      });
    });
  }

  async createOrder(opts, cb) {
    try {
      if (!clientsFund) {
        throw new Error('Not found funding');
      }
      if (!clientsReceive) {
        throw new Error('Not found funding');
      }
      if (!swapQueueInterval) {
        throw new Error('Not found queue');
      }
      const orderInfo = Order.create(opts);
      const fromCoinCode = orderInfo.isFromToken ? 'xec' : orderInfo.fromCoinCode;
      const configSwap = await this.getConfigSwapWithNoBalancePromise();
      const isValidOrder = await this.checkRequirementBeforeQueueExcetue(configSwap, orderInfo);

      if (isValidOrder === true) {
        const coinConfigReceive = configSwap.coinReceive.find(
          config => config.network === orderInfo.toNetwork && config.code === orderInfo.toCoinCode
        );
        if (coinConfigReceive.dailyLimit && coinConfigReceive.dailyLimit > 0) {
          if (coinConfigReceive.dailyLimitUsage > coinConfigReceive.dailyLimit) {
            throw new Error(Errors.EXCEED_DAILY_LIMIT.message);
          }
        }
        if (orderInfo.isFromToken) {
          orderInfo.fromSatUnit = Math.pow(10, orderInfo.fromTokenInfo.decimals);
        } else {
          orderInfo.fromSatUnit = Constants.UNITS[orderInfo.fromCoinCode.toLowerCase()].toSatoshis;
        }

        if (orderInfo.isToToken) {
          orderInfo.toSatUnit = Math.pow(10, orderInfo.toTokenInfo.decimals);
        } else {
          orderInfo.toSatUnit = Constants.UNITS[orderInfo.toCoinCode.toLowerCase()].toSatoshis;
        }
        const depositClient = clientsReceive.find(
          client => client.credentials.coin === fromCoinCode && client.credentials.network === orderInfo.fromNetwork
        );
        this.walletId = depositClient.credentials.walletId;
        const coinConfigSelected = configSwap.coinReceive.find(
          coin => coin.code.toLowerCase() === orderInfo.toCoinCode.toLowerCase()
        );
        this.createAddress(
          {
            ignoreMaxGap: true
          },
          (err, address) => {
            if (err) return cb(err);
            const addressReturn = address.address || address;
            if (orderInfo.isFromToken) {
              address = this._convertAddressToEtoken(addressReturn);
              // const slpAddress = bchjs.HDNode.toSLPAddress(change);
            } else {
              address = addressReturn;
            }
            orderInfo.adddressUserDeposit = address;
            this.storage.storeOrderInfo(orderInfo, (err, orderStoredResult) => {
              if (err) return cb(err);
              // let order into queue
              const orderCreated = Order.fromObj(orderStoredResult.ops[0]);
              this.storage.orderQueue.add(orderCreated.id, (err, id) => {
                if (err) return cb(err);
                return cb(null, orderCreated);
              });
            });
          }
        );
      }
    } catch (e) {
      return cb(e);
    }
  }

  createConversionOrder(opts, cb) {
    const conversionOrder = ConversionOrder.create(opts);
    if (!conversionOrder.txIdFromUser) {
      return cb(new Error('Missing required parameter'));
    }
    this.getTxDetailForXecWallet(conversionOrder.txIdFromUser, async (err, result: TxDetail) => {
      if (err) {
        return cb(err);
      } else {
        if (result) {
          let outputsConverted = _.uniq(
            _.map(result.outputs, item => {
              return this._convertOutputScript('xec', item);
            })
          );
          outputsConverted = _.compact(outputsConverted);
          // convert outputscript to output address
          const accountTo = outputsConverted.find(
            output =>
              !result.inputAddresses.includes(output.address) &&
              output.address.includes('ecash:') &&
              output.amount > 546
          );
          if (!clientsFundConversion) {
            return cb(Errors.NOT_FOUND_KEY_CONVERSION);
          } else {
            const xecWallet = clientsFundConversion.find(
              s =>
                s.credentials.coin === 'xec' &&
                s.credentials.network === 'livenet' &&
                (s.credentials.rootPath.includes('1899') || s.credentials.rootPath.includes('145'))
            );
            if (!xecWallet) {
              return cb(Errors.NOT_FOUND_KEY_CONVERSION);
              return;
            }
            this.storage.fetchAddressByWalletId(
              xecWallet.credentials.walletId,
              accountTo.address.replace(/ecash:/, ''),
              async (err, wallet) => {
                if (err) {
                  return cb(err);
                  return;
                }
                if (!wallet) {
                  return cb(Errors.INVALID_ADDRESS_TO);
                  return;
                } else {
                  this.storage.fetchConversionOrderInfoByTxIdFromUser(conversionOrder.txIdFromUser, (err, result) => {
                    if (err) return cb(err);
                    if (result) {
                      return cb(new Error('Duplicate conversion order info'));
                    } else {
                      this.storage.storeConversionOrderInfo(conversionOrder, (err, result) => {
                        if (err) return cb(err);
                        // let order into queue
                        this.storage.conversionOrderQueue.add(conversionOrder.txIdFromUser, (err, id) => {
                          if (err) return cb(err);
                          return cb(null, true);
                        });
                      });
                    }
                  });
                }
              }
            );
          }
        }
      }
    });
  }

  getListMerchantInfo(): MerchantInfo[] {
    if (merchantList && merchantList.length > 0) {
      const merchantListConverted = merchantList.map(merchant => MerchantInfo.fromObj(merchant));
      return merchantListConverted;
    } else {
      return null;
    }
  }

  getListRaipayFee(): RaipayFee[] {
    if (raipayFee && raipayFee.length > 0) {
      const raipayFeeConverted = raipayFee.map(fee => RaipayFee.fromObj(fee));
      return raipayFeeConverted;
    } else {
      return null;
    }
  }

  async createMerchantOrder(opts, cb) {
    if (!opts.txIdFromUser || !opts.coin || !opts.merchantCode || !opts.userAddress || !opts.amount) {
      // TANTMP: temp not check email list and subject.
      return cb(new Error('Missing required parameter'));
    }
    try {
      if (!config.conversion.tokenId) {
        return cb(new Error('Can not find config for conversion'));
      }
      const merchantOrder = MerchantOrder.create(opts);
      const listMerchant = this.getListMerchantInfo();
      if (!listMerchant || listMerchant.length < 1) {
        return cb('Can not find list merchant on server');
      }
      const merchantSelected = listMerchant.find(merchant => merchant.code === merchantOrder.merchantCode);
      if (!merchantSelected) {
        return cb('Can not find selected merchant on server');
      }
      if (merchantOrder.isPaidByUser) {
        merchantOrder.paymentType = PaymentType.SEND;
        this.storage.storeMerchantOrder(merchantOrder, async (err, result) => {
          if (err) return cb(err);
          // let order into queue
          try {
            const amountToken =
              merchantOrder.qpayInfoForEmail.amountToken === 0
                ? merchantOrder.qpayInfoForEmail.amountPay
                : merchantOrder.qpayInfoForEmail.amountToken;
            await this._handleSendSuccesMerchantOrder(0, amountToken, merchantOrder, merchantSelected.name, true);
          } catch (e) {
            logger.debug('email sent to user error: ', e);
          }
          return cb(null, true);
        });
      } else {
        if (!merchantSelected.isElpsAccepted) {
          merchantOrder.paymentType = PaymentType.BURN;
          // TANTMP: disable checking signature for qpay mini app
          // if (!opts.signature) {
          //   return cb(new Error('Missing signature'));
          // }
        } else {
          merchantOrder.paymentType = PaymentType.SEND;
        }
        try {
          const isValidTxIdFromUser = await this._checkIfTxIdFromUserDuplicate(merchantOrder.txIdFromUser);
        } catch (e) {
          if (e) return cb(e);
        }
        merchantOrder.tokenId = config.conversion.tokenId;
        this.storage.storeMerchantOrder(merchantOrder, (err, result) => {
          if (err) return cb(err);
          // let order into queue
          this.storage.merchantOrderQueue.add(merchantOrder.txIdFromUser, (err, id) => {
            if (err) return cb(err);
            return cb(null, true);
          });
        });
      }
    } catch (e) {
      return cb(e);
    }
  }

  _handleEmailNotificationForMerchantOrder(merchantOrder: IMerchantOrder) {
    return new Promise(async (resolve, reject) => {
      const msgCustomer = {
        to: merchantOrder.userEmailAddress, // Change to your recipient
        from: config.emailMerchant.emailFrom, // Change to your verified sender
        subject: merchantOrder.listSubject[0],
        text: 'abc',
        html: merchantOrder.listEmailContent[0]
      };
      const promistList = [];
      promistList.push(sgMail.send(msgCustomer));
      if (!!config.emailMerchant.listEmailMerchant && config.emailMerchant.listEmailMerchant.length > 0) {
        const listEmail = config.emailMerchant.listEmailMerchant;
        listEmail.forEach(email => {
          const msgMerchant = {
            to: email, // Change to your recipient
            from: config.emailMerchant.emailFrom, // Change to your verified sender
            subject: merchantOrder.listSubject[1],
            text: 'abc',
            html: merchantOrder.listEmailContent[1]
          };
          promistList.push(sgMail.send(msgMerchant));
        });
      }
      const listMerchant = this.getListMerchantInfo();
      const merchantSelected = listMerchant.find(merchant => merchant.code === merchantOrder.merchantCode);
      if (!!merchantSelected.email && merchantSelected.email.length > 0) {
        const msgMerchant = {
          to: merchantSelected.email, // Change to your recipient
          from: config.emailMerchant.emailFrom, // Change to your verified sender
          subject: merchantOrder.listSubject[1],
          text: 'abc',
          html: merchantOrder.listEmailContent[1]
        };
        promistList.push(sgMail.send(msgMerchant));
      }
      try {
        // append new tx to google sheet
        const client = await auth.getClient();
        // Instance of Google Sheets API
        const googleSheets = google.sheets({ version: 'v4', auth: client });
        const spreadsheetId = config.spreadsheetId;
        // Get metadata about spreadsheet
        const metaData = await googleSheets.spreadsheets.get({
          auth,
          spreadsheetId
        });
        const sheetName = metaData.data.sheets[0].properties.title;
        await googleSheets.spreadsheets.values.append({
          auth,
          spreadsheetId,
          range: sheetName + '!A:R',
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [
              [
                merchantOrder.qpayInfoForEmail.date,
                merchantOrder.userAddress,
                merchantOrder.userEmailAddress,
                merchantOrder.qpayInfoForEmail.taxId || '',
                merchantOrder.qpayInfoForEmail.idNumber || '',
                merchantOrder.qpayInfoForEmail.street || '',
                merchantOrder.qpayInfoForEmail.unitNumber || '',
                merchantOrder.qpayInfoForEmail.paymentReason || '',
                merchantOrder.qpayInfoForEmail.accountNumber || '',
                merchantOrder.qpayInfoForEmail.paymentDescription || '',
                merchantSelected.name,
                merchantOrder.qpayInfoForEmail.amountToken > 0 ? merchantOrder.qpayInfoForEmail.amountPay : '',
                merchantOrder.coin,
                merchantOrder.qpayInfoForEmail.amountToken === 0
                  ? merchantOrder.qpayInfoForEmail.amountPay
                  : merchantOrder.qpayInfoForEmail.amountToken,
                merchantOrder.txIdFromUser,
                merchantOrder.txIdMerchantPayment,
                PaymentType[merchantOrder.paymentType],
                !!merchantOrder.isPaidByUser
              ]
            ]
          }
        });
      } catch (e) {
        logger.error('Append data to google sheet error', e);
      }

      await Promise.all(promistList)
        .then(() => {
          return resolve(true);
        })
        .catch(err => {
          return reject(err);
        });
    });
  }

  _checkIfTxIdFromUserDuplicate(txIdFromUser): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.storage.fetchMerchantOrderByTxIdFromUser(txIdFromUser, (err, result) => {
        if (err) return reject(err);
        if (!!result) {
          return reject(new Error('Duplicate conversion order info'));
        } else {
          return resolve(true);
        }
      });
    });
  }

  _fetchAddressByWalletIdWithPromise(walletId, accountToAddress): Promise<any> {
    return new Promise((resolve, reject) => {
      this.storage.fetchAddressByWalletId(walletId, accountToAddress, (err, result) => {
        if (err) return reject(err);
        if (!result) return reject(Errors.INVALID_ADDRESS_TO);
        return resolve(result);
      });
    });
  }

  /**
   * checkConversion - Checking if fund is ready for conversion
   *
   * @param {string} addressTopupEcash - The top up ecash address , if pass this data => call notify to user in case of insufficient fund for XEC, or eToken
   */
  async checkConversion(addressTopupEcash, cb) {
    if (!clientsFundConversion) {
      return cb(Errors.NOT_FOUND_KEY_CONVERSION);
    } else {
      const xecWallet = clientsFundConversion.find(
        s =>
          s.credentials.coin === 'xec' &&
          s.credentials.network === 'livenet' &&
          (s.credentials.rootPath.includes('1899') || s.credentials.rootPath.includes('145'))
      );
      if (!xecWallet) {
        return cb(Errors.NOT_FOUND_KEY_CONVERSION);
      }
      let xecBalance = null;
      xecBalance = await this.getBalanceWithPromise({
        walletId: xecWallet.credentials.walletId,
        coinCode: xecWallet.credentials.coin,
        network: xecWallet.credentials.network
      }).catch(e => {
        return cb(e);
      });
      if (xecBalance && xecBalance.balance && _.isNumber(xecBalance.balance.totalAmount)) {
        if (xecBalance.balance.totalAmount <= 546) {
          if (addressTopupEcash) {
            this._handleWhenFundIsNotEnough(
              Errors.INSUFFICIENT_FUND_XEC.code,
              xecBalance.balance.totalAmount / 100,
              addressTopupEcash
            );
          }
          return cb(Errors.INSUFFICIENT_FUND_XEC);
        }
        if (xecBalance.balance.totalAmount < config.conversion.minXecSatConversion) {
          if (addressTopupEcash) {
            this._handleWhenFundIsNotEnough(
              Errors.BELOW_MINIMUM_XEC.code,
              xecBalance.balance.totalAmount / 100,
              addressTopupEcash
            );
          }
        }
      } else {
        if (addressTopupEcash) {
          this._handleWhenFundIsNotEnough(Errors.INSUFFICIENT_FUND_XEC.code, 0, addressTopupEcash);
          return cb(Errors.INSUFFICIENT_FUND_XEC);
        }
      }
      // get balance of XEC Wallet and token elps
      let balanceTokenFound = null;
      balanceTokenFound = await this.getTokensWithPromise({
        walletId: xecWallet.credentials.walletId
      });
      if (balanceTokenFound && balanceTokenFound.length > 0) {
        const listBalanceTokenConverted = _.map(balanceTokenFound, item => {
          return {
            tokenId: item.tokenId,
            tokenInfo: item.tokenInfo,
            amountToken: item.amountToken,
            utxoToken: item.utxoToken
          } as TokenItem;
        });
        const tokenElps = listBalanceTokenConverted.find(
          // TANTODO: replace with tyd token id
          s => s.tokenId === config.conversion.tokenId
        );

        if (tokenElps) {
          if (tokenElps.amountToken < 1) {
            if (addressTopupEcash) {
              this._handleWhenFundIsNotEnough(
                Errors.INSUFFICIENT_FUND_TOKEN.code,
                tokenElps.amountToken,
                addressTopupEcash
              );
            }
            return cb(Errors.INSUFFICIENT_FUND_TOKEN);
          }
          if (tokenElps.amountToken < config.conversion.minTokenConversion) {
            if (addressTopupEcash) {
              this._handleWhenFundIsNotEnough(
                Errors.BELOW_MINIMUM_TOKEN.code,
                tokenElps.amountToken,
                addressTopupEcash
              );
            }
          }
          if (!addressTopupEcash) {
            this.storage.fetchAddressWithWalletId(xecWallet.credentials.walletId, async (err, address) => {
              return cb(null, address.address);
            });
          } else {
            return cb(null, addressTopupEcash);
          }
        } else {
          return cb(Errors.NOT_FOUND_TOKEN_WALLET);
        }
      } else {
        return cb(Errors.NOT_FOUND_TOKEN_WALLET);
      }
    }
  }

  /**
   * checkMerchantConversion - Checking if fund is ready for merchant conversion
   *
   * @param {string} addressTopupEcash - The top up ecash address , if pass this data => call notify to user in case of insufficient fund for XEC, or eToken
   */
  async checkMerchantConversion(addressTopupEcash, coin, cb) {
    if (!clientsFundConversion) {
      return cb(Errors.NOT_FOUND_KEY_CONVERSION);
    } else {
      const xecWallet = clientsFundConversion.find(
        s =>
          s.credentials.coin === 'xec' &&
          s.credentials.network === 'livenet' &&
          (s.credentials.rootPath.includes('1899') || s.credentials.rootPath.includes('145'))
      );
      if (!xecWallet) {
        return cb(Errors.NOT_FOUND_KEY_CONVERSION);
      }
      let xecBalance = null;
      xecBalance = await this.getBalanceWithPromise({
        walletId: xecWallet.credentials.walletId,
        coinCode: xecWallet.credentials.coin,
        network: xecWallet.credentials.network
      }).catch(e => {
        return cb(e);
      });
      if (xecBalance && xecBalance.balance && _.isNumber(xecBalance.balance.totalAmount)) {
        if (xecBalance.balance.totalAmount <= 546) {
          if (addressTopupEcash) {
            this._handleWhenFundIsNotEnough(
              Errors.INSUFFICIENT_FUND_XEC.code,
              xecBalance.balance.totalAmount / 100,
              addressTopupEcash
            );
          }
          return cb(Errors.INSUFFICIENT_FUND_XEC);
        }
        if (xecBalance.balance.totalAmount < config.conversion.minXecSatConversion) {
          if (addressTopupEcash) {
            this._handleWhenFundIsNotEnough(
              Errors.BELOW_MINIMUM_XEC.code,
              xecBalance.balance.totalAmount / 100,
              addressTopupEcash
            );
          }
        }
      } else {
        if (addressTopupEcash) {
          this._handleWhenFundIsNotEnough(Errors.INSUFFICIENT_FUND_XEC.code, 0, addressTopupEcash);
          return cb(Errors.INSUFFICIENT_FUND_XEC);
        }
      }
      // get balance of XEC Wallet and token elps
      let balanceTokenFound = null;
      balanceTokenFound = await this.getTokensWithPromise({
        walletId: xecWallet.credentials.walletId
      });
      if (balanceTokenFound && balanceTokenFound.length > 0) {
        const listBalanceTokenConverted = _.map(balanceTokenFound, item => {
          return {
            tokenId: item.tokenId,
            tokenInfo: item.tokenInfo,
            amountToken: item.amountToken,
            utxoToken: item.utxoToken
          } as TokenItem;
        });
        const tokenElps = listBalanceTokenConverted.find(s => s.tokenId === config.conversion.tokenId);

        if (tokenElps) {
          if (tokenElps.amountToken < 1) {
            if (addressTopupEcash) {
              this._handleWhenFundIsNotEnough(
                Errors.INSUFFICIENT_FUND_TOKEN.code,
                tokenElps.amountToken,
                addressTopupEcash
              );
            }
            return cb(Errors.INSUFFICIENT_FUND_TOKEN);
          }
          if (tokenElps.amountToken < config.conversion.minTokenConversion) {
            if (addressTopupEcash) {
              this._handleWhenFundIsNotEnough(
                Errors.BELOW_MINIMUM_TOKEN.code,
                tokenElps.amountToken,
                addressTopupEcash
              );
            }
          }
          if (!addressTopupEcash) {
            if (!!coin && coin === 'xpi') {
              const xpiWallet = clientsFundConversion.find(
                s => s.credentials.coin === 'xpi' && s.credentials.network === 'livenet'
              );
              if (!xpiWallet) {
                return cb(Errors.NOT_FOUND_KEY_CONVERSION);
              } else {
                this.storage.fetchAddressWithWalletId(xpiWallet.credentials.walletId, async (err, address) => {
                  return cb(null, address.address);
                });
              }
            } else {
              this.storage.fetchAddressWithWalletId(xecWallet.credentials.walletId, async (err, address) => {
                return cb(null, address.address);
              });
            }
          } else {
            return cb(null, addressTopupEcash);
          }
        } else {
          return cb(Errors.NOT_FOUND_TOKEN_WALLET);
        }
      } else {
        return cb(Errors.NOT_FOUND_TOKEN_WALLET);
      }
    }
  }

  getQpayInfo(cb) {
    const merchantList = this.getListMerchantInfo();
    const raipayFeeList = this.getListRaipayFee();
    const streets = [
      'Calle Francisco Suarez',
      'Calle Juan de Mariana',
      'Calle Francisco de Vitoria',
      'Calle Martin de Azpilicueta',
      'Calle Luis de Molina',
      'Albert Jay Nock Street'
    ];
    const unit = 16;
    const qpayinfo: IQPayInfo = {
      merchantList,
      raipayFeeList,
      streets,
      unit
    };
    return cb(null, qpayinfo);
  }

  _getWalletAddressByWalletId(walletId): Promise<string> {
    return new Promise((resolve, reject) => {
      this.storage.fetchAddressWithWalletId(walletId, async (err, address) => {
        if (err) reject(err);
        return resolve(address.address);
      });
    });
  }

  createBot(opts, cb) {
    logger.debug('run create Bot: ');
    bot = opts.bot;
    botNotification = opts.botNotification;
    botSwap = opts.botSwap;
    this.startBotNotificationForUser();
    return cb(true);
  }

  initializeBot() {
    // if user click start => if not , store user into db , if yes, checking user address
    botNotification.onText(/\/start/, msg => {
      botNotification.sendMessage(
        msg.chat.id,
        'Welcome to Chronik watcher, please use /help to display general and other commands.'
      );
    });

    botNotification.onText(/\/list/, msg => {
      this.storage.fetchAllAddressByMsgId(msg.chat.id, (err, listAddress) => {
        if (!err) {
          if (listAddress && listAddress.length > 0) {
            if (listAddress && listAddress.length > 0) {
              let count = 0;
              let message = '';
              listAddress.forEach(address => {
                count++;
                message += count + '. ' + address + '\n';
              });
              botNotification.sendMessage(msg.chat.id, message, { parse_mode: 'HTML' });
            } else {
              botNotification.sendMessage(
                msg.chat.id,
                'Your addresses are empty. Please add new address by using command /add [ecash address]!'
              );
            }
          } else {
            botNotification.sendMessage(
              msg.chat.id,
              'Your addresses are empty. Please add new address by using command /add [ecash address]!'
            );
          }
        } else {
          botNotification.sendMessage(msg.chat.id, 'Errors occured on Chronik watcher, please try again.');
        }
      });
    });

    botNotification.onText(/\/help/, msg => {
      let message =
        '/add - Add watching address i.e. /add ecash:qq2ml325qrc3t2dxhtkjaq3qyr0rrjs43sgs7n1234 \n' +
        '/remove - Remove watched address i.e /remove ecash:qq2ml325qrc3t2dxhtkjaq3qyr0rrjs43sgs7n1234 \n' +
        '/list - Display all watched addresses \n';
      botNotification.sendMessage(msg.chat.id, message, { parse_mode: 'HTML' });
    });

    botNotification.onText(/\/add\secash:\w+/, msg => {
      const address = msg.text.toString().replace(/\/add\s/, '');
      if (this._checkingValidAddress(address)) {
        this.addAddressToUser(msg.chat.id, address);
      } else {
        botNotification.sendMessage(msg.chat.id, 'Invalid address format, please check and try again!');
      }
    });

    botNotification.onText(/\/remove\secash:\w+/, msg => {
      this.storage.fetchAllAddressByMsgId(msg.chat.id, (err, listAddress) => {
        if (!err) {
          if (listAddress && listAddress.length > 0) {
            const address = msg.text.toString().replace(/\/remove\s/, '');
            if (this._checkingValidAddress(address)) {
              this.storage.removeUserWatchAddress({ msgId: msg.chat.id, address }, (err, result) => {
                if (!err) {
                  botNotification.sendMessage(
                    msg.chat.id,
                    '[ ' + address.substr(address.length - 8) + ' ] has been removed!'
                  );
                } else {
                  botNotification.sendMessage(msg.chat.id, 'Error while remove. Please try again!');
                }
              });
            } else {
              botNotification.sendMessage(msg.chat.id, 'Invalid address format, please check and try again!');
            }
          } else {
            botNotification.sendMessage(msg.chat.id, 'Your list address has been empty');
          }
        } else {
          botNotification.sendMessage(msg.chat.id, 'Error while fetching your address. Please try again!');
        }
      });
    });
  }

  async updateOrder(opts, cb) {
    try {
      const orderInfo = Order.fromObj(opts);
      this.storage.updateOrder(orderInfo, (err, result) => {
        if (err) return cb(err);
        return cb(null, { isUpdated: true });
      });
    } catch (e) {
      return cb(e);
    }
  }

  async updateOrderById(opts, cb) {
    try {
      if (!opts.orderId) {
        return cb(new Error('Missing required parameter order Id'));
      }
      const orderInfo = Order.fromObj(opts.order);
      this.storage.updateOrderById(opts.orderId, orderInfo, (err, result) => {
        if (err) return cb(err);
        return cb(null, { isUpdated: true });
      });
    } catch (e) {
      return cb(e);
    }
  }

  async updateOrderStatus(opts, cb) {
    try {
      if (!opts.orderId) {
        return cb(new Error('Missing required parameter order Id'));
      }
      this.storage.updateOrderStatus(opts.orderId, opts.status, async (err, result) => {
        if (err) return cb(err);

        const orderInfo = await this._getOrderInfo({ id: opts.orderId });
        const stringUserSentToDepositAddress =
          orderInfo.actualSent > 0 ? orderInfo.actualSent.toLocaleString('en-US') : '--';
        const stringUserReceived = '--';
        const unitFrom = orderInfo.isFromToken ? orderInfo.fromTokenInfo.symbol : orderInfo.fromCoinCode.toUpperCase();
        const unitTo = orderInfo.isToToken ? orderInfo.toTokenInfo.symbol : orderInfo.toCoinCode.toUpperCase();
        let balanceFinal = 0;
        if (orderInfo.isToToken) {
          const fundingWallet = clientsFund.find(
            s =>
              s.credentials.coin === 'xec' &&
              (s.credentials.rootPath.includes('1899') || s.credentials.rootPath.includes('145'))
          );
          let balanceTokenFound = null;
          balanceTokenFound = await this.getTokensWithPromise({ walletId: fundingWallet.credentials.walletId });
          if (!!balanceTokenFound) {
            const listBalanceTokenConverted = _.map(balanceTokenFound, item => {
              return {
                tokenId: item.tokenId,
                tokenInfo: item.tokenInfo,
                amountToken: item.amountToken,
                utxoToken: item.utxoToken
              } as TokenItem;
            });
            const balance = listBalanceTokenConverted.find(
              token => token.tokenInfo.symbol.toLowerCase() === orderInfo.toCoinCode.toLowerCase()
            );
            if (balance && !isNaN(balance.amountToken)) {
              balanceFinal = balance.amountToken;
            }
          }
        } else {
          const fundingWallet = clientsFund.find(
            s => s.credentials.coin === orderInfo.toCoinCode && s.credentials.network === orderInfo.toNetwork
          );
          let balanceCoin = null;
          balanceCoin = await this.getBalanceWithPromise({
            walletId: fundingWallet.credentials.walletId,
            coinCode: fundingWallet.credentials.coin,
            network: fundingWallet.credentials.network
          });
          if (!!balanceCoin) {
            balanceFinal = balanceCoin.balance.totalAmount / Constants.UNITS[orderInfo.toCoinCode.toLowerCase()].toSatoshis;
          }
        }

        botSwap.sendMessage(
          config.swapTelegram.channelSuccessId,
          'Manually completed :: ' +
          'Order no.' +
          orderInfo.id +
          ' :: ' +
          stringUserSentToDepositAddress +
          ' ' +
          unitFrom +
          ' to ' +
          stringUserReceived +
          ' ' +
          unitTo +
          ' :: ' +
          'Balance: ' +
          balanceFinal.toLocaleString('en-US') +
          ' ' +
          unitTo,
          {
            parse_mode: 'HTML'
          }
        );
        return cb(null, { isUpdated: true });
      });
    } catch (e) {
      return cb(e);
    }
  }

  updateListCoinConfig(listCoinConfig, cb) {
    try {
      this.storage.updateListCoinConfig(listCoinConfig, (err, result) => {
        if (err) return cb(err);
        return cb(null, { isUpdated: true });
      });
    } catch (e) {
      return cb(e);
    }
  }

  _convertAddressToEtoken(address) {
    try {
      const protocolPrefix = { livenet: 'ecash', testnet: 'ectest' };
      const protoXEC = protocolPrefix.livenet; // only support livenet
      const protoAddr: string = protoXEC + ':' + address;
      const { prefix, type, hash } = ecashaddr.decode(protoAddr);
      const cashAddress = ecashaddr.encode('etoken', type, hash);
      return cashAddress;
    } catch {
      return '';
    }
  }

  _convertFromEcashWithPrefixToEtoken(address) {
    try {
      const { prefix, type, hash } = ecashaddr.decode(address);
      const cashAddress = ecashaddr.encode('etoken', type, hash);
      return cashAddress;
    } catch {
      return '';
    }
  }

  _convertEtokenAddressToEcashAddress(address) {
    try {
      const { prefix, type, hash } = ecashaddr.decode(address);
      const addressConverted = ecashaddr.encode('ecash', type, hash);
      return addressConverted;
    } catch {
      return '';
    }
  }

  /**
   * Broadcast a transaction proposal.
   * @param {Object} opts
   * @param {string} opts.txProposalId - The identifier of the transaction.
   */
  broadcastTx(opts, cb) {
    if (!checkRequired(opts, ['txProposalId'], cb)) return;

    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);

      if (config.suspendedChains && config.suspendedChains.includes(wallet.chain)) {
        const Err = Errors.NETWORK_SUSPENDED;
        Err.message = Err.message.replace('$network', wallet.chain.toUpperCase());
        return cb(Err);
      }

      this.getTx({ txProposalId: opts.txProposalId }, (err, txp) => {
        if (err) return cb(err);

        if (txp.status == 'broadcasted') return cb(Errors.TX_ALREADY_BROADCASTED);
        if (txp.status != 'accepted') return cb(Errors.TX_NOT_ACCEPTED);

        const sub = TxConfirmationSub.create({
          copayerId: txp.creatorId,
          txid: txp.txid,
          walletId: txp.walletId,
          amount: txp.amount,
          isActive: true,
          isCreator: true
        });
        if (this.checkIsDonation(txp)) {
          this.checkAmoutToSendLostus(txp, (err, isSend) => {
            if (err) return cb(err);
            this.confirmationAndBroadcastRawTx(wallet, txp, sub, (err, txp) => {
              if (err) return cb(err);
              const donationStorage: DonationStorage = {
                txidDonation: txp.txid,
                amount: txp.outputs[0].amount,
                isGiven: false,
                walletId: txp.walletId,
                receiveLotusAddress: txp.receiveLotusAddress || undefined,
                txidGiveLotus: txp.txidGiveLotus || undefined,
                addressDonation: txp.from,
                createdOn: Date.now()
              };
              this.storage.queue.add(donationStorage, (err, id) => {
                if (err) return cb(err);
                return cb(null, txp);
              });
            });
          });
        } else {
          this.confirmationAndBroadcastRawTx(wallet, txp, sub, cb);
        }
      });
    });
  }

  /**
   * Reject a transaction proposal.
   * @param {Object} opts
   * @param {string} opts.txProposalId - The identifier of the transaction.
   * @param {string} [opts.reason] - A message to other copayers explaining the rejection.
   */
  rejectTx(opts, cb) {
    if (!checkRequired(opts, ['txProposalId'], cb)) return;

    this.getTx(
      {
        txProposalId: opts.txProposalId
      },
      (err, txp) => {
        if (err) return cb(err);

        const action = txp.actions.find(a => a.copayerId === this.copayerId);

        if (action) return cb(Errors.COPAYER_VOTED);
        if (txp.status != 'pending') return cb(Errors.TX_NOT_PENDING);

        txp.reject(this.copayerId, opts.reason);

        this.storage.storeTx(this.walletId, txp, err => {
          if (err) return cb(err);

          async.series(
            [
              next => {
                this._notifyTxProposalAction(
                  'TxProposalRejectedBy',
                  txp,
                  {
                    copayerId: this.copayerId
                  },
                  next
                );
              },
              next => {
                if (txp.status == 'rejected') {
                  const rejectedBy = txp.actions.filter(a => a.type === 'reject').map(a => a.copayerId);

                  this._notifyTxProposalAction(
                    'TxProposalFinallyRejected',
                    txp,
                    {
                      rejectedBy
                    },
                    next
                  );
                } else {
                  next();
                }
              }
            ],
            () => {
              return cb(null, txp);
            }
          );
        });
      }
    );
  }


  /**
   * Retrieves pending transaction proposals.
   * @param {'number'|'string'|'hex'|'bigint'} opts.numberFormat The format to return numbers in. Not ALL numbers - just certain ones that are needed for tx building/verifying by the client.
   * @param cb
   */
  async getPendingTxs(opts, cb) {
    this._getPendingTxs(opts, (err, txps) => {
      if (err) return cb(err);
      if (opts.numberFormat) {
        const formattedTxps = txps.map(t => TxProposal.formatNumbers(t, opts.numberFormat));
        return cb(null, formattedTxps);
      }
      return cb(null, txps);
    });
  }

  /**
   * Retrieves pending transaction proposals.
   * @param {Object} opts
   * @param {Boolean} opts.noCashAddr (do not use cashaddr, only for backwards compat)
   * @param {String} opts.tokenAddress ERC20 Token Contract Address
   * @param {String} opts.multisigContractAddress MULTISIG ETH Contract Address
   * @param {String} opts.network The network of the MULTISIG ETH transactions
   * @param {String} opts.numberFormat Return numbers as format. 'number' (default), 'hex', or 'string'
   * @returns {TxProposal[]} Transaction proposal.
   */
  private async _getPendingTxs(opts, cb: (err: any, txps?: ITxProposal[]) => void) {
    if (opts.multisigContractAddress) {
      try {
        const multisigTxpsInfo = await this.getMultisigTxpsInfo(opts);
        const txps = await this.storage.fetchEthPendingTxs(multisigTxpsInfo);
        return cb(null, txps);
      } catch (error) {
        return cb(error);
      }
    } else {
      this.storage.fetchPendingTxs(this.walletId, (err, txps) => {
        if (err) return cb(err);
        if (opts.tokenAddress) {
          txps = txps.filter(txp => opts.tokenAddress?.toLowerCase() === txp.tokenAddress?.toLowerCase());
        }
        for (const txp of txps) {
          txp.deleteLockTime = this.getRemainingDeleteLockTime(txp);
        };
        async.each(
          txps,
          (txp: ITxProposal, next) => {
            if (txp.status != 'accepted') return next();

            this._checkTxInBlockchain(txp, (err, isInBlockchain) => {
              if (err || !isInBlockchain) return next(err);
              this._processBroadcast(
                txp,
                {
                  byThirdParty: true
                },
                next
              );
            });
          },
          err => {
            txps = txps.filter(txp => txp.status !== 'broadcasted');

            if (txps[0] && txps[0].chain == 'bch') {
              const format = opts.noCashAddr ? 'copay' : 'cashaddr';
              for (const t of txps) {
                if (t.changeAddress) {
                  t.changeAddress.address = BCHAddressTranslator.translate(t.changeAddress.address, format);
                }
                for (const o of t.outputs) {
                  if (o.toAddress) {
                    o.toAddress = BCHAddressTranslator.translate(o.toAddress, format);
                  }
                }
              }
            }
            return cb(err, txps);
          }
        );
      }, opts.wallet);
    }
  }

  getPendingTxsPromise(opts): Promise<any> {
    return new Promise((resolve, reject) => {
      this.getPendingTxs(opts, (err, txps) => {
        if (err) return reject(err);
        return resolve(txps);
      });
    });
  }

  /**
   * Retrieves all transaction proposals in the range (maxTs-minTs)
   * Times are in UNIX EPOCH
   *
   * @param {Object} opts.minTs (defaults to 0)
   * @param {Object} opts.maxTs (defaults to now)
   * @param {Object} opts.limit
   * @returns {TxProposal[]} Transaction proposals, newer first
   */
  getTxs(opts, cb) {
    this.storage.fetchTxs(this.walletId, opts, (err, txps) => {
      if (err) return cb(err);
      return cb(null, txps);
    });
  }

  /**
   * Retrieves notifications after a specific id or from a given ts (whichever is more recent).
   *
   * @param {Object} opts
   * @param {Object} opts.notificationId (optional)
   * @param {Object} opts.minTs (optional) - default 0.
   * @returns {Notification[]} Notifications
   */
  getNotifications(opts, cb) {
    opts = opts || {};

    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);

      async.map(
        [`${wallet.chain}:${wallet.network}`, this.walletId],
        (walletId, next) => {
          this.storage.fetchNotifications(walletId, opts.notificationId, opts.minTs || 0, next);
        },
        (err, res) => {
          if (err) return cb(err);

          const notifications = res
            .flat()
            .map((n: INotification) => ({ ...n, walletId: this.walletId }))
            .sort((a, b) => a.id?.toString()?.localeCompare(b.id?.toString()));

          return cb(null, notifications);
        }
      );
    });
  }
  _convertAddressFormInputScript(script: string, coin: string, isToken?: boolean) {
    let address: string;
    const scriptBitcore = Bitcore_[coin].Script(script);
    const { hashBuffer, type } = scriptBitcore.getAddressInfo();
    if (!hashBuffer || !type) return address;
    switch (coin) {
      case 'xpi':
        address = Bitcore_[coin].Address(hashBuffer).toXAddress();
        break;
      case 'xec':
        const addressBitcore = Bitcore_[coin].Address(hashBuffer);
        if (isToken) {
          address = addressBitcore.encode('etoken', type, hashBuffer);
        } else {
          address = addressBitcore.encode('ecash', type, hashBuffer);
        }
        break;
      default:
        address = Bitcore_[coin].Address(hashBuffer).toCashAddress();
        break;
    }
    return address;
  }

  _convertOutputTokenScript(output: Output): { address: string; amount: number } {
    let address: string;
    const coin = 'xec';
    const scriptBitcore = Bitcore_[coin].Script(output.outputScript);
    const { hashBuffer, type } = scriptBitcore.getAddressInfo();
    if (!hashBuffer || !type) return null;
    const addressBitcore = Bitcore_[coin].Address(hashBuffer);
    address = addressBitcore.encode('etoken', type, hashBuffer);
    let amount = 0;
    amount = output.value ? output.value.low : 0;
    return { address, amount };
  }

  _convertOutputScript(coin: string, output: Output): { address: string; amount: number } {
    let address: string;
    const scriptBitcore = Bitcore_[coin].Script(output.outputScript);
    const { hashBuffer, type } = scriptBitcore.getAddressInfo();
    if (!hashBuffer || !type) return null;
    const addressBitcore = Bitcore_[coin].Address(hashBuffer);
    let amount = 0;
    if (coin === 'xec') {
      if (output.slpToken) {
        address = addressBitcore.encode('etoken', type, hashBuffer);
        amount = Number(output.slpToken.amount);
      } else {
        address = addressBitcore.encode('ecash', type, hashBuffer);
        amount = output.value ? Number(output.value.toString()) : 0;
      }
    } else {
      address = addressBitcore.toXAddress();
      amount = output.value ? Number(output.value.toString()) : 0;
    }

    return { address, amount };
  }

  _normalizeTxHistory(walletId, txs: any[], dustThreshold, bcHeight, wallet, cb) {
    if (_.isEmpty(txs)) return cb(null, txs);

    // console.log('[server.js.2915:txs:] IN NORMALIZE',txs); //TODO

    // One fee per TXID
    const indexedFee: any = _.keyBy(_.filter(txs, { category: 'fee' } as any), 'txid');
    const indexedSend = _.keyBy(_.filter(txs, { category: 'send' } as any), 'txid');
    const seenSend = {};
    const seenReceive = {};

    const moves: { [txid: string]: ITxProposal } = {};
    // remove 'fees' and 'moves' (probably change addresses)
    txs = txs.filter(tx => {
      // double spend or error
      // This should be shown on the client, so we dont remove it here
      //    if (tx.height && tx.height <= -3)
      //      return false;

      if (tx.category == 'receive') {
        if (tx.satoshis < dustThreshold) return false;

        const output = {
          address: tx.address,
          amount: Math.abs(tx.satoshis)
        };
        if (seenReceive[tx.txid]) {
          seenReceive[tx.txid].outputs.push(output);
          return false;
        } else {
          tx.outputs = [output];
          seenReceive[tx.txid] = tx;
          return true;
        }
      }
      if (tx.category == 'send') {
        const output = {
          address: tx.address,
          amount: Math.abs(tx.satoshis)
        };
        if (seenSend[tx.txid]) {
          seenSend[tx.txid].outputs.push(output);
          return false;
        } else {
          tx.outputs = [output];
          seenSend[tx.txid] = tx;
          return true;
        }
      }

      // move without send?
      if (tx.category == 'move' && !indexedSend[tx.txid]) {
        const output = {
          address: tx.address,
          amount: Math.abs(tx.satoshis)
        };

        if (moves[tx.txid]) {
          moves[tx.txid].outputs.push(output);
          return false;
        } else {
          moves[tx.txid] = tx;
          tx.outputs = [output];
          return true;
        }
      }
    });

    // Filter out moves:
    // This are moves from the wallet to itself. There are 2+ outputs. one if the change
    // the other a main address for the wallet.
    for (const txid in moves) {
      if (moves[txid].outputs.length <= 1) {
        delete moves[txid];
      }
    }

    const fixMoves = cb2 => {
      if (!Object.keys(moves).length) return cb2();

      // each detected duplicate output move
      const moves3 = Object.values(moves).flatMap(m => m.outputs);
      // check output address for change address
      this.storage.fetchAddressesByWalletId(walletId, moves3.map(m => m.address), (err, addrs) => {
        if (err) return cb(err);

        const isChangeAddress = _.countBy(addrs.filter(a => a.isChange), 'address');
        for (const x of Object.values(moves)) {
          x.outputs = x.outputs.filter(o => !isChangeAddress[o.address]);
        }
        return cb2();
      });
    };

    fixMoves(err => {
      if (err) return cb(err);

      const ret = (txs || []).map(tx => {
        const t = new Date(tx.blockTime).getTime() / 1000;
        const c = tx.height >= 0 && bcHeight >= tx.height ? bcHeight - tx.height + 1 : 0;

        // This adapter rebuilds the abiType property from data contained in the effects so that it returns what wallet is used to
        // If we remove the slight reliance in the wallet on abiType then we can remove this adapter
        function recreateAbiType(effects) {
          // Check if any top level effects are ERC20 transfers
          if (effects && effects.length) {
            const erc20Transfer = effects.find(e => e.type == 'ERC20:transfer' && e.callStack == '');
            if (erc20Transfer) {
              // This is the only data used in old wallet and bitpay-app
              return { name: 'transfer' };
            }
          }
          return undefined;
        }

        const ret = {
          id: tx.id,
          txid: tx.txid,
          confirmations: c,
          blockheight: tx.height > 0 ? tx.height : null,
          fees: tx.fee ?? (indexedFee[tx.txid] ? Math.abs(indexedFee[tx.txid].satoshis) : null),
          time: t,
          size: tx.size,
          amount: 0,
          action: undefined,
          addressTo: undefined,
          outputs: undefined,
          dust: false,
          error: tx.error,
          internal: tx.internal,
          network: tx.network,
          chain: tx.chain,
          data: tx.data,
          abiType: tx.abiType || recreateAbiType(tx.effects),
          gasPrice: tx.gasPrice,
          maxGasFee: tx.maxGasFee,
          priorityGasFee: tx.priorityGasFee,
          txType: tx.txType,
          gasLimit: tx.gasLimit,
          receipt: tx.receipt ? { ...tx.receipt, logs: undefined } : undefined,
          nonce: tx.nonce,
          effects: tx.effects,
          inputAddresses: _.uniq(
            _.map(tx.inputs, item => {
              return this._convertAddressFormInputScript(item.script, wallet.chain, wallet.isSlpToken);
            })
          )
        };
        switch (tx.category) {
          case 'send':
            ret.action = 'sent';
            ret.amount = Math.abs(tx.outputs.reduce((sum, o) => sum += o.amount, 0)) || Math.abs(tx.satoshis);
            ret.addressTo = tx.outputs ? tx.outputs[0].address : null;
            ret.outputs = tx.outputs;
            break;
          case 'receive':
            ret.action = 'received';
            ret.outputs = tx.outputs;
            ret.amount = Math.abs(tx.outputs.reduce((sum, o) => sum += o.amount, 0)) || Math.abs(tx.satoshis);
            ret.dust = ret.amount < dustThreshold;
            break;
          case 'move':
            ret.action = 'moved';
            ret.amount = Math.abs(tx.satoshis);
            ret.addressTo = tx.outputs && tx.outputs.length ? tx.outputs[0].address : null;
            ret.outputs = tx.outputs;
            break;
          default:
            ret.action = 'invalid';
        }

        // not available
        // inputs: inputs,
        return ret;

        // filter out dust
      }).filter(x => !x.dust);

      // console.log('[server.js.2965:ret:] END',ret); //TODO
      return cb(null, ret);
    });
  }

  _getBlockchainHeight(chain, network, cb) {
    const cacheKey = Storage.BCHEIGHT_KEY + ':' + chain + ':' + network;
    const cacheTime = Defaults.BLOCKHEIGHT_CACHE_TIME[chain.toLowerCase()] || Defaults.BLOCKHEIGHT_CACHE_TIME.default;

    this.storage.checkAndUseGlobalCache(cacheKey, cacheTime, (err, values) => {
      if (err) return cb(err);

      if (values) return cb(null, values.current, values.hash, true);

      values = {};

      const bc = this._getBlockchainExplorer(chain, network);
      if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
      bc.getBlockchainHeight((err, height, hash) => {
        if (!err && height > 0) {
          values.current = height;
          values.hash = hash;
        } else {
          return cb(err || 'wrong height');
        }

        this.storage.storeGlobalCache(cacheKey, values, err => {
          if (err) {
            this.logw('Could not store bc height cache:', err);
          }
          return cb(null, values.current, values.hash);
        });
      });
    });
  }

  updateWalletV8Keys(wallet) {
    if (!wallet.beAuthPrivateKey2) {
      this.logd('Adding wallet beAuthKey');
      wallet.updateBEKeys();
    }
  }

  registerWalletV8(wallet: Wallet, cb) {
    if (wallet.beRegistered) {
      return cb();
    }
    const bc = this._getBlockchainExplorer(wallet.chain, wallet.network);

    this.logd('Registering wallet');
    bc.register(wallet, err => {
      if (err) {
        return cb(err);
      }
      wallet.beRegistered = true;
      return this.storage.storeWalletRegistration(wallet, err => cb(err, true));
    });
  }

  checkWalletSync(bc, wallet, simpleRun, cb) {
    if (!wallet.addressManager && !wallet.addressManager.receiveAddressIndex) return cb(null, true);

    // check cache
    const totalAddresses = wallet.addressManager.receiveAddressIndex + wallet.addressManager.changeAddressIndex;

    this.storage.getWalletAddressChecked(wallet.id, (err, checkedTotal) => {
      if (checkedTotal == totalAddresses) {
        logger.debug('addresses checked already');
        return cb(null, true);
      }

      // only check total number of addreses
      if (simpleRun) return cb();

      this.storage.walletCheck({ walletId: wallet.id }).then((localCheck: { sum: number }) => {
        bc.getCheckData(wallet, (err, serverCheck) => {
          // If there is an error, just ignore it (server does not support walletCheck)
          if (err) {
            this.logw('Error at bitcore WalletCheck, ignoring:', err);
            return cb();
          }

          const isOK = serverCheck.sum == localCheck.sum;

          if (isOK) {
            logger.debug('Wallet Sync Check OK');
          } else {
            logger.warn('ERROR: Wallet check failed: %o', { localCheck, serverCheck });
            return cb(null, isOK);
          }

          this.storage.setWalletAddressChecked(wallet.id, totalAddresses, () => {
            return cb(null, isOK);
          });
        });
      });
    });
  }

  /**
   * Syncs wallet regitration and address with a V8 type blockexplorerer
   * @param {Wallet} wallet
   * @param {Function} cb
   * @param {Boolean} skipCheck (optional) skip verification step
   * @param {Number} count (optional) counter for recursive calls
   * @param {Boolean} force (optional) force a re-sync
   * @returns
   */
  syncWallet(wallet, cb, skipCheck?, count?, force?) {
    count = count || 0;
    const bc = this._getBlockchainExplorer(wallet.chain, wallet.network);
    if (!bc) {
      return cb(new Error('Could not get blockchain explorer instance'));
    }

    this.updateWalletV8Keys(wallet);
    this.registerWalletV8(wallet, (err, justRegistered) => {
      if (err) {
        return cb(err);
      }

      // First
      this.checkWalletSync(bc, wallet, true, (err, isOK) => {
        // ignore err
        if (isOK && !justRegistered && !force) return cb();

        const fetchAddresses = (force ? this.storage.fetchAddresses : this.storage.fetchUnsyncAddresses).bind(this.storage);
        fetchAddresses(this.walletId, (err, addresses) => {
          if (err) {
            return cb(err);
          }

          const syncAddr = (addresses, icb) => {
            if (!addresses?.length) {
              // this.logi('Addresses already sync');
              return icb();
            }

            const addressStr = addresses.map(x => {
              ChainService.addressFromStorageTransform(wallet.chain, wallet.network, x);
              return x.address;
            });

            this.logd('Syncing addresses: ', addressStr.length);
            bc.addAddresses(wallet, addressStr, err => {
              if (err) return cb(err);
              this.storage.markSyncedAddresses(addressStr, icb);
            }, { reprocess: force });
          };

          syncAddr(addresses, () => {
            if (skipCheck || doNotCheckV8) return cb();

            this.checkWalletSync(bc, wallet, false, (err, isOK) => {
              // ignore err
              if (err) return cb();

              if (isOK) return cb();

              if (count++ >= 1) {
                logger.warn('## ERROR: TRIED TO SYNC WALLET AND FAILED. GIVING UP');
                return cb();
              }
              logger.info('Trying to RESYNC wallet... count:' + count);

              // Reset sync and sync again...
              wallet.beRegistered = false;
              this.storage.deregisterWallet(wallet.id, () => {
                this.syncWallet(wallet, cb, false, count);
              });
            });
          });
        });

      });
    });
  }

  static _getResultTx(wallet, indexedAddresses, tx, opts) {
    let amountIn, amountOut, amountOutChange;
    let amount, action, addressTo;
    let inputs, outputs, foreignCrafted;

    const sum = (items, isMine, isChange = false) => {
      return items.filter(i => i.isMine == isMine && i.isChange == isChange).reduce((sum, i) => sum += i.amount, 0);
    };

    const classify = items => {
      return items.map(item => {
        const address = indexedAddresses[item.address];
        return {
          address: item.address,
          amount: item.amount,
          isMine: !!address,
          isChange: address ? address.isChange || wallet.singleAddress : false
        };
      });
    };

    if (tx.outputs.length || tx.inputs.length) {
      inputs = classify(tx.inputs);
      outputs = classify(tx.outputs);
      amountIn = sum(inputs, true);
      amountOut = sum(outputs, true, false);
      amountOutChange = sum(outputs, true, true);
      if (amountIn == amountOut + amountOutChange + (amountIn > 0 ? tx.fees : 0)) {
        amount = amountOut;
        action = 'moved';
      } else {
        // BWS standard sent
        // (amountIn > 0 && amountOutChange >0 && outputs.length <= 2)
        amount = amountIn - amountOut - amountOutChange - (amountIn > 0 && amountOutChange > 0 ? tx.fees : 0);
        action = amount > 0 ? 'sent' : 'received';
      }

      amount = Math.abs(amount);
      if (action === 'sent' || action === 'moved') {
        const firstExternalOutput = outputs.find(o => o.isMine === false);
        addressTo = firstExternalOutput ? firstExternalOutput.address : null;
      }

      if (action == 'sent' && inputs.length !== inputs.filter(i => i.isMine).length) {
        foreignCrafted = true;
      }
    } else {
      action = 'invalid';
      amount = 0;
    }

    const formatOutput = o => {
      return {
        amount: o.amount,
        address: o.address
      };
    };

    const newTx = {
      txid: tx.txid,
      action,
      amount,
      fees: tx.fees,
      time: tx.time,
      addressTo,
      confirmations: tx.confirmations,
      foreignCrafted,
      outputs: undefined,
      feePerKb: undefined,
      inputs: undefined
    };

    if (Utils.isNumber(tx.size) && tx.size > 0) {
      newTx.feePerKb = +((tx.fees * 1000) / tx.size).toFixed();
    }

    if (opts.includeExtendedInfo) {
      newTx.inputs = inputs.map(input => {
        return _.pick(input, 'address', 'amount', 'isMine');
      });
      newTx.outputs = outputs.map(output => {
        return _.pick(output, 'address', 'amount', 'isMine');
      });
    } else {
      outputs = outputs.filter(o => !o.isChange);
      if (action == 'received') {
        outputs = outputs.filter(o => o.isMine);
      }
      newTx.outputs = outputs.map(o => ({
        amount: o.amount,
        address: o.address
      }));
    }

    return newTx;
  }

  static _addProposalInfo(tx: any, indexedProposals: { [txid: string]: TxProposal }, opts: any) {
    opts = opts || {};
    const proposal = indexedProposals[tx.txid];
    if (proposal) {
      tx.createdOn = proposal.createdOn;
      tx.proposalId = proposal.id;
      tx.proposalType = proposal.type;
      tx.creatorName = proposal.creatorName;
      tx.message = proposal.message;
      tx.nonce = proposal.nonce;
      tx.actions = proposal.actions.map(action => {
        return _.pick(action, ['createdOn', 'type', 'copayerId', 'copayerName', 'comment']);
      });
      for (const output of tx.outputs || []) {
        if (proposal.outputs) {
          const txpOut = proposal.outputs.find(o => o.toAddress === output.address && o.amount === output.amount);
          output.message = txpOut ? txpOut.message : null;
        }
      }
      tx.customData = proposal.customData;

      tx.createdOn = proposal.createdOn;
      if (opts.includeExtendedInfo) {
        tx.raw = proposal.raw;
      }
      // .sentTs = proposal.sentTs;
      // .merchant = proposal.merchant;
      // .paymentAckMemo = proposal.paymentAckMemo;
    }
  }

  static _addNotesInfo(tx, indexedNotes) {
    const note = indexedNotes[tx.txid];
    if (note) {
      tx.note = _.pick(note, ['body', 'editedBy', 'editedByName', 'editedOn']);
    }
  }

  /**
   * // Create Advertisement
   * @param opts
   * @param cb
   */
  createAdvert(opts, cb) {
    opts = opts ? _.clone(opts) : {};

    // Usually do error checking on preconditions
    if (!checkRequired(opts, ['title'], cb)) {
      return;
    }
    // Check if ad exists already

    const checkIfAdvertExistsAlready = (adId, cb) => {
      this.storage.fetchAdvert(opts.adId, (err, result) => {
        if (err) return cb(err);

        if (result) {
          return cb(Errors.AD_ALREADY_EXISTS);
        }

        if (!result) {
          const x = new Advertisement();

          x.advertisementId = opts.advertisementId || Uuid.v4();
          x.name = opts.name;
          x.title = opts.title;
          x.country = opts.country;
          x.type = opts.type;
          x.body = opts.body;
          x.imgUrl = opts.imgUrl;
          x.linkText = opts.linkText;
          x.linkUrl = opts.linkUrl;
          x.isAdActive = opts.isAdActive;
          x.dismissible = opts.dismissible;
          x.signature = opts.signature;
          x.app = opts.app;
          x.isTesting = opts.isTesting;

          return cb(null, x);
        }
      });
    };

    this._runLocked(
      cb,
      cb => {
        checkIfAdvertExistsAlready(opts.adId, (err, advert) => {
          if (err) throw err;
          if (advert) {
            this.storage.storeAdvert(advert, cb);
          }
        });
      },
      10 * 1000
    );
  }

  /**
   * Get All active (live) advertisements
   * @param opts
   * @param opts.adId - adId of advert to get
   * @param cb
   */
  getAdvert(opts, cb) {
    this.storage.fetchAdvert(opts.adId, (err, advert) => {
      if (err) return cb(err);
      return cb(null, advert);
    });
  }

  /**
   * Get All active (live) advertisements
   * @param opts
   * @param cb
   */
  getAdverts(opts, cb) {
    this.storage.fetchActiveAdverts((err, adverts) => {
      if (err) return cb(err);
      return cb(null, adverts);
    });
  }

  /**
   * Get adverts by country
   * @param opts.country
   * @param cb
   */
  getAdvertsByCountry(opts, cb) {
    this.storage.fetchAdvertsByCountry(opts.country, (err, adverts) => {
      if (err) return cb(err);
      return cb(null, adverts);
    });
  }

  /**
   * Get All active (live) advertisements
   * @param opts
   * @param cb
   */
  getTestingAdverts(opts, cb) {
    this.storage.fetchTestingAdverts((err, adverts) => {
      if (err) return cb(err);
      return cb(null, adverts);
    });
  }

  /**
   * Get all adverts regardless of inactive or active.
   * @param opts
   * @param cb
   */
  getAllAdverts(opts, cb) {
    this._runLocked(cb, cb => {
      this.getAllAdverts(opts, cb);
    });
  }

  removeAdvert(opts, cb) {
    opts = opts ? _.clone(opts) : {};

    // Usually do error checking on preconditions
    if (!checkRequired(opts, ['adId'], cb)) {
      throw new Error('adId is missing');
    }
    // Check if ad exists already

    const checkIfAdvertExistsAlready = (adId, cb) => {
      this.storage.fetchAdvert(opts.adId, (err, result) => {
        if (err) return cb(err);

        if (!result) {
          throw new Error('Advertisement does not exist: ' + opts.adId);
        }

        if (result) {
          this.logw('Advert already exists:', opts.adId);
          return cb(null, adId);
        }
      });
    };

    this._runLocked(
      cb,
      cb => {
        checkIfAdvertExistsAlready(opts.adId, (err, adId) => {
          if (err) throw err;
          this.storage.removeAdvert(adId, cb); // TODO: add to errordefinitions Errors.ADVERTISEMENT already exists
        });
      },
      10 * 1000
    );
  }

  activateAdvert(opts, cb) {
    opts = opts ? _.clone(opts) : {};
    // Usually do error checking on preconditions
    if (!checkRequired(opts, ['adId'], cb)) {
      throw new Error('adId is missing');
    }

    this.storage.activateAdvert(opts.adId, (err, result) => {
      if (err) return cb(err);
      return cb(null, result);
    });
  }

  deactivateAdvert(opts, cb) {
    opts = opts ? _.clone(opts) : {};
    // Usually do error checking on preconditions
    if (!checkRequired(opts, ['adId'], cb)) {
      throw new Error('adId is missing');
    }

    this.storage.deactivateAdvert(opts.adId, (err, result) => {
      if (err) return cb(err);
      return cb(null, result);
    });
  }

  tagLowFeeTxs(wallet: IWallet, txs: any[], cb) {
    const unconfirmed = txs.filter(tx => tx.confirmations === 0);
    if (_.isEmpty(unconfirmed)) return cb();

    this.getFeeLevels(
      {
        chain: wallet.chain,
        network: wallet.network
      },
      (err, levels) => {
        if (err) {
          this.logw('Could not fetch fee levels:', err);
        } else {
          const level = levels.find(l => l.level === 'superEconomy');
          if (!level || !level.nbBlocks) {
            this.logi('Cannot compute super economy fee level from blockchain');
          } else {
            const minFeePerKb = level.feePerKb;
            _.each(unconfirmed, tx => {
              tx.lowFees = tx.feePerKb < minFeePerKb;
            });
          }
        }
        return cb();
      }
    );
  }

  async getlastTxsByChronik(wallet, address, limit): Promise<Tx[] | LegacyTx[]> {
    let scriptPayload;
    try {
      const chronikClient =
        wallet.chain === 'xec'
          ? ChainService.getChronikClient(wallet.chain)
          : ChainService.getLegacyChronikClient(wallet.chain);
      scriptPayload = ChainService.convertAddressToScriptPayload(wallet.chain, address);
      const txHistoryPage = await chronikClient.script('p2pkh', scriptPayload).history(0, limit);
      return txHistoryPage.txs;
    } catch (err) {
      return Promise.reject(err);
    }
  }

  updateStatusSlpTxs(inTxs, lastTxsChronik: Array<Tx>, wallet) {
    const validTxs = [];
    _.forEach(inTxs, item => {
      const txsSlp = _.find(lastTxsChronik, itemTxsChronik => itemTxsChronik.txid == item.txid);
      if (txsSlp && txsSlp.tokenEntries && txsSlp.tokenEntries.length > 0) {
        const tokenEntry = txsSlp.tokenEntries[0];
        item.isSlpToken = true;
        item.tokenId = tokenEntry.tokenId;
        item.tokenType = tokenEntry.tokenType;
        item.txType = tokenEntry.txType;
        item.inputAddresses = _.uniq(
          _.map(txsSlp.inputs, item => {
            return this._convertAddressFormInputScript(item.inputScript, wallet.chain, true);
          })
        );
        item.amountTokenUnit =
          txsSlp.outputs[1].token && txsSlp.outputs[1].token.atoms
            ? Number(txsSlp.outputs[1].token.atoms)
            : undefined;
        item.burnAmountToken = this._getBurnAmountToken(txsSlp, tokenEntry.txType);
        if (item.burnAmountToken > 0) {
          item.txType = 'BURN';
        }
      }
      validTxs.push(item);
    });
    return validTxs;
  }

  _getBurnAmountToken(tx: Tx, type: string): number {
    let burnAmount = 0;
    if (tx.tokenEntries && tx.tokenEntries.length > 0) {
      const tokenEntry = tx.tokenEntries[0];
      burnAmount += Number(tokenEntry.actualBurnAtoms);
    }
    return Number(burnAmount);
  }

  getTxHistoryV8(bc: V8, wallet, opts, skip, limit, cb) {
    let bcHeight,
      bcHash,
      lastTxs,
      cacheStatus,
      resultTxs = [],
      fromCache = false;
    let txsToCache = [],
      fromBc;
    let streamData;
    let streamKey;
    let addressesToken;
    let walletCacheKey = wallet.id;
    if (opts.tokenAddress) {
      wallet.tokenAddress = opts.tokenAddress;
      walletCacheKey = `${wallet.id}-${opts.tokenAddress}`;
    }

    if (opts.multisigContractAddress) {
      wallet.multisigContractAddress = opts.multisigContractAddress;
      walletCacheKey = `${wallet.id}-${opts.multisigContractAddress}`;
    }

    async.series(
      [
        next => {
          // be sure the wallet is onsync
          this.syncWallet(wallet, next, true);
        },
        next => {
          this._getBlockchainHeight(wallet.chain, wallet.network, (err, height, hash) => {
            if (err) return next(err);
            bcHeight = height;
            bcHash = hash;
            streamKey = (this.userAgent || '') + '-' + limit + '-' + bcHash;
            return next();
          });
        },
        next => {
          this.storage.getTxHistoryCacheStatusV8(walletCacheKey, (err, inCacheStatus) => {
            if (err) return cb(err);
            cacheStatus = inCacheStatus;
            return next();
          });
        },
        next => {
          if (skip == 0 || !streamKey) return next();

          logger.debug('Checking streamKey/skip %o', { streamKey, skip });
          this.storage.getTxHistoryStreamV8(walletCacheKey, (err, result) => {
            if (err) return next(err);
            if (!result) return next();

            if (result.streamKey != streamKey) {
              logger.debug('Deleting old stream cache:' + result.streamKey);
              return this.storage.clearTxHistoryStreamV8(walletCacheKey, next);
            }

            streamData = result.items;
            logger.debug(`Using stream cache: ${streamData.length} txs`);
            return next();
          });
        },
        next => {
          if (this._isSupportToken(wallet)) {
            this.storage.fetchAddresses(this.walletId, (err, addresses) => {
              if (err) return cb(err);
              if (_.size(addresses) < 1 || !addresses[0].address)
                return cb('no addresss to get history by chronikClient ');
              addressesToken = addresses;
              return next();
            });
          } else {
            return next();
          }
        },
        next => {
          if (streamData) {
            lastTxs = streamData;
            if (cacheStatus.tipTxId) {
              // Stream data can outlive cache promotion, so trim any entries that
              // are now part of the durable cache before paging.
              lastTxs = _.takeWhile(lastTxs, (tx: any) => {
                return tx.txid != cacheStatus.tipTxId;
              });
            }
            return next();
          }

          const startBlock = cacheStatus.updatedHeight || 0;
          logger.debug(' ########### GET HISTORY v8 startBlock/bcH] %o', { startBlock, bcHeight });

          bc.getTransactions(wallet, startBlock, (err, txs) => {
            if (err) return cb(err);
            const dustThreshold = ChainService.getDustAmountValue(wallet.chain);
            this._normalizeTxHistory(walletCacheKey, txs, dustThreshold, bcHeight, wallet, async (err, inTxs: any[]) => {
              if (err) return cb(err);
              if (err) return cb(err);
              if (this._isSupportToken(wallet) && addressesToken && _.size(inTxs) > 0) {
                try {
                  let promiseList: Promise<Tx[] | LegacyTx[]>[] = [];
                  _.each(addressesToken, address => {
                    promiseList.push(
                      this.getlastTxsByChronik(wallet, address.address, _.size(inTxs) > 200 ? 200 : _.size(inTxs))
                    );
                  });
                  await Promise.all(promiseList).then(async lastTxsChronik => {
                    const result = lastTxsChronik.reduce<(Tx | LegacyTx)[]>(
                      (accumulator, value) => [...accumulator, ...value],
                      []
                    );
                    if (result.length > 0) {
                      inTxs = this.updateStatusSlpTxs(_.cloneDeep(inTxs), result as Tx[], wallet);
                    }
                  });
                } catch (err) {
                  return cb(err);
                }
              }

              if (cacheStatus.tipTxId) {
                // first item is the most recent tx.
                // removes already cache txs
                lastTxs = _.takeWhile(inTxs, tx => {
                  // cacheTxs are very confirmed, so can't be reorged
                  return tx.txid != cacheStatus.tipTxId;
                });

                // only store stream IF cache is been used.
                //
                logger.info(`Storing stream cache for ${walletCacheKey}: ${lastTxs.length} txs`);
                return this.storage.storeTxHistoryStreamV8(walletCacheKey, streamKey, lastTxs, next);
              }

              lastTxs = inTxs;
              return next();
            });
          });
        },
        next => {
          if (opts.reverse) {
            const cachedTxs = _.isNumber(cacheStatus.tipIndex) ? cacheStatus.tipIndex + 1 : 0;
            const totalTxs = cachedTxs + lastTxs.length;
            const oldestFirstSkip = skip;

            // Keep the existing newest-first cache math by translating the requested
            // oldest-first cursor into the equivalent newest-first slice.
            limit = Math.max(0, Math.min(limit, totalTxs - oldestFirstSkip));
            skip = Math.max(0, totalTxs - oldestFirstSkip - limit);
          }

          if (limit === 0) {
            resultTxs = [];
            fromCache = false;
            fromBc = false;
            return next();
          }

          // Case 1.
          //            t -->
          //  | Old TXS    | ======= LAST TXS ========== \
          //                     ^skip+limit       ^skip

          // Do we have enough results in last txs?
          if (lastTxs.length >= skip + limit) {
            resultTxs = lastTxs.slice(skip, skip + limit);
            fromCache = false;
            fromBc = true;
            return next();
          }
          // Case 2.
          // compose result (if the wallet has move that `limit`txs)
          //            t -->
          //  | Old TXS    |  [x]======= LAST TXS ==========[0] \
          //       ^skip+limit       ^skip
          if (lastTxs.length >= skip) {
            resultTxs = lastTxs.slice(skip); // grab from skip to the end.

            skip = 0;
            limit -= resultTxs.length;
            fromBc = resultTxs.length > 0;
          } else {
            // Case 3.
            //            t -->
            //  | Old TXS ------------------ | ======= LAST TXS ========== \
            //       ^skip+limit       ^skip

            skip -= lastTxs.length;
          }
          // Complete result
          this.storage.getTxHistoryCacheV8(walletCacheKey, skip, limit, (err, oldTxs) => {
            if (err) {
              return next(err);
            }

            if (oldTxs.length) {
              fromCache = true;
            }

            // update confirmations from height
            _.each(oldTxs, x => {
              if (x.blockheight > 0 && bcHeight >= x.blockheight) {
                x.confirmations = bcHeight - x.blockheight + 1;
              }
            });

            resultTxs = resultTxs.concat(oldTxs);
            return next();
          });
        },
        next => {
          // get all txs from chronik client
          if (wallet.chain === 'xpi' && wallet.singleAddress) {
            if (resultTxs && resultTxs.length > 0) {
              const chronikClient = ChainService.getChronikClient(wallet.chain);
              // filter get only tx have on-chain message
              let filterResultTxs = _.filter(resultTxs, tx => {
                // if tx action = received => get all txs because we have no clue if this tx having message or not
                if (tx.action === 'received') {
                  return true;
                } else if (tx.action === 'sent') {
                  // if tx action = sent => check output having false address or not
                  return !!_.find(tx.outputs, o => o.address === 'false' || !o.address);
                }
              });
              if (filterResultTxs && filterResultTxs.length > 0) {
                // call chronik client get all tx details
                const listTxDetailFromChronik = _.map(filterResultTxs, async tx => {
                  const txDetailFromChronik = chronikClient.tx(tx.txid);
                  return txDetailFromChronik;
                });

                // handle tx details return from chronik client
                return Promise.all(listTxDetailFromChronik).then(listTx => {
                  if (!!listTx && listTx.length > 0) {
                    // remove undefined, false value from list txs return from chronik
                    listTx = _.compact(listTx);

                    // mapping tx details from chronik with only 2 att : txid and outputScript
                    const opReturnScript =
                      Constants.opReturn.opReturnPrefixHex + Constants.opReturn.opReturnAppPrefixLengthHex;
                    const txs = _.map(listTx, function (tx) {
                      if (tx) {
                        return {
                          txid: tx.txid,
                          outputScript: _.find(tx.outputs, o => o.outputScript.includes(opReturnScript))
                            ? _.find(tx.outputs, o => o.outputScript.includes(opReturnScript)).outputScript
                            : null
                        };
                      }
                    });

                    // mapping txs from chronik with txs already on node or bws
                    _.each(txs, txDetail => {
                      const txFound = _.find(filterResultTxs, tx => txDetail.outputScript && tx.txid === txDetail.txid);
                      if (txFound) {
                        const outputFalse = _.find(txFound.outputs, o => o.address === 'false' || !o.address);
                        if (outputFalse) {
                          // assign outputscript from chronik tx detail to output in tx detail
                          outputFalse.outputScript = txDetail.outputScript;
                        } else {
                          txFound.outputs.push({
                            address: 'false',
                            outputScript: txDetail.outputScript
                          });
                        }
                      }
                    });
                    return next();
                  }
                });
              }
              return next();
            }
          }
          return next();
        },
        next => {
          if (this._isSupportToken(wallet)) {
            const chronikClient =
              wallet.chain === 'xec'
                ? ChainService.getChronikClient(wallet.chain)
                : ChainService.getLegacyChronikClient(wallet.chain);
            let filterResultTxs = _.filter(resultTxs, tx => !tx.burnAmountToken);
            if (filterResultTxs.length > 0) {
              const listTxDetailFromChronik = _.map(filterResultTxs, async tx => {
                const txDetailFromChronik = chronikClient.tx(tx.txid);
                return txDetailFromChronik;
              });

              return Promise.all(listTxDetailFromChronik).then(listTx => {
                const txs: Tx[] = _.compact(listTx) as Tx[];
                if (!!listTx && listTx.length > 0) {
                  // remove undefined, false value from list txs return from chronik
                  _.each(txs, async txDetail => {
                    const tx = _.find(
                      filterResultTxs,
                      tx =>
                        tx.txid === txDetail.txid &&
                        !!txDetail &&
                        !!txDetail.tokenEntries &&
                        !!(txDetail.tokenEntries.length > 0) &&
                        !!txDetail.tokenEntries[0].txType
                    );
                    if (!!tx) {
                      let burnAmount = 0;
                      const type = txDetail.tokenEntries[0].txType;
                      const inputs = txDetail.inputs;
                      if (!!type && type === 'BURN') {
                        inputs.forEach(input => {
                          if (typeof input.token !== 'undefined' && input.token.atoms && input.token.atoms != 0n) {
                            burnAmount = Number(input.token.atoms);
                          }
                        });
                      }
                      tx.burnAmountToken = burnAmount;
                      if (tx.burnAmountToken > 0) {
                        tx.txType = 'BURN';
                      }
                    }
                  });
                  return next();
                }
              });
            }
          }
          return next();
        },
        next => {
          if (streamData) {
            return next();
          }
          // We have now TXs from 'tipHeight` to end in `lastTxs`.
          // Store hard confirmed TXs
          // confirmations here is bcHeight - tip + 1, so OK.
          let CONFIRMATIONS_TO_START_CACHING = Defaults.CONFIRMATIONS_TO_START_CACHING;
          if (Constants.CONFIRMATIONS_TO_START_CACHING[wallet.chain] != null) {
            CONFIRMATIONS_TO_START_CACHING = Constants.CONFIRMATIONS_TO_START_CACHING[wallet.chain];
          }

          txsToCache = _.filter(lastTxs, i => {
            if (i.confirmations < CONFIRMATIONS_TO_START_CACHING) {
              return false;
            }
            if (!cacheStatus.tipHeight) return true;

            return i.blockheight > cacheStatus.tipHeight;
          });

          logger.debug(`Found ${lastTxs.length} new txs. Caching ${txsToCache.length}`);
          if (!txsToCache.length) {
            return next();
          }

          const updateHeight = bcHeight - CONFIRMATIONS_TO_START_CACHING;
          this.storage.storeTxHistoryCacheV8(walletCacheKey, cacheStatus.tipIndex, txsToCache, updateHeight, next);
        }
      ],
      err => {
        if (err) return cb(err);
        if (opts.reverse) {
          resultTxs.reverse();
        }
        return cb(null, {
          items: resultTxs,
          fromCache,
          fromBc,
          useStream: !!streamData
        });
      }
    );
  }

  /**
   * Retrieves all transactions (incoming & outgoing)
   * Times are in UNIX EPOCH
   *
   * @param {Object} opts
   * @param {Number} opts.skip (defaults to 0)
   * @param {Number} opts.limit
   * @param {Boolean} opts.reverse[=false] - Return oldest transactions first.
   * @param {String} opts.tokenAddress ERC20 Token Contract Address
   * @param {String} opts.multisigContractAddress MULTISIG ETH Contract Address
   * @param {Number} opts.includeExtendedInfo[=false] - Include all inputs/outputs for every tx.
   * @returns {TxProposal[]} Transaction proposals, newer first unless opts.reverse is set
   */
  getTxHistory(opts, cb) {
    opts = opts || {};

    // 50 is accepted by insight.
    // TODO move it to a bigger number with v8 is fully deployed
    opts.limit = !Utils.isNumber(opts.limit) ? 50 : Number(opts.limit);
    if (opts.limit > Defaults.HISTORY_LIMIT) return cb(Errors.HISTORY_LIMIT_EXCEEDED);

    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);

      if (wallet.scanStatus == 'error') return cb(Errors.WALLET_NEED_SCAN);

      if (wallet.scanStatus == 'running') return cb(Errors.WALLET_BUSY);

      const bc: V8 = this._getBlockchainExplorer(wallet.chain, wallet.network);
      if (!bc) return cb(new Error('Could not get blockchain explorer instance'));

      const from = opts.skip || 0;
      const to = from + opts.limit;

      async.waterfall(
        [
          next => {
            this.getTxHistoryV8(bc, wallet, opts, from, opts.limit, next);
          },
          (txs: { items: Array<{ time: number }> }, next) => {
            if (!txs || !txs.items?.length) {
              return next();
            }
            // TODO optimize this...
            // Fetch all proposals in [t - 7 days, t + 1 day]
            const minTs = _.minBy(txs.items, 'time').time - 7 * 24 * 3600;
            const maxTs = _.maxBy(txs.items, 'time').time + 1 * 24 * 3600;

            async.parallel(
              [
                done => {
                  this.storage.fetchTxs(
                    this.walletId,
                    {
                      minTs,
                      maxTs
                    },
                    done,
                    wallet
                  );
                },
                done => {
                  this.storage.fetchTxNotes(
                    this.walletId,
                    {
                      minTs
                    },
                    done,
                    wallet
                  );
                }
              ],
              (err, res) => {
                return next(err, {
                  txs,
                  txps: res[0],
                  notes: res[1]
                });
              }
            );
          }
        ],
        (err, res: any) => {
          if (err) return cb(err);
          if (!res) return cb(null, []);
          // TODO we are indexing everything again, each query.
          const indexedProposals = _.keyBy(res.txps, 'txid');
          const indexedNotes = _.keyBy(res.notes, 'txid');

          const finalTxs = res.txs.items.map(tx => {
            WalletService._addProposalInfo(tx, indexedProposals, opts);
            WalletService._addNotesInfo(tx, indexedNotes);
            return tx;
          });
          this.tagLowFeeTxs(wallet, finalTxs, err => {
            if (err) this.logw('Failed to tag unconfirmed with low fee:', err);

            if (res.txs.fromCache) {
              let p = '';
              if (res.txs.fromBc) {
                p = 'Partial';
              }
              this.logd(`${p} History from cache ${from}/${to}: ${finalTxs.length} txs`);
            } else {
              this.logd(`History from bc ${from}/${to}: ${finalTxs.length} txs`);
            }
            return cb(null, finalTxs, !!res.txs.fromCache, !!res.txs.useStream);
          });
        }
      );
    });
  }

  /**
   * Scan the blockchain looking for addresses having some activity
   *
   * @param {Object} opts
   * @param {Boolean} opts.includeCopayerBranches (defaults to false)
   * @param {Boolean} opts.startingStep (estimate address number magniture (dflt to 1k), only
   * @param {Number} opts.startIdx (optional) start scanning from this index
   * for optimization)
   */
  scan(opts, cb) {
    opts = opts || {};
    opts.startingStep = opts.startingStep || 1000;

    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);
      if (!wallet.isComplete()) return cb(Errors.WALLET_NOT_COMPLETE);

      // OCT2018: We dont allow copayer's BIP45 addr scanning anymore (for performance)
      // for BIP44 wallets.
      if (wallet.derivationStrategy === Constants.DERIVATION_STRATEGIES.BIP44) {
        opts.includeCopayerBranches = false;
      }

      // no powerScan when scanning copayer Branches
      if (opts.includeCopayerBranches) {
        opts.startingStep = 1;
      }

      this.storage.clearWalletCache(this.walletId, () => {
        // do not scan single address UTXO wallets.
        if (wallet.singleAddress && ChainService.isUTXOChain(wallet.chain)) return cb();

        this._runLocked(cb, cb => {
          wallet.scanStatus = 'running';
          this.storage.storeWallet(wallet, err => {
            if (err) return cb(err);

            const bc = this._getBlockchainExplorer(wallet.chain, wallet.network);
            if (!bc) return cb(new Error('Could not get blockchain explorer instance'));
            opts.bc = bc;

            const scanComplete = error => {
              this.storage.fetchWallet(wallet.id, (err, wallet) => {
                if (err) return cb(err);
                wallet.scanStatus = error ? 'error' : 'success';
                this.storage.storeWallet(wallet, err => {
                  return cb(error || err);
                });
              });
            };

            if (!ChainService.isUTXOChain(wallet.chain)) {
              // non-UTXO chain "scan" is just a resync
              return this.syncWallet(wallet, scanComplete);
            }

            if (Number.isInteger(opts.startIdx)) {
              wallet.addressManager.receiveAddressIndex = opts.startIdx;
              wallet.addressManager.changeAddressIndex = opts.startIdx;
            }

            let step = opts.startingStep;
            async.doWhilst(
              next => {
                this._runScan(wallet, step, opts, next);
              },
              () => {
                step = step / 10;
                return step >= 1;
              },
              scanComplete
            );
          });
        });
      });
    });
  }

  _runScan(wallet: Wallet, step, opts, cb) {
    const scanBranch = (wallet: Wallet, derivator, cb) => {
      let inactiveCounter = 0;
      const allAddresses = [];

      let gap: number = Defaults.SCAN_ADDRESS_GAP;

      // when powerScanning, we just accept gap<=3
      if (step > 1) {
        gap = Math.min(gap, 3);
      }

      async.whilst(
        () => {
          //      this.logi('Scanning addr branch: %s index: %d gap %d step %d', derivator.id, derivator.index(), inactiveCounter, step);
          return inactiveCounter < gap;
        },
        next => {
          const address = derivator.derive();

          opts.bc.getAddressActivity(address.address, (err, activity) => {
            if (err) return next(err);
            //       console.log('[server.js.3779:address:] SCANING:' + address.address+ ':'+address.path + " :" + !!activity); //TODO

            allAddresses.push(address);
            inactiveCounter = activity ? 0 : inactiveCounter + 1;
            return next();
          });
        },
        err => {
          derivator.rewind(gap);
          return cb(err, allAddresses.slice(0, -gap));
        }
      );
    };

    const derivators = [];
    for (const isChange of [false, true]) {
      derivators.push({
        id: wallet.addressManager.getBaseAddressPath(isChange),
        derive: () => wallet.createAddress(isChange, step),
        index: () => wallet.addressManager.getCurrentIndex(isChange),
        rewind: (n) => wallet.addressManager.rewindIndex(isChange, step, n),
        getSkippedAddress: () => wallet.getSkippedAddress()
      });
      if (opts.includeCopayerBranches) {
        for (const copayer of wallet.copayers) {
          if (copayer.addressManager) {
            derivators.push({
              id: copayer.addressManager.getBaseAddressPath(isChange),
              derive: () => copayer.createAddress(wallet, isChange),
              index: () => copayer.addressManager.getCurrentIndex(isChange),
              rewind: (n) => copayer.addressManager.rewindIndex(isChange, step, n)
            });
          }
        }
      }
    }

    async.eachSeries(
      derivators,
      (derivator, next) => {
        let addresses = [];
        scanBranch(wallet, derivator, (err, scannedAddresses) => {
          if (err) return next(err);
          addresses = addresses.concat(scannedAddresses);

          if (step > 1) {
            this.logd('Deriving addresses for scan steps gaps DERIVATOR:' + derivator.id);

            let addr;
            while ((addr = derivator.getSkippedAddress())) {
              addresses.push(addr);
            }
            // this.logi(i + ' addresses were added.');
          }

          const reprocess = Number.isInteger(opts.startIdx);
          this._store(wallet, addresses, next, reprocess, reprocess);
        });
      },
      cb
    );
  }

  /**
   * Start a scan process.
   *
   * @param {Object} opts
   * @param {Boolean} opts.includeCopayerBranches (defaults to false)
   * @param {Number} opts.startIdx (optional) address derivation path start index (support agents only)
   */
  startScan(opts, cb) {
    const scanFinished = err => {
      const data = {
        result: err ? 'error' : 'success',
        error: undefined
      };
      if (err) data.error = err;
      this._notify('ScanFinished', data, {
        isGlobal: true
      });
    };

    this.getWallet({}, (err, wallet) => {
      if (err) return cb(err);
      if (!wallet.isComplete()) return cb(Errors.WALLET_NOT_COMPLETE);

      // do not scan single address UTXO wallets.
      if (wallet.singleAddress && ChainService.isUTXOChain(wallet.chain)) return cb();

      setTimeout(() => {
        wallet.beRegistered = false;
        this.storage.deregisterWallet(wallet.id, () => {
          this.scan(opts, scanFinished);
        });
      }, 100);

      return cb(null, {
        started: true
      });
    });
  }

  /**
   * Returns exchange rate for the specified currency & timestamp.
   * @param {Object} opts
   * @param {string} opts.code - Currency ISO code.
   * @param {Date} [opts.ts] - A timestamp to base the rate on (default Date.now()).
   * @param {String} [opts.provider] - A provider of exchange rates (default 'BitPay').
   * @returns {Object} rates - The exchange rate.
   */
  getFiatRate(opts, cb) {
    if (!checkRequired(opts, ['code'], cb)) return;

    this.fiatRateService.getRate(opts, (err, rate) => {
      if (err) return cb(err);
      return cb(null, rate);
    });
  }

  /**
   * Returns exchange rates of the supported fiat currencies for all coins.
   * @param {Object} opts
   * @param {String} [opts.code] - Currency ISO code (e.g: USD, EUR, ARS).
   * @param {Date} [opts.ts] - A timestamp to base the rate on (default Date.now()).
   * @param {String} [opts.provider] - A provider of exchange rates (default 'BitPay').
   * @returns {Array} rates - The exchange rate.
   */
  getFiatRates(opts, cb) {
    if (isNaN(opts.ts) || Array.isArray(opts.ts)) return cb(new ClientError('Invalid timestamp'));

    this.fiatRateService.getRates(opts, (err, rates) => {
      if (err) return cb(err);
      return cb(null, rates);
    });
  }


  /**
   * Returns exchange rates of the supported fiat currencies for all coins.
   * @returns {Array} rates - The exchange rate.
   */
  getAllFiatRates(cb) {

    return this.fiatRateService.getAllRates((err, rates) => {
      if (err) return cb(err);
      return cb(null, rates);
    });
  }

  /**
   * Returns swap configetOrderInfog.
   */
  async getConfigSwap(cb) {
    if (!clientsFund) {
      return cb(Errors.NOT_FOUND_KEY_FUND);
    }
    logger.debug('appDir: ', appDir);
    this.storage.fetchAllCoinConfig((err, listCoinConfig: CoinConfig[]) => {
      if (err) return cb(err);
      listCoinConfig = listCoinConfig.filter(s => s.isSupport);
      const swapConfig = new ConfigSwap();
      swapConfig.coinReceive = listCoinConfig.filter(s => s.isReceive && s.isEnableReceive && s.isSupport);
      swapConfig.coinSwap = listCoinConfig.filter(s => s.isSwap && s.isEnableSwap && s.isSupport);
      let promiseList = [];
      let promiseList2 = [];
      // const clientFundsSelected = clientsFund.find(client => client.credentials.coin === (coin.isToken ? 'xec' : coin.code));
      let isFundClientXecFound = false;
      let balanceTokenFound = null;
      let listBalanceTokenConverted = null;
      clientsFund.forEach(async clientFund => {
        promiseList2.push(
          this.getBalanceWithPromise({
            walletId: clientFund.credentials.walletId,
            coinCode: clientFund.credentials.coin,
            network: clientFund.credentials.network
          })
        );
        if (
          clientFund.credentials.coin === 'xec' &&
          (clientFund.credentials.rootPath.includes('1899') || clientFund.credentials.rootPath.includes('145'))
        ) {
          balanceTokenFound = await this.getTokensWithPromise({ walletId: clientFund.credentials.walletId });
        }
      });
      Promise.all(promiseList2)
        .then(balance => {
          logger.debug('balance: ', balance);
          if (balanceTokenFound) {
            listBalanceTokenConverted = _.map(balanceTokenFound, item => {
              return {
                tokenId: item.tokenId,
                tokenInfo: item.tokenInfo,
                amountToken: item.amountToken,
                utxoToken: item.utxoToken
              } as TokenItem;
            });
            logger.debug('listBalanceTokenConverted: ', listBalanceTokenConverted);
          }
          this.getAllTokenInfo((err, tokenInfoList: TokenInfo[]) => {
            this._getRatesWithCustomFormat((err, fiatRates) => {
              try {
                this._handleListCoinConfig(
                  swapConfig.coinReceive,
                  fiatRates,
                  listBalanceTokenConverted,
                  balance,
                  tokenInfoList
                );
                this._handleListCoinConfig(
                  swapConfig.coinSwap,
                  fiatRates,
                  listBalanceTokenConverted,
                  balance,
                  tokenInfoList
                );

                if (listRateWithPromise) {
                  this._getNetworkFeeForSwapConfig(listRateWithPromise, swapConfig);
                  return cb(null, swapConfig);
                } else {
                  // calculate fee for all support coin
                  listCoinConfig
                    .filter(coin => coin.isSupport)
                    .forEach(coin => promiseList.push(this.getFee(coin, { feeLevel: 'normal' })));
                  Promise.all(promiseList).then(listData => {
                    listRateWithPromise = listData;
                    setTimeout(() => {
                      if (listRateWithPromise) {
                        listRateWithPromise = null;
                      }
                    }, 5 * 60 * 1000);
                    this._getNetworkFeeForSwapConfig(listData, swapConfig);
                    return cb(null, swapConfig);
                  });
                }
              } catch (e) {
                logger.debug(e);
                return cb(e);
              }
            });
          });
        })
        .catch(e => {
          logger.debug(e);
        });
    });
  }

  _handleListCoinConfig(listCoinConfig: CoinConfig[], fiatRates, listBalanceTokenConverted, balances, tokenInfoList) {
    for (var i = 0; i < listCoinConfig.length; i++) {
      const coin = listCoinConfig[i];
      const coinQuantityFromUSDMin = coin.min / fiatRates[coin.code.toLowerCase()].USD;
      const coinQuantityFromUSDMax = coin.max / fiatRates[coin.code.toLowerCase()].USD;
      const rateCoinUsd = fiatRates[coin.code.toLowerCase()].USD;
      if (coin.isToken && listBalanceTokenConverted) {
        const balanceSelected = listBalanceTokenConverted.find(
          s => s.tokenInfo.symbol.toLowerCase() === coin.code.toLowerCase()
        );
        if (balanceSelected && !isNaN(balanceSelected.amountToken)) {
          const tokenDecimals = tokenInfoList.find(s => s.symbol.toLowerCase() === coin.code.toLowerCase()).decimals;
          coin.minConvertToSat = coinQuantityFromUSDMin * Math.pow(10, tokenDecimals);
          coin.maxConvertToSat = coinQuantityFromUSDMax * Math.pow(10, tokenDecimals);
          coin.fund = balanceSelected.amountToken * rateCoinUsd;
          coin.fundConvertToSat = balanceSelected.amountToken * Math.pow(10, tokenDecimals);
          coin.decimals = tokenDecimals;
        }
      } else {
        const balanceFound = balances.find(
          s => s.coin.toLowerCase() === coin.code.toLowerCase() && s.network === coin.network
        );
        if (balanceFound) {
          const balanceTotal = balanceFound.balance.totalAmount;
          coin.minConvertToSat = coinQuantityFromUSDMin * Constants.UNITS[coin.code.toLowerCase()].toSatoshis;
          coin.maxConvertToSat = coinQuantityFromUSDMax * Constants.UNITS[coin.code.toLowerCase()].toSatoshis;
          coin.fund = (balanceTotal / Constants.UNITS[coin.code.toLowerCase()].toSatoshis) * rateCoinUsd;
          coin.fundConvertToSat = balanceTotal;
          coin.decimals = Constants.UNITS[coin.code.toLowerCase()].full.maxDecimals;
        }
      }
      coin.rate = fiatRates[coin.code.toLowerCase()];
    }
  }

  _handleListCoinConfigWithNobalance(listCoinConfig: CoinConfig[], fiatRates, tokenInfoList) {
    for (var i = 0; i < listCoinConfig.length; i++) {
      const coin = listCoinConfig[i];
      const coinQuantityFromUSDMin = coin.min / fiatRates[coin.code.toLowerCase()].USD;
      const coinQuantityFromUSDMax = coin.max / fiatRates[coin.code.toLowerCase()].USD;
      const rateCoinUsd = fiatRates[coin.code.toLowerCase()].USD;
      if (coin.isToken) {
        const tokenDecimals = tokenInfoList.find(s => s.symbol.toLowerCase() === coin.code.toLowerCase()).decimals;
        coin.minConvertToSat = coinQuantityFromUSDMin * Math.pow(10, tokenDecimals);
        coin.maxConvertToSat = coinQuantityFromUSDMax * Math.pow(10, tokenDecimals);
        coin.decimals = tokenDecimals;
      } else {
        coin.minConvertToSat = coinQuantityFromUSDMin * Constants.UNITS[coin.code.toLowerCase()].toSatoshis;
        coin.maxConvertToSat = coinQuantityFromUSDMax * Constants.UNITS[coin.code.toLowerCase()].toSatoshis;
        coin.decimals = Constants.UNITS[coin.code.toLowerCase()].full.maxDecimals;
      }
      coin.rate = fiatRates[coin.code.toLowerCase()];
    }
  }
  /**
   * Returns swap configetOrderInfog.
   */
  async getConfigSwapWithNoBalance(cb) {
    if (!clientsFund) {
      return cb(Errors.NOT_FOUND_KEY_FUND);
    }
    logger.debug('appDir: ', appDir);
    this.storage.fetchAllCoinConfig((err, listCoinConfig: CoinConfig[]) => {
      if (err) return cb(err);
      listCoinConfig = listCoinConfig.filter(s => s.isSupport);
      const swapConfig = new ConfigSwap();
      swapConfig.coinReceive = listCoinConfig.filter(s => s.isReceive && s.isEnableReceive && s.isSupport);
      swapConfig.coinSwap = listCoinConfig.filter(s => s.isSwap && s.isEnableSwap && s.isSupport);
      let promiseList = [];
      // const clientFundsSelected = clientsFund.find(client => client.credentials.coin === (coin.isToken ? 'xec' : coin.code));
      this.getAllTokenInfo((err, tokenInfoList: TokenInfo[]) => {
        this._getRatesWithCustomFormat((err, fiatRates) => {
          try {
            this._handleListCoinConfigWithNobalance(swapConfig.coinReceive, fiatRates, tokenInfoList);
            this._handleListCoinConfigWithNobalance(swapConfig.coinSwap, fiatRates, tokenInfoList);
            if (listRateWithPromise) {
              this._getNetworkFeeForSwapConfig(listRateWithPromise, swapConfig);
              return cb(null, swapConfig);
            } else {
              // calculate fee for all support coin
              listCoinConfig
                .filter(coin => coin.isSupport)
                .forEach(coin => promiseList.push(this.getFee(coin, { feeLevel: 'normal' })));
              Promise.all(promiseList).then(listData => {
                listRateWithPromise = listData;
                setTimeout(() => {
                  if (listRateWithPromise) {
                    listRateWithPromise = null;
                  }
                }, 5 * 60 * 1000);
                this._getNetworkFeeForSwapConfig(listData, swapConfig);
                return cb(null, swapConfig);
              });
            }
          } catch (e) {
            logger.debug(e);
            return cb(e);
          }
        });
      });
    });
  }

  _getNetworkFeeForSwapConfig(listFeePerKb, swapConfig) {
    listFeePerKb.forEach((data: any) => {
      const coin = data.coin;
      const feePerKb = data.feePerKb;
      let estimatedFee;
      if (coin.isToken || coin.code === 'xec') {
        // Send dust transaction representing tokens being sent.
        const dustRepresenting = 546;
        //  Return any token change back to the sender.
        const dustReturnAnyToken = 546;
        // fee
        const fee = 250;

        estimatedFee = dustRepresenting + dustReturnAnyToken + fee;
      } else {
        const baseTxpSize = 78;
        const baseTxpFee = (baseTxpSize * feePerKb) / 1000;
        const sizePerInput = 148;
        const feePerInput = (sizePerInput * feePerKb) / 1000;
        estimatedFee = Math.round(baseTxpFee + feePerInput);
      }
      const coinSwapFound = swapConfig.coinSwap.find(
        coinReceive => coinReceive.code.toLowerCase() === coin.code.toLowerCase()
      );
      const coinReceiveFound = swapConfig.coinReceive.find(
        coinReceive => coinReceive.code.toLowerCase() === coin.code.toLowerCase()
      );
      if (coinReceiveFound && coinReceiveFound.networkFee === 0) {
        const coinCode = coin.isToken ? 'xec' : coin.code.toLowerCase();
        coinReceiveFound.networkFee = estimatedFee / Constants.UNITS[coinCode].toSatoshis;
      }
      if (coinSwapFound && coinSwapFound.networkFee === 0) {
        const coinCode = coin.isToken ? 'xec' : coin.code.toLowerCase();
        coinSwapFound.networkFee = estimatedFee / Constants.UNITS[coinCode].toSatoshis;
      }
    });
  }
  /**
   * Returns swap configetOrderInfog.
   */
  getListCoinConfig(cb) {
    if (!clientsFund) {
      return cb(Errors.NOT_FOUND_KEY_FUND);
    }
    if (!clientsReceive) {
      return cb(Errors.NOT_FOUND_KEY_RECEIVE);
    }
    this.storage.fetchAllCoinConfig((err, listCoinConfig: CoinConfig[]) => {
      if (err) return cb(err);
      listCoinConfig = listCoinConfig.filter(s => s.isSupport);
      this.getAllTokenInfo((err, tokenInfoList: TokenInfo[]) => {
        if (err) return cb(err);
        listCoinConfig.forEach(coin => {
          if (coin.isToken) {
            coin.tokenInfo = tokenInfoList.find(
              tokenInfo => tokenInfo.symbol.toLowerCase() === coin.code.toLowerCase()
            );
          }
        });
        return cb(null, listCoinConfig);
      });
    });
  }

  getConfigSwapWithPromise(): Promise<ConfigSwap> {
    return new Promise((resolve, reject) => {
      this.getConfigSwap((err, configSwap) => {
        if (err) return reject(err);
        return resolve(ConfigSwap.fromObj(configSwap));
      });
    });
  }

  getConfigSwapWithNoBalancePromise(): Promise<ConfigSwap> {
    return new Promise((resolve, reject) => {
      this.getConfigSwapWithNoBalance((err, configSwap) => {
        if (err) return reject(err);
        return resolve(ConfigSwap.fromObj(configSwap));
      });
    });
  }

  /**
   * Returns order info.
   * @param {Object} opts
   * @param {String} opts.id - The order info id requested.
   * @returns {Array} rates - The exchange rate.
   */
  async getOrderInfo(opts, cb) {
    if (!opts.id) {
      return cb(new Error('Missing order id'));
    }
    if (!clientsFund) {
      return cb(new Error('Can not find funding wallet'));
    }
    try {
      const configSwap = await this.getConfigSwapWithNoBalancePromise();
      if (configSwap) {
        this.storage.fetchOrderinfoById(opts.id, (err, result) => {
          if (err) return cb(err);
          const orderInfo = Order.fromObj(result);
          const configCoinSelected = configSwap.coinSwap.find(
            coinConfig => coinConfig.code.toLowerCase() === orderInfo.fromCoinCode.toLowerCase()
          );
          if (configCoinSelected) {
            orderInfo.coinConfig = configCoinSelected;
          } else {
            return cb(new Error('Can not find coin config for this order'));
          }

          const configCoinReceiveSelected = configSwap.coinReceive.find(
            coinConfig => coinConfig.code.toLowerCase() === orderInfo.toCoinCode.toLowerCase()
          );
          if (configCoinReceiveSelected) {
            orderInfo.coinConfigReceive = configCoinReceiveSelected;
          } else {
            return cb(new Error('Can not find coin config receive for this order'));
          }
          return cb(null, orderInfo);
        });
      } else {
        return cb(new Error('Can not find funding wallet'));
      }
    } catch (e) {
      return cb(new Error(e));
    }
  }

  /**
   * Returns order info.
   * @param {Object} opts
   * @param {String} opts.id - The order info id requested.
   * @returns {Object} order - The order info.
   */
  _getOrderInfo(opts): Promise<Order> {
    return new Promise((resolve, reject) => {
      this.storage.fetchOrderinfoById(opts.id, (err, result) => {
        if (err) reject(err);
        const orderInfo = Order.fromObj(result);
        resolve(orderInfo);
      });
    });
  }

  /**
   * Returns exchange rates of the supported fiat currencies for the specified coin.
   * @param {Object} opts
   * @returns {Array} list order info - The list of order info.
   */
  async getAllOrderInfo(opts, cb) {
    this.storage.fetchAllOrderInfo(opts, async (err, listOrderInfo) => {
      if (err) return cb(err);
      listOrderInfo = listOrderInfo.map(item => Order.fromObj(item));
      const count = await this.storage.countAllOrderInfo(opts);
      return cb(null, { listOrderInfo, count });
    });
  }

  /**
   * Returns exchange rates of the supported fiat currencies for the specified coin.
   * @param {Object} opts
   * @returns {Array} list order info - The list of order info.
   */
  async getAllConversionOrderInfo(opts, cb) {
    this.storage.fetchAllConversionOrderInfo(opts, async (err, listOrderInfo) => {
      if (err) return cb(err);
      listOrderInfo = listOrderInfo.map(item => ConversionOrder.fromObj(item));
      const count = await this.storage.countAllConversionOrderInfo(opts);
      return cb(null, { listOrderInfo, count });
    });
  }

  /**
   * Returns exchange rates of the supported fiat currencies for the specified coin.
   * @param {Object} opts
   * @param {String} opts.coin - The coin requested (btc, bch, eth, xrp, , ltc).
   * @param {String} [opts.code] - Currency ISO code (e.g: USD, EUR, ARS).
   * @param {Date} [opts.ts] - A timestamp to base the rate on (default Date.now()).
   * @param {String} [opts.provider] - A provider of exchange rates (default 'BitPay').
   * @returns {Array} rates - The exchange rate.
   */
  getFiatRatesByCoin(opts, cb) {
    if (!checkRequired(opts, ['coin'], cb)) return;
    if (isNaN(opts.ts) || Array.isArray(opts.ts)) return cb(new ClientError('Invalid timestamp'));

    this.fiatRateService.getRatesByCoin(opts, (err, rate) => {
      if (err) return cb(err);
      return cb(null, rate);
    });
  }

  /**
   * Returns historical exchange rates for the specified currency & timestamp range.
   * @param {Object} opts
   * @param {string} opts.code - Currency ISO code.
   * @param {Date} opts.ts - The oldest timestamp in the range to Date.now().
   * @param {String} [opts.provider] - A provider of exchange rates (default 'BitPay').
   * @returns {Object} rates - The exchange rate.
   */
  getHistoricalRates(opts, cb) {
    if (!checkRequired(opts, ['code'], cb)) return;

    this.fiatRateService.getHistoricalRates(opts, (err, rates) => {
      if (err) return cb(err);
      return cb(null, rates);
    });
  }

  /**
   * Usage for case get All Device
   * @param {Object} opts - Optional filter propety.
   * @param {boolean} opts.isActive - Optional. Get device active (countNumber > 0).
   * @returns {Array} - Return Array Device suitable condition.
   */
  getAllLogDevice(cb) {
    const opts = {};
    this.storage.fetchAllLogDevice(opts, (err, listLogDevice) => {
      if (err) return cb(err);
      return cb(null, listLogDevice);
    });
  }

  /**
   * Usage for case FIRST INSTALL APP. Will store device info to DB & send appreciation to device
   * @param {Object} opts - Device Info to store DB.
   * @param {String} opts.deviceId - Id of device.
   * @param {String} opts.location - OPTIONAL. Location is string gps number of device.
   * @param {String} opts.platform - OPTIONAL. Platform of device.
   * @param {String} opts.token - OPTIONAL. Token of device. It use for case send notification via firebase.
   * @param {String} opts.packageName - OPTIONAL. packageName of device. It use for case send notification via firebase.
   * @returns {Object} - Result deviceInfo after save DB.
   */
  storeLogDevice(opts, cb) {
    let device;
    let deviceId = opts && opts.deviceId;
    let location = opts && opts.location;
    let platform = opts && opts.platform;
    let token = opts && opts.token;
    let packageName = opts && opts.packageName;

    async.series(
      [
        next => {
          if (deviceId) {
            this.storage.getLogDeviceById(deviceId, (err, d) => {
              if (err) {
                return next(err);
              }
              device = d;
              next();
            });
          } else {
            next(new Error('No have deviceId'));
          }
        },
        next => {
          if (!device) {
            device = LogDevice.create({
              platform,
              deviceId,
              location,
              token,
              packageName
            });
            return this.storage.storeLogDevice(device, (err, rs) => {
              if (err) {
                return next(err);
              }
              device = rs;
              next();
            });
          } else {
            return cb(null, 'Exist device record');
          }
        },
        next => {
          if (token) {
            this.applyAppreciationForDevice(device, (err, appreciationInfo) => {
              if (err) {
                return cb(err);
              }
              // Create appreciation successfully & push notification if have token of device
              if (appreciationInfo) {
                // If have token device => push notification
                this.pushNotificationAppreciationMonthly(token, packageName, appreciationInfo, (err, isSent) => {
                  if (err) return cb(err);
                  if (isSent) return cb(null, 'Store & push notification successfully!!');
                });
              }
            });
          } else {
            return cb(null, 'Store successfully!!');
          }
        }
      ],
      err => {
        if (err) {
          return cb(err);
        }
        if (!device) {
          return cb(new Error('Could not get current device for this deviceId'));
        }

        return cb(null, device);
      }
    );
  }

  /**
   * Usage for case update LOCATION or DAILY CHECKIN or TOKEN
   * @param {Object} opts - Device Info.
   * @param {String} opts.deviceId - Id of device.
   * @param {String} opts.location - OPTIONAL. Location is string gps number of device.
   * @param {boolean} opts.attendance - OPTIONAL. DAILY CHECKIN variable.
   * @param {String} opts.token - OPTIONAL. Token of device. It use for case send notification via firebase.
   * @returns {Object} - Return device info.
   */
  updateLogDevice(opts, cb) {
    let device;
    let deviceId = opts && opts.deviceId;
    let location = opts && opts.location;
    let attendance = opts && opts.attendance;
    let token = opts && opts.token;
    let resultUpdate;

    async.series(
      [
        next => {
          if (deviceId) {
            this.storage.getLogDeviceById(deviceId, (err, d) => {
              if (err) {
                return next(err);
              }
              device = d;
              next();
            });
          } else {
            return next(new Error('No have deviceId'));
          }
        },
        next => {
          if (!device) {
            return next(new Error('No have device to update'));
          } else {
            device.touch();
            if (location) device.location = location;
            if (token) device.token = token;
            if (attendance) device.attendance();
            next();
          }
        },
        next => {
          this.storage.updateLogDevice(device, (err, result) => {
            if (err) return next(err);
            if (result) {
              resultUpdate = result;
              next();
            }
          });
        },
        next => {
          if (device.isFirstInstall === false && device.token) {
            this.applyAppreciationForDevice(device, (err, appreciationInfo) => {
              if (err) {
                return cb(err);
              }
              if (appreciationInfo) {
                this.pushNotificationAppreciationMonthly(
                  device.token,
                  device.packageName,
                  appreciationInfo,
                  (err, isSent) => {
                    if (err) return next(err);
                    if (isSent) return cb(null, resultUpdate);
                  }
                );
              }
            });
          } else {
            return cb(null, resultUpdate);
          }
        }
      ],
      err => {
        if (err) {
          return cb(err);
        }
        if (!device) {
          return cb(new Error('Could not get current device for this deviceId'));
        }

        return cb(null, device);
      }
    );
  }

  /**
   * Get Appreaciation by deviceId || ALL
   * @param {Object} opts - Object fetch Appreciation.
   * @param {String} deviceId - OPTIONAL. Fetch Appreciation by deviceId. NOT Fetch Appreciation all in DB.
   * @returns {Array} - Return List Appreciation suitable condition.
   */
  getAllAppreciation(opts, cb) {
    this.storage.fetchAllAppreciation(opts, (err, listAppreciation) => {
      if (err) return cb(err);
      return cb(null, listAppreciation);
    });
  }

  /**
   * Resend appreciation by deviceId. Just resend appreciation with status false
   * @param {String} deviceId - Fetch Appreciation by deviceId.
   * @returns {string} - Return status push notification.
   */
  resendAppreciation(deviceId, cb) {
    async.waterfall(
      [
        next => {
          this.storage.getLogDeviceById(deviceId, (err, device) => {
            if (err) return next(err);
            if (device) {
              next(null, device);
            } else {
              return next(new Error('Undefined deviceId'));
            }
          });
        },
        (device, next) => {
          if (device) {
            this.storage.fetchAllAppreciation({ deviceId }, (err, appreciation) => {
              if (err) return next(err);
              if (appreciation) {
                next(null, appreciation, device);
              } else {
                return next(new Error('Undefined appreciation'));
              }
            });
          }
        },
        (appreciations, device, next) => {
          async.each(
            appreciations,
            (appreciation: any, next) => {
              if (appreciation.status === false) {
                let title = appreciation.type === 'Weekly' ? 'Thanks for checking in !' : 'Welcome to AbcPay wallet !';
                let body =
                  appreciation.type === 'Weekly'
                    ? 'Here a small gift for checking around! Give it to someone who is in need.'
                    : 'Thanks for using our app. Here our small appreciation to you to start using the app. Claim it now!';
                const notification = {
                  to: device.token,
                  priority: 'high',
                  restricted_package_name: device.packageName,
                  data: {
                    title,
                    body,
                    claimCode: appreciation.claimCode,
                    status: appreciation.status,
                    createdOn: device.createdOn,
                    type: appreciation.type
                  },
                  notification: {
                    title,
                    body,
                    sound: 'default',
                    click_action: 'FCM_PLUGIN_ACTIVITY',
                    icon: 'fcm_push_icon'
                  }
                };
                this.pushNotifications._makeRequest(notification, (err, response) => {
                  if (err) logger.error('ERROR:' + err);
                  if (response) {
                    const statusCode = _.get(response, 'statusCode');
                    const statusMessage = _.get(response, 'statusMessage');
                    const bodyRes = _.get(response, 'body');
                    if (statusCode === 200) {
                      return cb(null, bodyRes);
                    } else {
                      return next(new Error(statusMessage));
                    }
                  }
                });
              }
            },
            err => {
              return next(err);
            }
          );
        }
      ],
      err => {
        if (err) {
          return cb(err);
        }
      }
    );
  }

  /**
   * Update Appreaciation claimed
   * @param {Object} opts - Object fetch Appreciation.
   * @param {String} deviceId - DeviceId
   * @param {String} claimCode - DeviceId
   * @param {String} dateClaim - DeviceId
   * @returns {Array} - Return List Appreciation suitable condition.
   */
  updateAppreciationClaim(opts, cb) {
    const claimCode = opts && opts.claimCode;
    const deviceId = opts && opts.deviceId;
    const dateClaim = opts && opts.dateClaim;

    let appreciation;

    async.series(
      [
        next => {
          this.storage.getAppreciationById({ deviceId, claimCode }, (err, appre) => {
            if (err) {
              return next(err);
            }
            appreciation = appre;
            next();
          });
        },
        next => {
          if (appreciation) {
            appreciation.deviceId = deviceId;
            appreciation.dateClaim = dateClaim;
            appreciation.status = !!dateClaim;
            this.storage.updateAppreciation(appreciation, next);
          }
        }
      ],
      err => {
        if (err) return cb(err);
        if (!appreciation) {
          return cb(new Error('Could not get current device for this deviceId'));
        }

        return cb(null, appreciation);
      }
    );
  }

  /**
   * Apply Appreaciation for Device
   * @param {String} deviceId - The token representing the app/device.
   * @returns {Object} - Return Appreciation.
   */
  applyAppreciationForDevice(device, cb) {
    let deviceId = device.deviceId;

    async.waterfall(
      [
        next => {
          this.storage.getOneAppreciationValid((err, appreciation) => {
            if (err) {
              return next(err);
            }
            if (appreciation) next(null, appreciation);
          });
        },
        (appreciation, next) => {
          if (appreciation) {
            appreciation.deviceId = deviceId;
            this.storage.updateAppreciation(appreciation, (err, appreciationUpdated) => {
              if (err) return next(err);
              if (appreciationUpdated) {
                next(null, appreciationUpdated);
              }
            });
          } else {
            return next(new Error('Could not get appreciation valid...'));
          }
        },
        (appreciationUpdated, next) => {
          device.isFirstInstall = true;
          this.storage.updateLogDevice(device, (err, updated) => {
            if (err) return next(err);
            if (updated) {
              return cb(null, appreciationUpdated);
            }
          });
        }
      ],
      err => {
        if (err) {
          return cb(err);
        }
      }
    );
  }

  /**
   * Get listDevice from DB to calculate group active (countNumber > 0) => map to list.
   * @param {Object} opts
   * @param {boolean} opts.isActive - Just take countNumber > 0 (Device active on week).
   * @returns {String} - Result group active.
   */
  calculateGroupWeeklyActive(cb) {
    // LOW (1-3)
    // MEDIUM (4-6)
    // HIGH (7)
    const opts = {
      isActive: true
    };
    let listDevice;
    let listLow = [],
      listMedium = [],
      listHigh = [];
    let result;

    this.storage.fetchAllLogDevice(opts, (err, d) => {
      if (err) {
        return cb(err);
      }
      listDevice = d;
      listDevice.forEach(device => {
        if (device.countNumber > 0 && device.countNumber <= 3) {
          listLow.push(device);
        } else if (device.countNumber > 3 && device.countNumber <= 6) {
          listMedium.push(device);
        } else if (device.countNumber === 7) {
          listHigh.push(device);
        }
      });
      result = {
        listDeviceLow: listLow,
        listDeviceMedium: listMedium,
        listDeviceHigh: listHigh,
        lengthGroupLow: listLow.length,
        lengthGroupMedium: listMedium.length,
        lengthGroupHigh: listHigh.length
      };

      return cb(null, result);
    });
  }

  createAppreciationMonthly(cb) {
    // Read file csv monthly to json array => each record array => create appreciation & save to DB
    let listCodeMonthlyCsv = [],
      appreciationList = [];
    let countCreatedAppreciation = 0;

    async.waterfall(
      [
        next => {
          this.readDataCvsMonthly(next);
        },
        (listSubLixi, next) => {
          listCodeMonthlyCsv = listSubLixi;
          if (listCodeMonthlyCsv.length > 0) {
            listCodeMonthlyCsv.forEach(item => {
              if (item.claimCode && item.claimed === 'false') {
                let appreciation = Appreciation.create({
                  deviceId: 'null',
                  claimCode: item.claimCode,
                  type: 'Monthly'
                });
                appreciationList.push(appreciation);
              }
            });
            return next(null, appreciationList);
          } else {
            return next(new Error('Could not get data in csv file...'));
          }
        },
        (appreciationList, next) => {
          this.storage.removeExpiredAppreciation('Monthly', (err, result) => {
            if (err) {
              return next(err);
            }
            if (result) return next(null, result);
          });
        },
        (resultRemove, next) => {
          if (appreciationList.length > 0) {
            this.storage.storeManyAppreciation(appreciationList, (err, result) => {
              if (err) {
                return next(new Error('Create appreciation monthly error!!!'));
              }
              if (result) {
                countCreatedAppreciation = result.insertedCount;
                return next(null, countCreatedAppreciation);
              }
            });
          } else {
            return next(new Error('Could not get data in csv file...'));
          }
        },
        (countCreated, next) => {
          return cb(null, `Create successfully appreciation MONTHLY with: ${countCreated} appreciation`);
        }
      ],
      err => {
        if (err) {
          logger.error('An error ocurred generating appreciation monthly:' + err);
        }
        return cb(err);
      }
    );
  }

  createAppreciationWeekly(cb) {
    // Filter to get list Device active (countNumber > 0)
    const opts = {
      isActive: true
    };

    let newListDeviceLow, newListDeviceMedium, newListDeviceHigh;

    async.waterfall(
      [
        next => {
          this.storage.fetchAllLogDevice(opts, (err, listDevice) => {
            if (err) {
              return next(err);
            }
            if (listDevice) return next(null, listDevice);
          });
        },
        (listDevice, next) => {
          let listDeviceLow = [],
            listDeviceMedium = [],
            listDeviceHigh = [];
          let listCodeWeeklyLowCsv = [],
            listCodeWeeklyMediumCsv = [],
            listCodeWeeklyHighCsv = [];
          // After filter, have list Device => group list device by countNumber.
          listDevice.forEach(device => {
            if (device.countNumber > 0 && device.countNumber <= 3) {
              listDeviceLow.push(device);
            } else if (device.countNumber > 3 && device.countNumber <= 6) {
              listDeviceMedium.push(device);
            } else if (device.countNumber === 7) {
              listDeviceHigh.push(device);
            }
          });
          // Read file csv => Have a group claim code data.
          this.readDataCvsWeekly((err, listClaimCodeCsv) => {
            if (err) return next(err);
            if (listClaimCodeCsv) {
              listCodeWeeklyLowCsv = listClaimCodeCsv[0];
              listCodeWeeklyMediumCsv = listClaimCodeCsv[1];
              listCodeWeeklyHighCsv = listClaimCodeCsv[2];

              if (listDeviceLow.length === listCodeWeeklyLowCsv.length) {
                newListDeviceLow = _.clone(listDeviceLow);
                newListDeviceLow.map((device, i) => {
                  listCodeWeeklyLowCsv.map((lixi, j) => {
                    if (i == j && lixi && lixi.claimed === 'false') {
                      Object.assign(device, lixi);
                    }
                  });
                });
              } else {
                return next(new Error('List LOW device & List LOW claim code not equal'));
              }
              if (listDeviceMedium.length === listCodeWeeklyMediumCsv.length) {
                newListDeviceMedium = _.clone(listDeviceMedium);
                newListDeviceMedium.map((device, i) => {
                  listCodeWeeklyMediumCsv.map((lixi, j) => {
                    if (i == j && lixi && lixi.claimed === 'false') {
                      Object.assign(device, lixi);
                    }
                  });
                });
              } else {
                return next(new Error('List MEDIUM device & List MEDIUM claim code not equal'));
              }
              if (listDeviceHigh.length === listCodeWeeklyHighCsv.length) {
                newListDeviceHigh = _.clone(listDeviceHigh);
                newListDeviceHigh.map((device, i) => {
                  listCodeWeeklyHighCsv.map((lixi, j) => {
                    if (i == j && lixi && lixi.claimed === 'false') {
                      Object.assign(device, lixi);
                    }
                  });
                });
              } else {
                return next(new Error('List HIGH device & List HIGH claim code not equal'));
              }
              next(null, newListDeviceLow, newListDeviceMedium, newListDeviceHigh);
            }
          });
        },
        (newListDeviceLow, newListDeviceMedium, newListDeviceHigh, next) => {
          let appreciationListLow = [],
            appreciationListMedium = [],
            appreciationListHigh = [];
          newListDeviceLow.map(deviceLow => {
            let appreciation = Appreciation.create({
              deviceId: deviceLow?.deviceId,
              claimCode: deviceLow?.claimCode,
              type: 'Weekly'
            });
            appreciationListLow.push(appreciation);
          });
          newListDeviceMedium.map(deviceMedium => {
            let appreciation = Appreciation.create({
              deviceId: deviceMedium?.deviceId,
              claimCode: deviceMedium?.claimCode,
              type: 'Weekly'
            });
            appreciationListMedium.push(appreciation);
          });
          newListDeviceHigh.map(deviceHigh => {
            let appreciation = Appreciation.create({
              deviceId: deviceHigh?.deviceId,
              claimCode: deviceHigh?.claimCode,
              type: 'Weekly'
            });
            appreciationListHigh.push(appreciation);
          });
          this.storeAppreciationWeekly(appreciationListLow, appreciationListMedium, appreciationListHigh, next);
        },
        (countCreatedAppreciation, next) => {
          if (newListDeviceLow.length > 0) {
            async.each(
              newListDeviceLow,
              (deviceLow: any, next) => {
                const notification = {
                  to: deviceLow.token,
                  priority: 'high',
                  restricted_package_name: deviceLow.packageName,
                  data: {
                    title: 'Thanks for checking in !',
                    body: 'Here a small gift for checking around! Give it to someone who is in need.',
                    claimCode: deviceLow.claimCode,
                    status: deviceLow.claimed,
                    createdOn: deviceLow.createdOn,
                    type: 'Weekly'
                  },
                  notification: {
                    title: 'Thanks for checking in !',
                    body: 'Here a small gift for checking around! Give it to someone who is in need.',
                    sound: 'default',
                    click_action: 'FCM_PLUGIN_ACTIVITY',
                    icon: 'fcm_push_icon'
                  }
                };
                this.pushNotifications._makeRequest(notification, (err, response) => {
                  if (err) logger.error('ERROR:' + err);
                  if (response) {
                    //                      logger.debug('Request status:  ' + response.statusCode);
                    //                      logger.debug('Request message: ' + response.statusMessage);
                    //                      logger.debug('Request body:  ' + response.request.body);
                  }
                  next();
                });
              },
              err => {
                return next(err);
              }
            );
          }
          if (newListDeviceMedium.length > 0) {
            async.each(
              newListDeviceMedium,
              (deviceMedium: any, next) => {
                const notification = {
                  to: deviceMedium.token,
                  priority: 'high',
                  restricted_package_name: deviceMedium.packageName,
                  data: {
                    title: 'Thanks for checking in !',
                    body: 'Here a small gift for checking around! Give it to someone who is in need.',
                    claimCode: deviceMedium.claimCode,
                    status: deviceMedium.claimed,
                    createdOn: deviceMedium.createdOn,
                    type: 'Weekly'
                  },
                  notification: {
                    title: '',
                    body: 'Here a small gift for checking around! Give it to someone who is in need.',
                    sound: 'default',
                    click_action: 'FCM_PLUGIN_ACTIVITY',
                    icon: 'fcm_push_icon'
                  }
                };
                this.pushNotifications._makeRequest(notification, (err, response) => {
                  if (err) logger.error('ERROR:' + err);
                  if (response) {
                    //                      logger.debug('Request status:  ' + response.statusCode);
                    //                      logger.debug('Request message: ' + response.statusMessage);
                    //                      logger.debug('Request body:  ' + response.request.body);
                  }
                  next();
                });
              },
              err => {
                return next(err);
              }
            );
          }
          if (newListDeviceHigh.length > 0) {
            async.each(
              newListDeviceHigh,
              (deviceHigh: any, next) => {
                const notification = {
                  to: deviceHigh.token,
                  priority: 'high',
                  restricted_package_name: deviceHigh.packageName,
                  data: {
                    title: 'Thanks for checking in !',
                    body: 'Here a small gift for checking around! Give it to someone who is in need.',
                    claimCode: deviceHigh.claimCode,
                    status: deviceHigh.claimed,
                    createdOn: deviceHigh.createdOn,
                    type: 'Weekly'
                  },
                  notification: {
                    title: '',
                    body: 'Here a small gift for checking around! Give it to someone who is in need.',
                    sound: 'default',
                    click_action: 'FCM_PLUGIN_ACTIVITY',
                    icon: 'fcm_push_icon'
                  }
                };
                this.pushNotifications._makeRequest(notification, (err, response) => {
                  if (err) logger.error('ERROR:' + err);
                  if (response) {
                    //                      logger.debug('Request status:  ' + response.statusCode);
                    //                      logger.debug('Request message: ' + response.statusMessage);
                    //                      logger.debug('Request body:  ' + response.request.body);
                  }
                  next();
                });
              },
              err => {
                return next(err);
              }
            );
          }
          return cb(null, `Create successfully appreciation WEEKLY with: ${countCreatedAppreciation} appreciation`);
        }
      ],
      err => {
        if (err) {
          logger.error('An error ocurred generating appreciation weekly:' + err);
        }
        return cb(err);
      }
    );
  }

  deleteLogDevice(deviceId, cb) {
    this.storage.deleteLogDevice(deviceId, (err, result) => {
      if (err) {
        return cb(err);
      }
      if (result) {
        if (result.deletedCount !== 0) {
          return cb(null, 'Delete Successful!!!');
        } else {
          return cb(null, 'No have deviceId in DB!!!');
        }
      }
    });
  }

  storeAppreciationWeekly(listAppreciationLow, listAppreciationMedium, listAppreciationHigh, cb) {
    let countCreatedAppreciation = 0;
    async.series(
      [
        next => {
          if (listAppreciationLow.length > 0) {
            this.storage.storeManyAppreciation(listAppreciationLow, (err, result) => {
              if (err) {
                return next(new Error('Create appreciation weekly LOW error!!!'));
              }
              if (result) {
                countCreatedAppreciation += result.insertedCount;
                return next();
              }
            });
          } else {
            next();
          }
        },
        next => {
          if (listAppreciationMedium.length > 0) {
            this.storage.storeManyAppreciation(listAppreciationMedium, (err, result) => {
              if (err) {
                return next(new Error('Create appreciation weekly MEDIUM error!!!'));
              }
              if (result) {
                countCreatedAppreciation += result.insertedCount;
                return next();
              }
            });
          } else {
            return next();
          }
        },
        next => {
          if (listAppreciationHigh.length > 0) {
            this.storage.storeManyAppreciation(listAppreciationHigh, (err, result) => {
              if (err) {
                return next(new Error('Create appreciation weekly HIGH error!!!'));
              }
              if (result) {
                countCreatedAppreciation += result.insertedCount;
                return next();
              }
            });
          } else {
            return next();
          }
        },
        next => {
          if (countCreatedAppreciation !== 0) {
            this.storage.resetCountNumberLogDevice((err, rs) => {
              if (err) return cb(err);
              if (rs) {
                return cb(null, countCreatedAppreciation);
              }
            });
          } else {
            return cb(null, 'Weekly appreciation is empty!!');
          }
        }
      ],
      err => {
        if (err) return cb(err);
      }
    );
  }

  pushNotificationAppreciationMonthly(token, packageName, appreciationInfo, cb) {
    let title = 'Welcome to AbcPay wallet !';
    let body = 'Thanks for using our app. Here our small appreciation to you to start using the app. Claim it now!';

    const notification = {
      to: token,
      priority: 'high',
      restricted_package_name: packageName,
      data: {
        title,
        body,
        claimCode: appreciationInfo.claimCode,
        status: appreciationInfo.status,
        createdOn: appreciationInfo.createdOn,
        type: appreciationInfo.type
      },
      notification: {
        title,
        body,
        sound: 'default',
        click_action: 'FCM_PLUGIN_ACTIVITY',
        icon: 'fcm_push_icon'
      }
    };
    this.pushNotifications._makeRequest(notification, (err, rs) => {
      if (err) return cb(err);
      if (rs) return cb(null, 'Push notification successfully!');
    });
  }

  readDataCvsMonthly(cb) {
    const csvFilePath = `${__dirname}/../../public/csv/appreciation_monthly_${moment().format('MMYY')}.csv`;

    csv()
      .fromFile(csvFilePath)
      .then(jsonObj => {
        return cb(null, jsonObj);
      })
      .catch(err => {
        return cb(err);
      });
  }

  readDataCvsWeekly(cb) {
    const csvFilePathLow = `${__dirname}/../../public/csv/appreciation_weekly_low_${moment().week()}.csv`;
    const csvFilePathMedium = `${__dirname}/../../public/csv/appreciation_weekly_medium_${moment().week()}.csv`;
    const csvFilePathHigh = `${__dirname}/../../public/csv/appreciation_weekly_high_${moment().week()}.csv`;

    let listClaimCode = [];

    async.series(
      [
        next => {
          csv()
            .fromFile(csvFilePathLow)
            .then(jsonArrayLow => {
              listClaimCode.push(jsonArrayLow);
              next();
            })
            .catch(err => {
              return next(err);
            });
        },
        next => {
          csv()
            .fromFile(csvFilePathMedium)
            .then(jsonArrayMedium => {
              listClaimCode.push(jsonArrayMedium);
              next();
            })
            .catch(err => {
              return next(err);
            });
        },
        next => {
          csv()
            .fromFile(csvFilePathHigh)
            .then(jsonArrayHigh => {
              listClaimCode.push(jsonArrayHigh);
              next();
            })
            .catch(err => {
              return next(err);
            });
        },
        next => {
          return cb(null, listClaimCode);
        }
      ],
      err => {
        if (err) return cb(err);
        if (!listClaimCode) return cb('List claim code weekly empty!');
        return cb(null, listClaimCode);
      }
    );
  }

  editLogDevice(deviceId, checkIn, cb) {
    let device;
    async.series(
      [
        next => {
          if (deviceId) {
            this.storage.getLogDeviceById(deviceId, (err, d) => {
              if (err) {
                return next(err);
              }
              device = d;
              next();
            });
          } else {
            next(new Error('No have deviceId'));
          }
        },
        next => {
          if (!device) {
            next(new Error('No have device to update'));
          } else {
            if (checkIn) {
              device.countNumber = checkIn;
            } else {
              next(new Error('No have checkIn to update'));
            }
          }
          next();
        },
        next => {
          this.storage.updateLogDevice(device, (err, result) => {
            if (err) return cb(err);
            if (result) {
              cb(null, result);
            }
          });
        }
      ],
      err => {
        if (err) {
          return cb(err);
        }
        if (!device) {
          return cb(new Error('Could not get current device for this deviceId'));
        }

        return cb(null, device);
      }
    );
  }

  /**
   * Subscribe this copayer to the Push Notifications service using the specified token.
   * @param {Object} opts
   * @param {string} opts.token - The token representing the app/device.
   * @param {string} [opts.packageName] - The restricted_package_name option associated with this token.
   * @param {string} [opts.platform] - The platform associated with this token.
   * @param {string} [opts.walletId] - The walletId associated with this token.
   */
  pushNotificationsSubscribe(opts, cb) {
    if (!checkRequired(opts, ['token'], cb)) return;
    const sub = PushNotificationSub.create({
      copayerId: this.copayerId,
      token: opts.token,
      packageName: opts.packageName,
      platform: opts.platform,
      walletId: opts.walletId
    });

    this.storage.storePushNotificationSub(sub, cb);
  }

  /**
   * Subscribe this copayer to the Push Notifications service using the specified token.
   * @param {Object} opts
   * @param {string} opts.externalUserId - The token representing the app/device. - Braze
   * @param {string} [opts.packageName] - The restricted_package_name option associated with this token.
   * @param {string} [opts.platform] - The platform associated with this token.
   * @param {string} [opts.walletId] - The walletId associated with this token.
   */
  pushNotificationsBrazeSubscribe(opts, cb) {
    if (!checkRequired(opts, ['externalUserId'], cb)) return;

    const sub = PushNotificationSub.create({
      copayerId: this.copayerId,
      externalUserId: opts.externalUserId,
      packageName: opts.packageName,
      platform: opts.platform,
      walletId: opts.walletId
    });

    this.storage.storePushNotificationBrazeSub(sub, cb);
  }

  /**
   * Unsubscribe this copayer to the Push Notifications service using the specified token.
   * @param {Object} opts
   * @param {string} opts.token - The token representing the app/device.
   */
  pushNotificationsUnsubscribe(opts, cb) {
    if (!checkRequired(opts, ['token'], cb)) return;

    this.storage.removePushNotificationSub(this.copayerId, opts.token, cb);
  }

  /**
   * Unsubscribe this copayer to the Push Notifications service using the specified token.
   * @param {Object} opts
   * @param {string} opts.externalUserId - The token representing the app/device. // Braze
   */
  pushNotificationsBrazeUnsubscribe(opts, cb) {
    if (!checkRequired(opts, ['externalUserId'], cb)) return;

    this.storage.removePushNotificationBrazeSub(this.copayerId, opts.externalUserId, cb);
  }

  /**
   * Subscribe this copayer to the specified tx to get a notification when the tx confirms.
   * @param {Object} opts
   * @param {string} opts.txid - The txid of the tx to be notified of.
   */
  txConfirmationSubscribe(opts, cb) {
    if (!checkRequired(opts, ['txid'], cb)) return;

    const sub = TxConfirmationSub.create({
      copayerId: this.copayerId,
      walletId: this.walletId,
      txid: opts.txid,
      amount: opts.amount,
      isCreator: true
    });

    this.storage.storeTxConfirmationSub(sub, cb);
  }

  /**
   * Unsubscribe this copayer to the Push Notifications service using the specified token.
   * @param {Object} opts
   * @param {string} opts.txid - The txid of the tx to be notified of.
   */
  txConfirmationUnsubscribe(opts, cb) {
    if (!checkRequired(opts, ['txid'], cb)) return;

    this.storage.removeTxConfirmationSub(this.copayerId, opts.txid, cb);
  }

  /**
   * Get External Services configuration based on the users location and their current version of the app
   * @param {Object} opts
   * @param {string} opts.currentAppVersion - (Optional) The version of the app from which the user is connected.
   * @param {string} opts.currentLocationCountry - (Optional) Country where the user is currently located.
   * @param {string} opts.currentLocationState - (Optional) State where the user is currently located.
   * @param {string} opts.bitpayIdLocationCountry - (Optional) Country registered as address of the user logged in with BitpayId.
   * @param {string} opts.bitpayIdLocationState - (Optional) State registered as address of the user logged in with BitpayId.
   * @param {Object} opts.platform - (Optional) Operating system and version of the user's device.
   */
  getServicesData(opts, cb) {
    const externalServicesConfig: ExternalServicesConfig = _.cloneDeep(config.services);

    const isLoggedIn = !!opts?.bitpayIdLocationCountry;

    // Swap crypto rules
    const swapUsaBannedStates = ['HI', 'LA', 'NY'];

    if (
      // Logged in with bitpayId
      (['US', 'USA'].includes(opts?.bitpayIdLocationCountry?.toUpperCase()) && swapUsaBannedStates.includes(opts?.bitpayIdLocationState?.toUpperCase())) ||
      // Logged out (IP restriction)
      (!isLoggedIn && ['US', 'USA'].includes(opts?.currentLocationCountry?.toUpperCase()) && swapUsaBannedStates.includes(opts?.currentLocationState?.toUpperCase()))
    ) {
      externalServicesConfig.swapCrypto = { ...externalServicesConfig.swapCrypto, ...{ disabled: true, disabledMessage: 'Swaps are currently unavailable in your area.' } };
    }

    if (opts?.platform?.os === 'ios' && opts?.currentAppVersion === '14.11.5') {
      externalServicesConfig.swapCrypto = { ...externalServicesConfig.swapCrypto, ...{ disabled: true, disabledTitle: 'Unavailable', disabledMessage: 'Swaps are currently unavailable in your area.' } };
    }

    // Buy crypto rules
    const buyCryptoUsaBannedStates = ['NY'];
    if (
      // Logged in with bitpayId
      (['US', 'USA'].includes(opts?.bitpayIdLocationCountry?.toUpperCase()) && buyCryptoUsaBannedStates.includes(opts?.bitpayIdLocationState?.toUpperCase())) ||
      // Logged out (IP restriction)
      (!isLoggedIn && ['US', 'USA'].includes(opts?.currentLocationCountry?.toUpperCase()) && buyCryptoUsaBannedStates.includes(opts?.currentLocationState?.toUpperCase()))
    ) {
      externalServicesConfig.buyCrypto = { ...externalServicesConfig.buyCrypto, ...{ disabled: true, disabledTitle: 'Unavailable', disabledMessage: 'This service is currently unavailable in your area.' } };
    }

    // Sell crypto rules
    const sellCryptoUsaBannedStates = ['NY'];
    if (
      // Logged in with bitpayId
      (['US', 'USA'].includes(opts?.bitpayIdLocationCountry?.toUpperCase()) && sellCryptoUsaBannedStates.includes(opts?.bitpayIdLocationState?.toUpperCase())) ||
      // Logged out (IP restriction)
      (!isLoggedIn && ['US', 'USA'].includes(opts?.currentLocationCountry?.toUpperCase()) && sellCryptoUsaBannedStates.includes(opts?.currentLocationState?.toUpperCase()))
    ) {
      externalServicesConfig.sellCrypto = { ...externalServicesConfig.sellCrypto, ...{ disabled: true, disabledTitle: 'Unavailable', disabledMessage: 'This service is currently unavailable in your area.' } };
    }

    return cb(null, externalServicesConfig);
  }

  checkServiceAvailability(req): boolean {
    if (!checkRequired(req.body, ['service', 'opts'])) {
      throw new ClientError('checkServiceAvailability request missing arguments');
    }

    let serviceEnabled: boolean;

    switch (req.body.service) {
      case '1inch':
        if (req.body.opts?.country?.toUpperCase() === 'US') {
          serviceEnabled = false;
        } else {
          serviceEnabled = true;
        }
        break;

      default:
        serviceEnabled = true;
        break;
    }

    return serviceEnabled;
  }

  getSpenderApprovalWhitelist(cb) {
    if (Services.ERC20_SPENDER_APPROVAL_WHITELIST) {
      return cb(null, Services.ERC20_SPENDER_APPROVAL_WHITELIST);
    } else {
      return cb(new Error('Could not get ERC20 spender approval whitelist'));
    }
  }

  /**
   * Clear wallet cache
   * @param {Object} opts
   * @param {String} opts.tokenAddress (optional) - Token address
   * @returns {Boolean}
   */
  clearWalletCache(opts): Promise<boolean> {
    return new Promise(resolve => {
      const cacheKey = this.walletId + (opts.tokenAddress ? '-' + opts.tokenAddress : '');
      this.storage.clearWalletCache(cacheKey, () => {
        resolve(true);
      });
    });
  }

  static upgradeNeeded(
    paths: Upgrade | Upgrade[],
    opts: UpgradeCheckOpts & { clientVersion: string; userAgent: string }
  ) {
    paths = Array.isArray(paths) ? paths : [paths];
    const chain = opts.chain?.toLowerCase();
    const v = Utils.parseVersion(opts.clientVersion);

    let result: boolean | string = false;
    for (const path of paths) {
      switch (path) {
        case UPGRADES.SOL_bwc_$lt_10_10_12:
          result = (
            chain === 'sol' &&
            v?.agent === 'bwc' &&
            (
              v?.major < 10 ||
              (v?.major == 10 && v?.minor < 10) ||
              (v?.major == 10 && v?.minor == 10 && v?.patch < 12)
            )
          );
          break;
        case UPGRADES.BCH_bwc_$lt_8_3_multisig:
          result = (
            opts.n > 1 &&
            chain === 'bch' &&
            v?.agent === 'bwc' &&
            (
              v?.major < 8 ||
              (v.major == 8 && v?.minor < 3)
            )
          )
            ? 'BWC clients < 8.3 are no longer supported for multisig BCH wallets.'
            : false;
          break;
        case UPGRADES.bwc_$lt_8_4_multisig_purpose48:
          result = (
            opts.n > 1 &&
            opts.usePurpose48 &&
            v?.agent === 'bwc' &&
            (v?.major < 8 || (v.major == 8 && v?.minor < 4))
          );
          break;
        case UPGRADES.bwc_$lt_8_17_multisig_p2wsh:
          result = (
            opts.n > 1 &&
            opts.addressType?.toLowerCase() === 'p2wsh' &&
            v?.agent === 'bwc' &&
            (v?.major < 8 || (v.major == 8 && v?.minor < 17))
          );
          break;
        case UPGRADES.version_$gt_maxTxpVersion:
          result = parseInt(opts.version as string) > parseInt(opts.maxTxpVersion as string);
          break;
        case UPGRADES.BCH_schnorr:
          result = (opts.signingMethod === 'schnorr' && !opts.supportBchSchnorr);
          break;
        case UPGRADES.bwc_$lt_1_2:
          result = (
            v?.agent === 'bwc' &&
            (v?.major == 0 || (v?.major == 1 && v?.minor < 2))
          )
            ? 'BWC clients < 1.2 are no longer supported.'
            : false;
          break;
        default:
          throw new Error('Unknown upgrade path');
      }
      if (result) {
        logger.warn(`Upgrade needed: ${path} | ${opts.clientVersion} | ${opts.userAgent}`);
        break; // Stop checking other upgrade paths
      }
    }
    // No upgrade needed
    return result;
  }

  _upgradeNeeded(
    paths: Upgrade | Upgrade[],
    opts?: UpgradeCheckOpts
  ) {
    opts = opts || {};
    const _opts = {
      ...opts,
      clientVersion: this.clientVersion,
      userAgent: this.userAgent
    };
    return WalletService.upgradeNeeded(paths, _opts);
  }

  // ---- AbcPay (BCPRO): Telegram address watch over Chronik ----

  addAddressToUser(msgId, address) {
    this.storage.fetchAllAddressByMsgId(msgId, (err, listAddress) => {
      if (!err) {
        let listAddressToSubcribe = [];
        if (listAddress && listAddress.length > 0) {
          // handle case address is already in db , does not need to add any more
          if (listAddress.includes(address)) {
            botNotification.sendMessage(msgId, 'Address has already registered!');
          } else {
            this._storeUserWatchAddress(msgId, address);
          }
        } else {
          this._storeUserWatchAddress(msgId, address);
        }
      } else {
        botNotification.sendMessage(msgId, 'Error while fetching your address. Please try again!');
      }
    });
  }

  _storeUserWatchAddress(msgId, address) {
    const user = {
      msgId,
      address
    };
    this.storage.storeUserWatchAddress(user, (err, result) => {
      if (!err) {
        botNotification.sendMessage(msgId, '[ ' + address.substr(address.length - 8) + ' ] is registered!');
        this.handleSubcribeNewAddress(msgId, address);
      }
    });
  }

  handleSubcribeNewAddress(msgId, address) {
    const scriptPayload = ChainService.convertAddressToScriptPayload('xec', address.replace(/ecash:/, ''));
    if (!!ws) {
      ws.subscribe('p2pkh', scriptPayload);
    }
  }

  async startBotNotificationForUser() {
    const chronikClient = ChainService.getChronikClient('xec');
    ws = chronikClient.ws({
      onMessage: msg => {
        if (msg.type === 'Tx' && !txIdHandled.includes(msg.txid) && msg.msgType === 'TX_ADDED_TO_MEMPOOL') {
          txIdHandled.push(msg.txid);
          this.getTxDetailForXecWallet(msg.txid, (err, result: TxDetail) => {
            if (err) {
              logger.debug('error while getting txdetail', err);
            } else {
              if (result) {
                let outputsConverted = _.uniq(
                  _.map(result.outputs, item => {
                    return this._convertOutputScript('xec', item);
                  })
                );
                outputsConverted = _.compact(outputsConverted);
                let addressSelected = null;
                let outputSelected = null;
                // get output contains look up address
                if (result.slpTxData) {
                  // etokenCase
                  outputSelected = outputsConverted.find(
                    output => !result.inputAddresses.includes(output.address) && output.address.includes('etoken:')
                  );
                  if (outputSelected)
                    addressSelected = this._convertEtokenAddressToEcashAddress(outputSelected.address);
                } else {
                  // ecash case
                  outputSelected = outputsConverted.find(
                    output => !result.inputAddresses.includes(output.address) && output.address.includes('ecash:')
                  );
                  if (outputSelected) addressSelected = outputSelected.address;
                }
                if (outputsConverted) {
                  // hard code specific case to notify to channel
                  if (['ecash:qz7r06eys9aggs4j8t56qmxyqhy0mu08cspyq02pq4'].includes(addressSelected)) {
                    if (result.slpTxData) {
                      // etoken case
                      const tokenInfo = this._getAndStoreTokenInfo('xec', result.slpTxData.slpMeta.tokenId);
                      tokenInfo.then((tokenInfoReturn: TokenInfo) => {
                        // hard code specific case to notify to channel
                        botNotification.sendMessage(
                          '@bcProTX',
                          '[ ' +
                          addressSelected.substr(addressSelected.length - 8) +
                          ' ] has received a payment of ' +
                          (outputSelected.amount / 10 ** tokenInfoReturn.decimals).toLocaleString('en-US') +
                          ' ' +
                          tokenInfoReturn.symbol +
                          ' from ' +
                          result.inputAddresses.find(input => input.indexOf('etoken') === 0) +
                          '\n\n' +
                          this._addExplorerLinkIntoTxIdWithCoin(result.txid, 'xec', 'View tx on the Explorer'),
                          { parse_mode: 'HTML' }
                        );
                      });
                    } else {
                      // ecash case
                      botNotification.sendMessage(
                        '@bcProTX',
                        '[ ' +
                        addressSelected.substr(addressSelected.length - 8) +
                        ' ] has received a payment of ' +
                        (outputSelected.amount / 100).toLocaleString('en-US') +
                        ' XEC from ' +
                        result.inputAddresses.find(input => input.indexOf('ecash') === 0) +
                        '\n\n' +
                        this._addExplorerLinkIntoTxIdWithCoin(result.txid, 'xec', 'View tx on the Explorer'),
                        { parse_mode: 'HTML' }
                      );
                    }
                  }
                  // fetch all msgId by address (  )
                  this.storage.fetchAllMsgIdByAddress(addressSelected, (err, listMsgId) => {
                    if (!err) {
                      if (!!listMsgId && listMsgId.length > 0) {
                        // if found user watch this address => send message to all user
                        listMsgId.forEach(msgId => {
                          if (result.slpTxData) {
                            // etoken case
                            const tokenInfo = this._getAndStoreTokenInfo('xec', result.slpTxData.slpMeta.tokenId);
                            tokenInfo.then((tokenInfoReturn: TokenInfo) => {
                              botNotification.sendMessage(
                                msgId,
                                '[ ' +
                                addressSelected.substr(addressSelected.length - 8) +
                                ' ] has received a payment of ' +
                                (outputSelected.amount / 10 ** tokenInfoReturn.decimals).toLocaleString('en-US') +
                                ' ' +
                                tokenInfoReturn.symbol +
                                ' from ' +
                                result.inputAddresses.find(input => input.indexOf('etoken') === 0) +
                                '\n\n' +
                                this._addExplorerLinkIntoTxIdWithCoin(result.txid, 'xec', 'View tx on the Explorer'),
                                { parse_mode: 'HTML' }
                              );
                            });
                          } else {
                            // ecash case
                            botNotification.sendMessage(
                              msgId,
                              '[ ' +
                              addressSelected.substr(addressSelected.length - 8) +
                              ' ] has received a payment of ' +
                              (outputSelected.amount / 100).toLocaleString('en-US') +
                              'XEC from ' +
                              result.inputAddresses.find(input => input.indexOf('ecash') === 0) +
                              '\n\n' +
                              this._addExplorerLinkIntoTxIdWithCoin(result.txid, 'xec', 'View tx on the Explorer'),
                              { parse_mode: 'HTML' }
                            );
                          }
                        });
                      } else {
                        if (!!addressSelected) {
                          const scriptPayload = ChainService.convertAddressToScriptPayload(
                            'xec',
                            addressSelected.replace(/ecash:/, '')
                          );
                          ws.unsubscribe('p2pkh', scriptPayload);
                        }
                      }
                    }
                  });
                }
              }
            }
          });
        }
      },
      onReconnect: e => { },
      onConnect: e => { },
      onError: e => { }
    });
    await ws.waitForOpen();
    this.storage.fetchAllAddressInUserWatchAddress((err, listAddress) => {
      if (!err) {
        if (listAddress && listAddress.length > 0) {
          listAddress.forEach(address => {
            const scriptPayload = ChainService.convertAddressToScriptPayload('xec', address.replace(/ecash:/, ''));
            ws.subscribe('p2pkh', scriptPayload);
          });
        }
      }
    });
  }

}

export function checkRequired(obj, args, cb?: (e: any) => void) {
  const missing = Utils.getMissingFields(obj, args);
  if (_.isEmpty(missing)) {
    return true;
  }

  if (_.isFunction(cb)) {
    return cb(new ClientError('Required argument: ' + _.first(missing) + ' missing.'));
  }

  return false;
}

export const UPGRADES = {
  SOL_bwc_$lt_10_10_12: 'SOL:bwc<10.10.12',
  BCH_bwc_$lt_8_3_multisig: 'BCH:bwc<8.3:multisig',
  bwc_$lt_8_4_multisig_purpose48: 'bwc<8.4:multisig:purpose48',
  bwc_$lt_8_17_multisig_p2wsh: 'bwc<8.17:multisig:p2wsh',
  version_$gt_maxTxpVersion: 'version>maxTxpVersion',
  BCH_schnorr: 'BCH:schnorr',
  bwc_$lt_1_2: 'bwc<1.2',
} as const;

type Upgrade = typeof UPGRADES[keyof typeof UPGRADES];

export interface JoinWalletOpts {
  /** The wallet id. */
  walletId: string;
  /** The expected coin for this wallet (btc, bch, eth, doge, ltc). Default: btc */
  coin?: string;
  /** The expected chain for this wallet (btc, bch, eth, doge, ltc). Default: btc */
  chain?: string;
  /** The copayer name. */
  name: string;
  /** Extended Public Key for this copayer */
  xPubKey: string;
  /** Public key from a hardware device for this copayer */
  hardwareSourcePublicKey?: string;
  /** Public key from the client for this wallet */
  clientDerivedPublicKey?: string;
  /** Public Key used to check requests from this copayer. */
  requestPubKey: string;
  /** Signature proving knowledge of the wallet secret for this copayer. */
  copayerSignature: string;
  /** Custom data for this copayer. */
  customData?: string;
  /** Simulate the action but do not change server state. */
  dryRun?: boolean;
  /** The chain used for TSS key generation. */
  tssKeygenChain?: string;
};