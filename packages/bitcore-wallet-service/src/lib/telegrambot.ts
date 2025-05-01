import { Telegraf, Context } from 'telegraf';
import * as _ from 'lodash';
import logger from './logger';
import config from '../config';
import { ChainService } from './chain/index';
import { TokenInfo } from './model/tokenInfo';
import { TxDetail } from './model/conversionOrder';

const ecashaddr = require('ecashaddrjs');
/**
 * TelegramBotService class to handle all Telegram bot functionality
 */
export class TelegramBotService {
  private bot: Telegraf;
  private botNotification: Telegraf;
  private botSwap: Telegraf;
  private storage: any;
  private txIdHandled: string[] = [];

  /**
   * Constructor for TelegramBotService
   * @param {Object} opts - Options for the service
   * @param {Object} opts.storage - Storage instance
   */
  constructor(opts: { storage: any }) {
    this.storage = opts.storage;
  }

  /**
   * Initialize all Telegram bots
   */
  initialize() {
    try {
      // Initialize main bot
      if (config.telegram && config.telegram.token) {
        this.bot = new Telegraf(config.telegram.token);
        this.bot.launch();
        logger.info('Telegram bot initialized');
      }

      // Initialize notification bot
      if (config.telegramNotification && config.telegramNotification.token) {
        this.botNotification = new Telegraf(config.telegramNotification.token);
        // Set up notification bot commands
        this.setupNotificationBotCommands();
        this.startBotNotificationForUser();
        this.botNotification.launch();
        logger.info('Telegram notification bot initialized');
      }

      // Initialize swap bot
      if (config.swapTelegram && config.swapTelegram.token) {
        this.botSwap = new Telegraf(config.swapTelegram.token);
        this.botSwap.launch();
        logger.info('Telegram swap bot initialized');
      }
    } catch (error) {
      logger.error('Error initializing Telegram bots:', error);
    }
  }

  /**
   * Set up commands for the notification bot
   */
  private setupNotificationBotCommands() {
    if (!this.botNotification) return;

    this.botNotification.command('start', (ctx) => {
      ctx.reply('Welcome to Chronik watcher, please use /help to display general and other commands.');
    });

    this.botNotification.command('list', (ctx) => {
      this.storage.fetchAllAddressByMsgId(ctx.chat.id, (err: any, listAddress: string[]) => {
        if (!err) {
          if (listAddress && listAddress.length > 0) {
            let count = 0;
            let message = '';
            listAddress.forEach(address => {
              count++;
              message += count + '. ' + address + '\n';
            });
            ctx.reply(message, { parse_mode: 'HTML' });
          } else {
            ctx.reply('Your addresses are empty. Please add new address by using command /add [ecash address]!');
          }
        } else {
          ctx.reply('Errors occurred on Chronik watcher, please try again.');
        }
      });
    });

    this.botNotification.command('help', (ctx) => {
      ctx.reply(
        'Available commands:\n' +
        '/watch <address> - Watch an address for transactions\n' +
        '/list - List all addresses you are watching\n' +
        '/remove <address> - Stop watching an address'
      );
    });

    this.botNotification.hears(/^\/add\secash:\w+/, (ctx) => {
      const address = ctx.message.text.replace(/\/add\s/, '');
      if (this._checkingValidAddress(address)) {
        this.addAddressToUser(ctx.chat.id, address);
      } else {
        ctx.reply('Invalid address format, please check and try again!');
      }
    });

    this.botNotification.hears(/^\/remove\secash:\w+/, (ctx) => {
      this.storage.fetchAllAddressByMsgId(ctx.chat.id, (err: any, listAddress: string[]) => {
        if (!err) {
          if (listAddress && listAddress.length > 0) {
            const address = ctx.message.text.replace(/\/remove\s/, '');
            if (this._checkingValidAddress(address)) {
              this.storage.removeUserWatchAddress({ msgId: ctx.chat.id, address }, (err: any) => {
                if (!err) {
                  ctx.reply(`[ ${address.slice(-8)} ] has been removed!`);
                } else {
                  ctx.reply('Error while remove. Please try again!');
                }
              });
            } else {
              ctx.reply('Invalid address format, please check and try again!');
            }
          } else {
            ctx.reply('Your list address has been empty');
          }
        } else {
          ctx.reply('Error while fetching your address. Please try again!');
        }
      });
    });
  }

