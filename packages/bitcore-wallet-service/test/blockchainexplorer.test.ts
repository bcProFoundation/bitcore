'use strict';

import * as chai from 'chai';
import 'chai/register-should';
import { BlockChainExplorer } from '../src/lib/blockchainexplorer';

const should = chai.should();

describe('BlockChain explorer', function() {
  describe('#constructor', function() {
    it('should fail on a provider it does not support even with a url', function() {
      (() => BlockChainExplorer({ provider: 'dummy', chain: 'btc', network: 'livenet', url: 'http://localhost:3000' }))
        .should.throw('Provider not supported: dummy');
    });
    it('should default the bch address format to cashaddr on the given opts', function() {
      const opts: any = { chain: 'bch', network: 'livenet' };
      BlockChainExplorer(opts);
      opts.addressFormat.should.equal('cashaddr');
    });
    it('should fail on unsupported provider', function() {
      try {
        const exp = BlockChainExplorer({
          provider: 'dummy',
          coin: 'btc',
        });
        throw new Error('Should have thrown');
      } catch (err) {
        err.message.should.equal('No url found for provider: dummy:btc:livenet');
      }
    });
  });
  describe('#v8', function() {
    it.skip('should sign registration', function() {
      const exp = BlockChainExplorer({
        provider: 'v8',
        coin: 'btc',
        network: 'livenet',
      });
      should.exist(exp);
      exp.register; // ...TODO
    });
  });
});
