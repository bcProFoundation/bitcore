import { ObjectId } from 'mongodb-legacy';
import { expect } from 'chai';
import * as sinon from 'sinon';
import logger from '../../../src/logger';
import { CacheStorage } from '../../../src/models/cache';
import { resetDatabase } from '../../helpers';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

describe('Cache Model', function() {
  const key = 'key';
  const value = { hello: 'world' };
  const walletKey = 'wallet-key';
  const walletValue = { walletThing: 1 };
  const wallet = new ObjectId();

  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const suite = this;
  this.timeout(30000);
  before(intBeforeHelper);
  after(async () => intAfterHelper(suite));

  beforeEach(async () => {
    await resetDatabase();
  });

  it('should cache a value', async () => {
    await CacheStorage.setGlobal(key, value, CacheStorage.Times.Hour);
    const found = await CacheStorage.collection.findOne({ key });
    const got = await CacheStorage.getGlobal(key);
    expect(found).to.exist;
    expect(found!.expireTime).to.eq(CacheStorage.Times.Hour);
    expect(got).to.deep.eq(found!.value);
    expect(got).to.deep.eq(value);
  });

  it('should get the value', async () => {
    await CacheStorage.setGlobal(key, value, CacheStorage.Times.Hour);
    const got = await CacheStorage.getGlobal(key);
    expect(got).to.deep.eq(value);
  });

  it('should expire the key', async () => {
    await CacheStorage.setGlobal(key, value, CacheStorage.Times.Hour);
    await CacheStorage.expire(key);
    const got = await CacheStorage.getGlobal(key);
    expect(got).to.eq(null);
  });

  it('should delete an expired entry before returning the miss', async () => {
    await CacheStorage.setGlobal(key, value, -1);
    const got = await CacheStorage.getGlobal(key);
    expect(got).to.eq(null);
    const found = await CacheStorage.collection.findOne({ key });
    expect(found).to.not.exist;
  });

  it('should not delete a refreshed entry with a stale delete', async () => {
    const freshValue = { hello: 'again' };
    await CacheStorage.setGlobal(key, value, -1);
    const stale = await CacheStorage.collection.findOne({ key });
    // refresh reuses the same document; the stale-versioned delete must no-op
    await CacheStorage.setGlobal(key, freshValue, CacheStorage.Times.Hour);
    await CacheStorage.collection.deleteOne({ _id: stale!._id, created: stale!.created });
    const got = await CacheStorage.getGlobal(key);
    expect(got).to.deep.eq(freshValue);
  });

  it('should cache the value returned by fn', async () => {
    const got = await CacheStorage.getGlobalOrRefresh(key, async () => value, CacheStorage.Times.Hour);
    const found = await CacheStorage.collection.findOne({ key });
    expect(found).to.exist;
    expect(found!.expireTime).to.eq(CacheStorage.Times.Hour);
    expect(got).to.deep.eq(found!.value);
  });

  describe('getGlobalAndRefresh', function() {
    const fresh = { hello: 'again' };
    const sandbox = sinon.createSandbox();
    let warn: sinon.SinonStub;
    const age = (ms: number) => CacheStorage.collection.updateOne({ key }, { $set: { created: Date.now() - ms } });
    const waitFor = async (check: () => Promise<boolean> | boolean) => {
      const until = Date.now() + 5000;
      while (!(await check())) {
        if (Date.now() > until) {
          throw new Error('timed out');
        }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    };
    const storedValue = async () => (await CacheStorage.collection.findOne({ key }))?.value;

    beforeEach(() => {
      warn = sandbox.stub(logger, 'warn');
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('computes and stores a value the first time, for maxAge', async () => {
      const got = await CacheStorage.getGlobalAndRefresh(key, async () => value, CacheStorage.Times.Minute);
      const found = await CacheStorage.collection.findOne({ key });
      expect(got).to.deep.eq(value);
      expect(found!.value).to.deep.eq(value);
      expect(found!.expireTime).to.eq(CacheStorage.Times.Minute);
    });

    it('passes on a failure the first time, and stores nothing', async () => {
      const err = await CacheStorage.getGlobalAndRefresh(key, async () => {
        throw new Error('no value');
      }, CacheStorage.Times.Minute).catch(e => e);
      expect(err).to.have.property('message', 'no value');
      expect(await CacheStorage.collection.findOne({ key })).to.not.exist;
    });

    it('computes once for concurrent first calls', async () => {
      let calls = 0;
      const refresh = async () => {
        calls++;
        await new Promise(resolve => setTimeout(resolve, 50));
        return value;
      };
      const got = await Promise.all([1, 2, 3].map(() => CacheStorage.getGlobalAndRefresh(key, refresh, CacheStorage.Times.Minute)));
      expect(got).to.deep.eq([value, value, value]);
      expect(calls).to.eq(1);
    });

    it('returns a value younger than maxAge without refreshing it', async () => {
      await CacheStorage.setGlobal(key, value, CacheStorage.Times.Minute);
      await age(59 * 1000);
      let calls = 0;
      const got = await CacheStorage.getGlobalAndRefresh(key, async () => {
        calls++;
        return fresh;
      }, CacheStorage.Times.Minute);
      expect(got).to.deep.eq(value);
      expect(calls).to.eq(0);
    });

    it('returns a value older than maxAge, and replaces it in the background', async () => {
      await CacheStorage.setGlobal(key, value, CacheStorage.Times.Minute);
      await age(61 * 1000);
      const got = await CacheStorage.getGlobalAndRefresh(key, async () => fresh, CacheStorage.Times.Minute);
      expect(got).to.deep.eq(value);
      await waitFor(async () => (await storedValue())?.hello === 'again');
      expect(await CacheStorage.getGlobalAndRefresh(key, async () => value, CacheStorage.Times.Minute)).to.deep.eq(fresh);
    });

    it('returns a value cached before staleAfter, and replaces it in the background', async () => {
      await CacheStorage.setGlobal(key, value, CacheStorage.Times.Minute);
      const got = await CacheStorage.getGlobalAndRefresh(key, async () => fresh, CacheStorage.Times.Minute, Date.now() + 1);
      expect(got).to.deep.eq(value);
      await waitFor(async () => (await storedValue())?.hello === 'again');
    });

    it('ignores a staleAfter older than the value', async () => {
      await CacheStorage.setGlobal(key, value, CacheStorage.Times.Minute);
      let calls = 0;
      await CacheStorage.getGlobalAndRefresh(key, async () => {
        calls++;
        return fresh;
      }, CacheStorage.Times.Minute, Date.now() - 1000);
      expect(calls).to.eq(0);
    });

    it('dates a value from when its computation started', async () => {
      const started = Date.now();
      let entered = 0;
      await CacheStorage.getGlobalAndRefresh(key, async () => {
        entered = Date.now();
        await new Promise(resolve => setTimeout(resolve, 200));
        return value;
      }, CacheStorage.Times.Minute);
      const found = await CacheStorage.collection.findOne({ key });
      expect(found!.created).to.be.within(started, entered);
      expect(Date.now() - found!.created).to.be.at.least(190);
    });

    it('keeps the value when a refresh fails, without passing on the failure', async () => {
      await CacheStorage.setGlobal(key, value, CacheStorage.Times.Minute);
      await age(61 * 1000);
      let calls = 0;
      const failing = async () => {
        calls++;
        throw new Error('refresh failed');
      };
      expect(await CacheStorage.getGlobalAndRefresh(key, failing, CacheStorage.Times.Minute)).to.deep.eq(value);
      await waitFor(() => warn.callCount === 1);
      expect(warn.firstCall.args[1]).to.eq(key);
      expect(warn.firstCall.args[2]).to.have.property('message', 'refresh failed');
      expect(await storedValue()).to.deep.eq(value);
      expect(await CacheStorage.getGlobalAndRefresh(key, failing, CacheStorage.Times.Minute)).to.deep.eq(value);
      await waitFor(() => warn.callCount === 2);
      expect(calls).to.eq(2);
    });

    it('recovers from a first computation that throws before returning a promise', async () => {
      const throwing = (): Promise<any> => {
        throw new Error('thrown at once');
      };
      const err = await CacheStorage.getGlobalAndRefresh(key, throwing, CacheStorage.Times.Minute).catch(e => e);
      expect(err).to.have.property('message', 'thrown at once');
      expect(await CacheStorage.getGlobalAndRefresh(key, async () => value, CacheStorage.Times.Minute)).to.deep.eq(value);
    });

    it('recovers from a refresh that throws before returning a promise', async () => {
      await CacheStorage.setGlobal(key, value, CacheStorage.Times.Minute);
      await age(61 * 1000);
      const throwing = (): Promise<any> => {
        throw new Error('thrown at once');
      };
      expect(await CacheStorage.getGlobalAndRefresh(key, throwing, CacheStorage.Times.Minute)).to.deep.eq(value);
      await waitFor(() => warn.callCount === 1);
      expect(warn.firstCall.args[2]).to.have.property('message', 'thrown at once');
      expect(await CacheStorage.getGlobalAndRefresh(key, async () => fresh, CacheStorage.Times.Minute)).to.deep.eq(value);
      await waitFor(async () => (await storedValue())?.hello === 'again');
    });

    it('gives up on a refresh that takes longer than maxAge, so the next call can refresh', async () => {
      const maxAge = 300;
      await CacheStorage.setGlobal(key, value, maxAge);
      await age(maxAge + 1000);
      let calls = 0;
      const hanging = () => {
        calls++;
        return new Promise(() => undefined);
      };
      const started = Date.now();
      expect(await CacheStorage.getGlobalAndRefresh(key, hanging, maxAge)).to.deep.eq(value);
      expect(await CacheStorage.getGlobalAndRefresh(key, hanging, maxAge)).to.deep.eq(value);
      expect(calls).to.eq(1);
      await waitFor(() => warn.callCount === 1);
      expect(Date.now() - started).to.be.below(3 * maxAge);
      expect(warn.firstCall.args[2]).to.have.property('message', `Refreshing ${key} timed out`);
      expect(await CacheStorage.getGlobalAndRefresh(key, async () => fresh, maxAge)).to.deep.eq(value);
      await waitFor(async () => (await storedValue())?.hello === 'again');
      expect(calls).to.eq(1);
    });
  });

  it('should cache the wallet value', async () => {
    await CacheStorage.setForWallet(wallet, walletKey, walletValue, CacheStorage.Times.Day);
    const found = await CacheStorage.collection.findOne({ key: walletKey, wallet });
    const global = await CacheStorage.getGlobal(walletKey);
    expect(global).to.eq(null);
    const got = await CacheStorage.getForWallet(wallet, walletKey);
    expect(found).to.exist;
    expect(found!.expireTime).to.eq(CacheStorage.Times.Day);
    expect(got).to.deep.eq(found!.value);
    expect(got).to.deep.eq(walletValue);
  });

  it('should cache the value returned by fn for wallet', async () => {
    const got = await CacheStorage.getForWalletOrRefresh(
      wallet,
      walletKey,
      async () => walletValue,
      CacheStorage.Times.Hour
    );
    const found = await CacheStorage.collection.findOne({ key: walletKey, wallet });
    expect(found).to.exist;
    expect(found!.expireTime).to.eq(CacheStorage.Times.Hour);
    expect(got).to.deep.eq(found!.value);
  });







});