  /**
   * Start the notification service for users
   */
  startBotNotificationForUser() {
    const chronikClient = ChainService.getChronikClient('xec');
    let ws = chronikClient.ws({
      onMessage: msg => {
        if (msg.type === 'Tx' && !this.txIdHandled.includes(msg.txid) && msg.msgType === 'TX_ADDED_TO_MEMPOOL') {
          this.txIdHandled.push(msg.txid);
          this.handleNewTransaction(msg.txid, ws);
        }
      },
      onReconnect: () => { },
      onConnect: () => { },
      onError: () => { }
    });
  }

  /**
   * Handle a new transaction
   * @param {string} txid - Transaction ID
   * @param {any} ws - WebSocket instance
   */
  private handleNewTransaction(txid: string, ws: any) {
    this.getTxDetailForXecWallet(txid, (err, result: TxDetail) => {
      if (err) {
        logger.debug('error while getting txdetail', err);
      } else if (result) {
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
                this.botNotification.telegram.sendMessage(
                  '@bcProTX',
                  '[ ' +
                  addressSelected.slice(-8) +
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
              this.botNotification.telegram.sendMessage(
                '@bcProTX',
                '[ ' +
                addressSelected.slice(-8) +
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
          this.storage.fetchAllMsgIdByAddress(addressSelected, (err: any, listMsgId: any[]) => {
            if (!err) {
              if (!!listMsgId && listMsgId.length > 0) {
                // if found user watch this address => send message to all user
                listMsgId.forEach(msgId => {
                  if (result.slpTxData) {
                    // etoken case
                    const tokenInfo = this._getAndStoreTokenInfo('xec', result.slpTxData.slpMeta.tokenId);
                    tokenInfo.then((tokenInfoReturn: TokenInfo) => {
                      this.botNotification.telegram.sendMessage(
                        msgId,
                        '[ ' +
                        addressSelected.slice(-8) +
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
                    this.botNotification.telegram.sendMessage(
                      msgId,
                      '[ ' +
                      addressSelected.slice(-8) +
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
    });
  }

  /**
   * Add an address to a user's watch list
   * @param {string|number} msgId - Message ID or chat ID
   * @param {string} address - Address to watch
   */
  addAddressToUser(msgId: string | number, address: string) {
    this.storage.fetchAllAddressByMsgId(msgId, (err: any, listAddress: string[]) => {
      if (!err) {
        if (listAddress && listAddress.length > 0) {
          // handle case address is already in db, does not need to add any more
          if (listAddress.includes(address)) {
            this.sendNotification(msgId, 'Address has already registered!');
          } else {
            this._storeUserWatchAddress(msgId, address);
          }
        } else {
          this._storeUserWatchAddress(msgId, address);
        }
      } else {
        this.sendNotification(msgId, 'Error while fetching your address. Please try again!');
      }
    });
  }

  /**
   * Store a user's watch address
   * @param {string|number} msgId - Message ID or chat ID
   * @param {string} address - Address to watch
   */
  private _storeUserWatchAddress(msgId: string | number, address: string) {
    const user = {
      msgId,
      address
    };
    this.storage.storeUserWatchAddress(user, (err: any) => {
      if (!err) {
        this.sendNotification(msgId, `[ ${address.slice(-8)} ] is registered!`);
        this.handleSubcribeNewAddress(msgId, address);
      }
    });
  }

  /**
   * Subscribe to a new address
   * @param {string|number} msgId - Message ID or chat ID
   * @param {string} address - Address to subscribe to
   */
  private handleSubcribeNewAddress(msgId: string | number, address: string) {
    const scriptPayload = ChainService.convertAddressToScriptPayload('xec', address.replace(/ecash:/, ''));
    // Implementation for subscribing to the address would go here
  }

  /**
   * Get transaction details for XEC wallet
   * @param {string} txid - Transaction ID
   * @param {Function} callback - Callback function
   */
  private getTxDetailForXecWallet(txid: string, callback: (err: any, result?: any) => void) {
    // Implementation of getTxDetailForXecWallet from server.ts
    callback(null, null);
  }

  /**
   * Convert output script to address
   * @param {string} coin - Coin type
   * @param {any} output - Output to convert
   * @returns {any} Converted output
   */
  private _convertOutputScript(coin: string, output: any): any {
    // Implementation of _convertOutputScript from server.ts
    return null;
  }

  /**
   * Convert etoken address to ecash address
   * @param {string} address - Etoken address
   * @returns {string} Ecash address
   */
  private _convertEtokenAddressToEcashAddress(address: string): string {
    // Implementation of _convertEtokenAddressToEcashAddress from server.ts
    return '';
  }

  /**
   * Get and store token info
   * @param {string} coin - Coin type
   * @param {string} tokenId - Token ID
   * @returns {Promise<TokenInfo>} Token info
   */
  private _getAndStoreTokenInfo(coin: string, tokenId: string): Promise<TokenInfo> {
    // Implementation of _getAndStoreTokenInfo from server.ts
    return Promise.resolve({} as TokenInfo);
  }

  /**
   * Add explorer link to transaction ID
   * @param {string} txid - Transaction ID
   * @param {string} coin - Coin type
   * @param {string} text - Text to display
   * @returns {string} HTML link
   */
  private _addExplorerLinkIntoTxIdWithCoin(txid: string, coin: string, text: string): string {
    // Implementation of _addExplorerLinkIntoTxIdWithCoin from server.ts
    return '';
  }

  /**
   * Send a message using the main bot
   * @param {string|number} chatId - Chat ID
   * @param {string} message - Message to send
   * @param {any} options - Options for the message
   */
  sendMessage(chatId: string | number, message: string, options?: any) {
    if (this.bot) {
      this.bot.telegram.sendMessage(chatId, message, options).catch(err => {
        logger.error('Error sending message with main bot:', err);
      });
    }
  }

  /**
   * Check if the address is valid
   * @param {string} address - Address to check
   * @returns {boolean}
   */
  _checkingValidAddress(address: string): boolean {
    try {
      const { prefix } = ecashaddr.decode(address);
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
   * Send a notification using the notification bot
   * @param {string|number} chatId - Chat ID
   * @param {string} message - Message to send
   * @param {any} options - Options for the message
   */
  sendNotification(chatId: string | number, message: string, options?: any) {
    if (this.botNotification) {
      this.botNotification.telegram.sendMessage(chatId, message, options).catch(err => {
        logger.error('Error sending message with notification bot:', err);
      });
    }
  }

  /**
   * Send a swap notification using the swap bot
   * @param {string|number} chatId - Chat ID
   * @param {string} message - Message to send
   * @param {any} options - Options for the message
   */
  sendSwapNotification(chatId: string | number, message: string, options?: any) {
    if (this.botSwap) {
      this.botSwap.telegram.sendMessage(chatId, message, options).catch(err => {
        logger.error('Error sending message with swap bot:', err);
      });
    }
  }

  /**
   * Get the main bot instance
   * @returns {Telegraf} Main bot instance
   */
  getBot(): Telegraf {
    return this.bot;
  }

  /**
   * Get the notification bot instance
   * @returns {Telegraf} Notification bot instance
   */
  getNotificationBot(): Telegraf {
    return this.botNotification;
  }

  /**
   * Get the swap bot instance
   * @returns {Telegraf} Swap bot instance
   */
  getSwapBot(): Telegraf {
    return this.botSwap;
  }
}
