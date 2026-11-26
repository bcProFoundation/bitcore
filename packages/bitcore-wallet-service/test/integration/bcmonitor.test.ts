'use strict';

import * as chai from 'chai';
import sinon from 'sinon';
import util from 'util';
import * as CWC from '@bcpros/crypto-wallet-core';
import { BlockchainMonitor } from '../../src/lib/blockchainmonitor';
import { ChainService } from '../../src/lib/chain';
import { Constants } from '../../src/lib/common/constants';
import helpers from './helpers';
import type { Storage } from '../../src/lib/storage';
import type { V8 } from '../../src/lib/blockchainexplorers/v8';
import type { WalletService } from '../../src/lib/server';
import type { Wallet } from '../../src/lib/model';

const should = chai.should();


describe('Blockchain monitor', function() {
  this.timeout(Math.max(this['_timeout'] || 0, 5000));
  let server: WalletService;
  let wallet: Wallet;
  let storage: Storage;
  let blockchainExplorer: V8;
  let blockchainExplorerEVM: V8;
  let bcmonitor: BlockchainMonitor;

  const socket = {
    handlers: {},
    on: (name, handler) => {}
  };
  socket.on = function(eventName, handler) {
    this.handlers[eventName] = handler;
  };

  before(async function() {
    const res = await helpers.before();
    storage = res.storage;
    blockchainExplorer = res.blockchainExplorer;
    blockchainExplorerEVM = helpers.mockBlockchainExplorer();

    blockchainExplorer.initSocket = function(callbacks) {
      socket.handlers['coin'] = function(data) {
        callbacks.onIncomingPayments(data);
      };
      socket.handlers['block'] = callbacks.onBlock;
    };

    blockchainExplorerEVM.initSocket = function(callbacks) {
      socket.handlers['tx'] = function(data) {
        // copied from v8.tx
        const tx = data.tx;
        // script output, or similar.
        if (!tx || !Constants.EVM_CHAINS[tx.chain]) return;
        let tokenAddress;
        let address;
        let amount;

        if (tx.abiType && tx.abiType.type === 'ERC20') {
          tokenAddress = tx.to;
          address = tx.abiType.params[0].value; // EVM only, not used in this fork
          amount = tx.abiType.params[1].value;
        } else {
          address = tx.to;
          amount = tx.value;
        }
        const out = {
          address,
          amount,
          tokenAddress
        };
        return callbacks.onIncomingPayments({ out, txid: tx.txid });
      };
      // no uses in eth, interferes with btc
      // socket.handlers['block'] =  callbacks.onBlock;
    };
  });
  after(async function() {
    await helpers.after();
  });
  beforeEach(async function() {
    const collections = {
      WALLETS: 'wallets',
      TXS: 'txs',
      ADDRESSES: 'addresses',
      NOTIFICATIONS: 'notifications',
      COPAYERS_LOOKUP: 'copayers_lookup',
      PREFERENCES: 'preferences',
      EMAIL_QUEUE: 'email_queue',
      CACHE: 'cache',
      FIAT_RATES: 'fiat_rates',
      TX_NOTES: 'tx_notes',
      SESSIONS: 'sessions',
      PUSH_NOTIFICATION_SUBS: 'push_notification_subs',
      TX_CONFIRMATION_SUBS: 'tx_confirmation_subs',
      LOCKS: 'locks'
    };

    for (const x of Object.values(collections)) {
      await storage.db.collection(x).deleteMany({});
    }
    
    ({ wallet, server } = await helpers.createAndJoinWallet(2, 3));
    bcmonitor = new BlockchainMonitor();
    await util.promisify(bcmonitor.start).call(bcmonitor, {
      lockOpts: {},
      messageBroker: server.messageBroker,
      storage: storage,
      blockchainExplorers: {
        btc: {
          livenet: blockchainExplorer
        },
        eth: {
          livenet: blockchainExplorerEVM
        },
        matic: {
          livenet: blockchainExplorerEVM
        }
      }
    });
  });

  it('should notify copayers of incoming txs', function(done) {
    server.createAddress({}, function(err, address) {
      should.not.exist(err);

      const incoming = {
        txid: '123',
        out: { address: address.address, amount: 1500 }
      };
      socket.handlers['coin'](incoming);

      setTimeout(function() {
        server.getNotifications({}, function(err, notifications) {
          should.not.exist(err);
          const notification = notifications.find(n => n.type === 'NewIncomingTx');
          should.exist(notification);
          notification.walletId.should.equal(wallet.id);
          notification.data.txid.should.equal('123');
          notification.data.address.should.equal(address.address);
          notification.data.amount.should.equal(1500);
          done();
        });
      }, 100);
    });
  });


  it('should not notify copayers of incoming txs btc, amount =0', function(done) {
    server.createAddress({}, function(err, address) {
      should.not.exist(err);

      const incoming = {
        txid: '123',
        out: { address: address.address, amount: 0 }
      };
      socket.handlers['coin'](incoming);

      setTimeout(function() {
        server.getNotifications({}, function(err, notifications) {
          should.not.exist(err);
          const notification = notifications.find(n => n.type === 'NewIncomingTx');
          should.not.exist(notification);
          done();
        });
      }, 100);
    });
  });



  it('should not notify copayers of incoming txs more than once', function(done) {
    server.createAddress({}, function(err, address) {
      should.not.exist(err);

      const incoming = {
        txid: '123',
        out: { address: address.address, amount: 15000 }
      };
      socket.handlers['coin'](incoming);
      setTimeout(function() {
        socket.handlers['coin'](incoming);

        setTimeout(function() {
          server.getNotifications({}, function(err, notifications) {
            should.not.exist(err);
            const notification = notifications.filter(n => n.type === 'NewIncomingTx');
            notification[0].data.amount.should.equal(15000);
            notification.length.should.equal(1);
            done();
          });
        }, 100);
      }, 200);
    });
  });



  it('should parse v8 amount ', function(done) {
    server.createAddress({}, function(err, address) {
      should.not.exist(err);

      const incoming = {
        txid: '123',
        out: { address: address.address, amount: 1500 }
      };
      socket.handlers['coin'](incoming);
      setTimeout(function() {
        server.getNotifications({}, function(err, notifications) {
          should.not.exist(err);
          const notification = notifications.find(n => n.type === 'NewIncomingTx');
          notification.data.amount.should.equal(1500);
          done();
        });
      }, 100);
    });
  });



  it('should notify copayers of tx confirmation', function(done) {
    server.createAddress({}, function(err, address) {
      should.not.exist(err);
      server.txConfirmationSubscribe(
        {
          txid: '123'
        },
        function(err) {
          should.not.exist(err);

          blockchainExplorer.getTxidsInBlock = sinon.stub().callsArgWith(1, null, ['123', '456']);
          socket.handlers['block']('block1');

          setTimeout(function() {
            blockchainExplorer.getTxidsInBlock = sinon.stub().callsArgWith(1, null, ['123', '456']);
            socket.handlers['block']('block2');

            setTimeout(function() {
              server.getNotifications({}, function(err, notifications) {
                should.not.exist(err);
                notifications = notifications.filter(n => n.type === 'TxConfirmation');
                notifications.length.should.equal(1);
                const n = notifications[0];
                n.walletId.should.equal(wallet.id);
                n.creatorId.should.equal(server.copayerId);
                n.data.txid.should.equal('123');
                done();
              });
            }, 50);
          }, 50);
        }
      );
    });
  });

  describe('Block Notify Throttling', function() {
    it('should throttle _notifyNewBlock if setting requires', function(done) {
      const notifyNewBlockSpy = sinon.spy(bcmonitor, '_notifyNewBlock');
      bcmonitor.blockThrottleSettings = { btc: { livenet: 2 } } as any;

      blockchainExplorer.getTxidsInBlock = sinon.stub().callsArgWith(1, null, ['123', '456']);
      socket.handlers['block']('block1');
      setTimeout(function() {
        // it always calls _notifyNewBlock the first time
        notifyNewBlockSpy.calledOnce.should.be.true;
        socket.handlers['block']('block2');
        socket.handlers['block']('block3');
        socket.handlers['block']('block4');
        setTimeout(function() {
          notifyNewBlockSpy.calledTwice.should.be.false;
          socket.handlers['block']('block5');
          setTimeout(function() {
            notifyNewBlockSpy.calledTwice.should.be.true;
            done();
          }, 100);
        }, 2000);
      }, 100);
    });

    it('should not throttle _notifyNewBlock if setting doesn"t exist', function(done) {
      const notifyNewBlockSpy = sinon.spy(bcmonitor, '_notifyNewBlock');
      bcmonitor.blockThrottleSettings = { btc: {} } as any;

      blockchainExplorer.getTxidsInBlock = sinon.stub().callsArgWith(1, null, ['123', '456']);
      socket.handlers['block']('block1');
      setTimeout(function() {
        // it always calls _notifyNewBlock the first time
        notifyNewBlockSpy.calledOnce.should.be.true;
        socket.handlers['block']('block2');
        setTimeout(function() {
          notifyNewBlockSpy.calledTwice.should.be.true;
          socket.handlers['block']('block3');
          setTimeout(function() {
            notifyNewBlockSpy.calledThrice.should.be.true;
            done();
          }, 100);
        }, 100);
      }, 100);
    });

    it('should not throttle _notifyNewBlock if setting is zero', function(done) {
      const notifyNewBlockSpy = sinon.spy(bcmonitor, '_notifyNewBlock');
      bcmonitor.blockThrottleSettings = { btc: { livenet: 0 } } as any;

      blockchainExplorer.getTxidsInBlock = sinon.stub().callsArgWith(1, null, ['123', '456']);
      socket.handlers['block']('block1');
      setTimeout(function() {
        // it always calls _notifyNewBlock the first time
        notifyNewBlockSpy.calledOnce.should.be.true;
        socket.handlers['block']('block2');
        setTimeout(function() {
          notifyNewBlockSpy.calledTwice.should.be.true;
          socket.handlers['block']('block3');
          setTimeout(function() {
            notifyNewBlockSpy.calledThrice.should.be.true;
            done();
          }, 100);
        }, 100);
      }, 100);
    });
  });
});
