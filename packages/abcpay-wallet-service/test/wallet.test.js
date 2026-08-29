'use strict';

const assert = require('assert');
const { buildApp } = require('../dist/app');
const { MockChainIndex } = require('../dist/chronik');
const {
  accountPath,
  createWalletPrivKey,
  deriveRequestKey,
  getCopayerHash,
  requestAuthMessage,
  signInputs,
  signMessage
} = require('../dist/crypto');
const { MemoryStorage } = require('../dist/storage');

const BitcoreXec = require('@bcpros/bitcore-lib-xec');

function makeCopayer(name, n = 1) {
  const hd = new BitcoreXec.HDPrivateKey();
  const account = hd.deriveChild(accountPath('xec', n));
  const request = deriveRequestKey(account.toString(), 'xec');
  return {
    name,
    xpriv: account.toString(),
    xpub: account.hdPublicKey.toString(),
    requestPrivKey: request.privKey,
    requestPubKey: request.pubKey
  };
}

async function signedRequest(app, copayer, method, url, body, copayerId) {
  const message = requestAuthMessage(method, url, method === 'GET' || method === 'DELETE' ? {} : body);
  const signature = signMessage(message, copayer.requestPrivKey);
  return app.inject({
    method,
    url,
    payload: method === 'GET' || method === 'DELETE' ? undefined : body,
    headers: {
      'x-identity': copayerId,
      'x-signature': signature,
      'content-type': 'application/json'
    }
  });
}

