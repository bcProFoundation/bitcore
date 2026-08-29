'use strict';

const assert = require('assert');
const {
  accountPath,
  addressPath,
  copayerId,
  createWalletPrivKey,
  deriveAddress,
  deriveRequestKey,
  encodeSecret,
  decodeSecret,
  getCopayerHash,
  requestAuthMessage,
  signMessage,
  verifyMessage,
  selectUtxos,
  estimateTxSize,
  formatAmount
} = require('../dist/crypto');

const BitcoreXec = require('@bcpros/bitcore-lib-xec');
const BitcoreDoge = require('@bcpros/bitcore-lib-doge');

function accountFromMnemonic(coin, n = 1) {
  const bitcore = coin === 'xec' ? BitcoreXec : BitcoreDoge;
  const hd = new bitcore.HDPrivateKey();
  const account = hd.deriveChild(accountPath(coin, n));
  return {
    xpriv: account.toString(),
    xpub: account.hdPublicKey.toString()
  };
}

describe('crypto', () => {
  it('uses BIP44 for single-sig and BIP48 for multisig', () => {
    assert.strictEqual(accountPath('xec', 1), "m/44'/1899'/0'");
    assert.strictEqual(accountPath('xec', 2), "m/48'/1899'/0'");
    assert.strictEqual(accountPath('doge', 1), "m/44'/3'/0'");
    assert.strictEqual(accountPath('doge', 3), "m/48'/3'/0'");
  });

  it('derives a valid eCash P2PKH cashaddr', () => {
    const account = accountFromMnemonic('xec');
    const { address } = deriveAddress({
      coin: 'xec',
      network: 'livenet',
      m: 1,
      scriptType: 'P2PKH',
      publicKeyRing: [{ xPubKey: account.xpub }],
      path: addressPath(false, 0)
    });
    assert.ok(address.startsWith('ecash:'));
    assert.ok(BitcoreXec.Address.isValid(address, 'ecash'));
  });

  it('derives a valid Dogecoin P2PKH address', () => {
    const account = accountFromMnemonic('doge');
    const { address } = deriveAddress({
      coin: 'doge',
      network: 'livenet',
      m: 1,
      scriptType: 'P2PKH',
      publicKeyRing: [{ xPubKey: account.xpub }],
      path: addressPath(false, 0)
    });
    assert.ok(BitcoreDoge.Address.isValid(address, 'livenet'));
  });

  it('derives the same 2-of-3 P2SH address from all copayer xpubs', () => {
    const ring = [0, 1, 2].map(() => {
      return { xPubKey: accountFromMnemonic('xec', 3).xpub };
    });
    const a = deriveAddress({
      coin: 'xec',
      network: 'livenet',
      m: 2,
      scriptType: 'P2SH',
      publicKeyRing: ring,
      path: 'm/0/0'
    });
    const b = deriveAddress({
      coin: 'xec',
      network: 'livenet',
      m: 2,
      scriptType: 'P2SH',
      publicKeyRing: ring,
      path: 'm/0/0'
    });
    assert.strictEqual(a.address, b.address);
    assert.ok(a.address.startsWith('ecash:'));
    assert.strictEqual(a.publicKeys.length, 3);
  });

  it('signs and verifies Copay-style request messages', () => {
    const { privKey, pubKey } = createWalletPrivKey('xec');
    const message = requestAuthMessage('post', '/bws/api/v3/addresses', {});
    const signature = signMessage(message, privKey);
    assert.strictEqual(verifyMessage(message, signature, pubKey), true);
    assert.strictEqual(verifyMessage(message + 'x', signature, pubKey), false);
  });

  it('round-trips wallet secrets', () => {
    const keys = createWalletPrivKey('xec');
    const secret = encodeSecret({
      walletId: 'abc',
      coin: 'xec',
      network: 'livenet',
      m: 2,
      n: 3,
      name: 'Shared',
      walletPrivKey: keys.privKey
    });
    const parsed = decodeSecret(secret);
    assert.strictEqual(parsed.walletId, 'abc');
    assert.strictEqual(parsed.n, 3);
    assert.strictEqual(parsed.walletPrivKey, keys.privKey);
  });

  it('creates stable copayer ids', () => {
    const id = copayerId('xec', 'xpub123');
    assert.strictEqual(id.length, 64);
    assert.strictEqual(copayerId('xec', 'xpub123'), id);
    assert.notStrictEqual(copayerId('doge', 'xpub123'), id);
  });

  it('selects utxos covering amount plus fee', () => {
    const utxos = [
      { txid: 'a', vout: 0, satoshis: 10000, address: 'x', path: 'm/0/0' },
      { txid: 'b', vout: 1, satoshis: 5000, address: 'x', path: 'm/0/1' }
    ];
    const result = selectUtxos(utxos, 4000, 1000, 1, 1, 546);
    assert.ok(result.inputs.length > 0);
    assert.ok(result.fee > 0);
    const total = result.inputs.reduce((s, i) => s + i.satoshis, 0);
    assert.ok(total >= 4000 + result.fee);
  });

  it('formats XEC with 2 decimals and DOGE with 8', () => {
    assert.strictEqual(formatAmount(12345, 'xec'), '123.45');
    assert.strictEqual(formatAmount(1e8, 'doge'), '1.00000000');
  });

  it('estimates multisig inputs larger than single-sig', () => {
    assert.ok(estimateTxSize(1, 2, 2, 3) > estimateTxSize(1, 2, 1, 1));
  });

  it('hashes copayer join payload', () => {
    assert.strictEqual(getCopayerHash('Alice', 'xpub', 'req'), 'Alice|xpub|req');
  });

  it('derives request keys from the account xpriv', () => {
    const account = accountFromMnemonic('xec');
    const keys = deriveRequestKey(account.xpriv, 'xec');
    assert.ok(keys.privKey);
    assert.ok(keys.pubKey);
    assert.notStrictEqual(keys.pubKey, keys.privKey);
  });
});