describe('wallet service http', () => {
  it('creates a 1-of-1 wallet, joins, and issues an address', async () => {
    const storage = new MemoryStorage();
    const chain = new MockChainIndex();
    const app = await buildApp({ storage, chain });
    const walletKeys = createWalletPrivKey('xec');
    const copayer = makeCopayer('Alice');

    const created = await app.inject({
      method: 'POST',
      url: '/bws/api/v1/wallets',
      payload: {
        name: 'Personal XEC',
        m: 1,
        n: 1,
        pubKey: walletKeys.pubKey,
        coin: 'xec',
        network: 'livenet'
      }
    });
    assert.strictEqual(created.statusCode, 200);
    const walletId = created.json().walletId;

    const join = await app.inject({
      method: 'POST',
      url: `/bws/api/v1/wallets/${walletId}/copayers`,
      payload: {
        name: copayer.name,
        xPubKey: copayer.xpub,
        requestPubKey: copayer.requestPubKey,
        copayerSignature: signMessage(
          getCopayerHash(copayer.name, copayer.xpub, copayer.requestPubKey),
          walletKeys.privKey
        )
      }
    });
    assert.strictEqual(join.statusCode, 200);
    const copayerId = join.json().copayerId;
    assert.strictEqual(join.json().wallet.status, 'complete');

    const addr = await signedRequest(app, copayer, 'POST', '/bws/api/v3/addresses', {}, copayerId);
    assert.strictEqual(addr.statusCode, 200);
    assert.match(addr.json().address, /^ecash:/);
    assert.strictEqual(addr.json().path, 'm/0/0');

    await app.close();
  });

  it('completes a 2-of-3 shared wallet after three joins', async () => {
    const storage = new MemoryStorage();
    const chain = new MockChainIndex();
    const app = await buildApp({ storage, chain });
    const walletKeys = createWalletPrivKey('xec');
    const copayers = [makeCopayer('A', 3), makeCopayer('B', 3), makeCopayer('C', 3)];

    const created = await app.inject({
      method: 'POST',
      url: '/bws/api/v1/wallets',
      payload: {
        name: 'Shared',
        m: 2,
        n: 3,
        pubKey: walletKeys.pubKey,
        coin: 'xec',
        network: 'livenet'
      }
    });
    const walletId = created.json().walletId;

    let last;
    for (const copayer of copayers) {
      last = await app.inject({
        method: 'POST',
        url: `/bws/api/v1/wallets/${walletId}/copayers`,
        payload: {
          name: copayer.name,
          xPubKey: copayer.xpub,
          requestPubKey: copayer.requestPubKey,
          copayerSignature: signMessage(
            getCopayerHash(copayer.name, copayer.xpub, copayer.requestPubKey),
            walletKeys.privKey
          )
        }
      });
      assert.strictEqual(last.statusCode, 200);
    }
    assert.strictEqual(last.json().wallet.status, 'complete');
    assert.strictEqual(last.json().copayers.length, 3);

    const copayerId = last.json().copayers[0].id;
    const addr = await signedRequest(app, copayers[0], 'POST', '/bws/api/v3/addresses', {}, copayerId);
    assert.strictEqual(addr.statusCode, 200);
    assert.strictEqual(addr.json().publicKeys.length, 3);

    await app.close();
  });

  it('rejects unsigned requests', async () => {
    const app = await buildApp({ storage: new MemoryStorage(), chain: new MockChainIndex() });
    const res = await app.inject({ method: 'GET', url: '/bws/api/v1/wallets' });
    assert.strictEqual(res.statusCode, 401);
    await app.close();
  });

  it('creates a tx proposal from Chronik utxos and requires m signatures', async () => {
    const storage = new MemoryStorage();
    const chain = new MockChainIndex();
    const app = await buildApp({ storage, chain });
    const walletKeys = createWalletPrivKey('xec');
    const copayer = makeCopayer('Alice');

    const created = await app.inject({
      method: 'POST',
      url: '/bws/api/v1/wallets',
      payload: {
        name: 'Spend',
        m: 1,
        n: 1,
        pubKey: walletKeys.pubKey,
        coin: 'xec',
        network: 'livenet'
      }
    });
    const walletId = created.json().walletId;
    const join = await app.inject({
      method: 'POST',
      url: `/bws/api/v1/wallets/${walletId}/copayers`,
      payload: {
        name: copayer.name,
        xPubKey: copayer.xpub,
        requestPubKey: copayer.requestPubKey,
        copayerSignature: signMessage(
          getCopayerHash(copayer.name, copayer.xpub, copayer.requestPubKey),
          walletKeys.privKey
        )
      }
    });
    const copayerId = join.json().copayerId;
    const addr = await signedRequest(app, copayer, 'POST', '/bws/api/v3/addresses', {}, copayerId);
    const address = addr.json().address;

    chain.setUtxos('xec', address, [{ txid: '11'.repeat(32), outIdx: 0, sats: 100000, blockHeight: 800000 }]);

    const destAccount = new BitcoreXec.HDPrivateKey().deriveChild(accountPath('xec', 1));
    const destAddress = BitcoreXec.Address.fromPublicKey(
      destAccount.deriveChild('m/0/0').publicKey,
      'livenet'
    ).toCashAddress();

    const proposal = await signedRequest(
      app,
      copayer,
      'POST',
      '/bws/api/v3/txproposals',
      { toAddress: destAddress, amount: 10000 },
      copayerId
    );
    assert.strictEqual(proposal.statusCode, 200, proposal.body);
    assert.strictEqual(Number(proposal.json().amount), 10000);
    assert.strictEqual(proposal.json().status, 'temporary');

    const published = await signedRequest(
      app,
      copayer,
      'POST',
      `/bws/api/v2/txproposals/${proposal.json().id}/publish`,
      {},
      copayerId
    );
    assert.strictEqual(published.statusCode, 200);
    assert.strictEqual(published.json().status, 'pending');

    const signed = await signedRequest(
      app,
      copayer,
      'POST',
      `/bws/api/v1/txproposals/${proposal.json().id}/signatures`,
      {
        signatures: signInputs(
          'xec',
          proposal.json().raw,
          proposal.json().inputs,
          copayer.xpriv,
          {
            coin: 'xec',
            network: 'livenet',
            inputs: proposal.json().inputs,
            toAddress: destAddress,
            amount: 10000,
            changeAddress: proposal.json().changeAddress,
            change: Number((proposal.json().outputs || [])[1]?.amount || 0),
            fee: Number(proposal.json().fee),
            m: 1
          }
        )
      },
      copayerId
    );
    assert.strictEqual(signed.statusCode, 200, signed.body);
    assert.strictEqual(signed.json().status, 'accepted');

    const broadcast = await signedRequest(
      app,
      copayer,
      'POST',
      `/bws/api/v1/txproposals/${proposal.json().id}/broadcast`,
      { signedHex: signed.json().raw },
      copayerId
    );
    assert.strictEqual(broadcast.statusCode, 200);
    assert.strictEqual(broadcast.json().status, 'broadcasted');
    assert.strictEqual(chain.broadcasts.length, 1);

    await app.close();
  });

  it('only supports xec and doge', async () => {
    const app = await buildApp({ storage: new MemoryStorage(), chain: new MockChainIndex() });
    const res = await app.inject({
      method: 'POST',
      url: '/bws/api/v1/wallets',
      payload: {
        name: 'BTC',
        m: 1,
        n: 1,
        pubKey: createWalletPrivKey('xec').pubKey,
        coin: 'btc',
        network: 'livenet'
      }
    });
    assert.strictEqual(res.statusCode, 400);
    await app.close();
  });
});
