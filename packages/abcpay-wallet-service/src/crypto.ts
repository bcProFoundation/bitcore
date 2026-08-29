import { randomUUID } from 'crypto';

export type Coin = 'xec' | 'doge';
export type Network = 'livenet' | 'testnet';
export type AddressType = 'P2PKH' | 'P2SH';

const BitcoreXec = require('@bcpros/bitcore-lib-xec');
const BitcoreDoge = require('@bcpros/bitcore-lib-doge');

export const COINS: Record<
  Coin,
  {
    name: string;
    ticker: string;
    coinType: number;
    decimals: number;
    unitToSat: number;
    feePerKb: number;
    dust: number;
    chronikUrls: string[];
  }
> = {
  xec: {
    name: 'eCash',
    ticker: 'XEC',
    coinType: 1899,
    decimals: 2,
    unitToSat: 100,
    feePerKb: 1000,
    dust: 546,
    chronikUrls: [
      'https://chronik.e.cash',
      'https://chronik.pay2stay.com/xec',
      'https://chronik.lixi.app/xec'
    ]
  },
  doge: {
    name: 'Dogecoin',
    ticker: 'DOGE',
    coinType: 3,
    decimals: 8,
    unitToSat: 1e8,
    feePerKb: 1_000_000,
    dust: 1_000_000,
    chronikUrls: ['https://doge.chronik.be.cash']
  }
};

export const PATHS = {
  REQUEST_KEY: "m/1'/0",
  REQUEST_KEY_AUTH: 'm/2'
};

export function isCoin(value: string): value is Coin {
  return value === 'xec' || value === 'doge';
}

export function getLib(coin: Coin) {
  return coin === 'xec' ? BitcoreXec : BitcoreDoge;
}

function ensureXecNetworks() {
  const Networks = BitcoreXec.Networks;
  if (Networks.get('ecash')) return;
  Networks.add({
    name: 'ecash',
    alias: 'xec',
    prefix: 'ecash',
    pubkeyhash: 28,
    privatekey: 0x80,
    scripthash: 40,
    xpubkey: 0x0488b21e,
    xprivkey: 0x0488ade4
  });
  Networks.add({
    name: 'ectest',
    alias: 'xectest',
    prefix: 'ectest',
    pubkeyhash: 0x6f,
    privatekey: 0xef,
    scripthash: 0xc4,
    xpubkey: 0x043587cf,
    xprivkey: 0x04358394
  });
}

ensureXecNetworks();

export function libNetwork(coin: Coin, network: Network): string {
  if (coin !== 'xec') return network;
  return network === 'testnet' ? 'ectest' : 'ecash';
}

export function accountPath(coin: Coin, n: number, account = 0): string {
  const purpose = n > 1 ? 48 : 44;
  return `m/${purpose}'/${COINS[coin].coinType}'/${account}'`;
}

export function addressPath(isChange: boolean, index: number): string {
  return `m/${isChange ? 1 : 0}/${index}`;
}

export function copayerId(coin: Coin, xPubKey: string): string {
  const Bitcore = BitcoreXec;
  const str = coin + xPubKey;
  return Bitcore.crypto.Hash.sha256(Buffer.from(str)).toString('hex');
}

export function hashMessage(text: string) {
  const Bitcore = BitcoreXec;
  const buf = Buffer.from(text);
  let hash = Bitcore.crypto.Hash.sha256sha256(buf);
  hash = new Bitcore.encoding.BufferReader(hash).readReverse();
  return hash;
}

export function signMessage(message: string, privKey: string): string {
  const Bitcore = BitcoreXec;
  const priv = new Bitcore.PrivateKey(privKey);
  const hash = hashMessage(message);
  return Bitcore.crypto.ECDSA.sign(hash, priv, { endian: 'little' }).toString();
}

export function verifyMessage(message: string, signature: string, pubKey: string): boolean {
  const Bitcore = BitcoreXec;
  try {
    const pub = new Bitcore.PublicKey(pubKey);
    const hash = hashMessage(message);
    const sig = new Bitcore.crypto.Signature.fromString(signature);
    return Bitcore.crypto.ECDSA.verify(hash, sig, pub, { endian: 'little' });
  } catch {
    return false;
  }
}

export function requestAuthMessage(method: string, url: string, body: unknown): string {
  return `${method.toLowerCase()}|${url}|${JSON.stringify(body ?? {})}`;
}

export function getCopayerHash(name: string, xPubKey: string, requestPubKey: string): string {
  return [name, xPubKey, requestPubKey].join('|');
}

export function deriveRequestKey(accountXpriv: string, coin: Coin) {
  const bitcore = getLib(coin);
  const hd = new bitcore.HDPrivateKey(accountXpriv);
  const derived = hd.deriveChild(PATHS.REQUEST_KEY);
  return {
    privKey: derived.privateKey.toString(),
    pubKey: derived.publicKey.toString()
  };
}

export function signRequestPubKey(requestPubKey: string, accountXpriv: string, coin: Coin): string {
  const bitcore = getLib(coin);
  const hd = new bitcore.HDPrivateKey(accountXpriv);
  const authPriv = hd.deriveChild(PATHS.REQUEST_KEY_AUTH).privateKey.toString();
  return signMessage(requestPubKey, authPriv);
}

export interface PublicKeyRingItem {
  xPubKey: string;
}

export function deriveAddress(opts: {
  coin: Coin;
  network: Network;
  m: number;
  scriptType: AddressType;
  publicKeyRing: PublicKeyRingItem[];
  path: string;
}): { address: string; publicKeys: string[] } {
  const { coin, network, m, scriptType, publicKeyRing, path } = opts;
  const bitcore = getLib(coin);
  const net = libNetwork(coin, network);
  const publicKeys = publicKeyRing.map(item => {
    const xpub = new bitcore.HDPublicKey(item.xPubKey);
    return xpub.deriveChild(path).publicKey;
  });

  let address;
  if (scriptType === 'P2PKH') {
    if (publicKeys.length !== 1) {
      throw new Error('P2PKH requires exactly one public key');
    }
    address = bitcore.Address.fromPublicKey(publicKeys[0], net);
  } else {
    address = bitcore.Address.createMultisig(publicKeys, m, net);
  }

  const addressStr = coin === 'xec' ? address.toCashAddress() : address.toString();
  return {
    address: addressStr,
    publicKeys: publicKeys.map((pk: { toString: () => string }) => pk.toString())
  };
}

export function buildRedeemScript(publicKeysHex: string[], m: number, coin: Coin): string {
  const bitcore = getLib(coin);
  const publicKeys = publicKeysHex.map(hex => new bitcore.PublicKey(hex));
  return bitcore.Script.buildMultisigOut(publicKeys, m).toHex();
}

export function validateAddress(coin: Coin, network: Network, address: string): boolean {
  const bitcore = getLib(coin);
  const net = libNetwork(coin, network);
  return bitcore.Address.isValid(address, net) || bitcore.Address.isValid(address, network);
}

export function createWalletPrivKey(coin: Coin): { privKey: string; pubKey: string } {
  const bitcore = getLib(coin);
  const priv = new bitcore.PrivateKey();
  return { privKey: priv.toString(), pubKey: priv.toPublicKey().toString() };
}

export function encodeSecret(payload: {
  walletId: string;
  coin: Coin;
  network: Network;
  m: number;
  n: number;
  name: string;
  walletPrivKey: string;
}): string {
  const json = JSON.stringify(payload);
  const Bitcore = BitcoreXec;
  return Bitcore.encoding.Base58.encode(Buffer.from(json, 'utf8'));
}

export function decodeSecret(secret: string): {
  walletId: string;
  coin: Coin;
  network: Network;
  m: number;
  n: number;
  name: string;
  walletPrivKey: string;
} {
  const Bitcore = BitcoreXec;
  const json = Buffer.from(Bitcore.encoding.Base58.decode(secret)).toString('utf8');
  const parsed = JSON.parse(json);
  if (!isCoin(parsed.coin) || !parsed.walletId || !parsed.walletPrivKey) {
    throw new Error('Invalid wallet secret');
  }
  return parsed;
}

export function newId(): string {
  return randomUUID();
}

export function formatAmount(sats: number | bigint, coin: Coin): string {
  const { unitToSat, decimals } = COINS[coin];
  const value = Number(sats) / unitToSat;
  return value.toFixed(decimals);
}

export interface UtxoInput {
  txid: string;
  vout: number;
  satoshis: number;
  address: string;
  path: string;
  scriptPubKey?: string;
  redeemScript?: string;
  confirmations?: number;
  publicKeys?: string[];
}

export function estimateTxSize(inputCount: number, outputCount: number, m: number, n: number): number {
  const overhead = 10;
  const outputSize = 34 * outputCount;
  const inputSize = n === 1 ? 148 : 73 * m + 34 * n + 6 + 40;
  return overhead + outputSize + inputSize * inputCount;
}

export function selectUtxos(
  utxos: UtxoInput[],
  amount: number,
  feePerKb: number,
  m: number,
  n: number,
  dust: number
): { inputs: UtxoInput[]; fee: number; change: number } {
  const sorted = [...utxos].sort((a, b) => b.satoshis - a.satoshis);
  const selected: UtxoInput[] = [];
  let total = 0;

  for (const utxo of sorted) {
    selected.push(utxo);
    total += utxo.satoshis;
    const size = estimateTxSize(selected.length, 2, m, n);
    const fee = Math.ceil((size * feePerKb) / 1000);
    if (total >= amount + fee) {
      let change = total - amount - fee;
      if (change > 0 && change < dust) {
        const feeWithChange = fee + change;
        return { inputs: selected, fee: feeWithChange, change: 0 };
      }
      return { inputs: selected, fee, change };
    }
  }

  throw Object.assign(new Error('Insufficient funds'), { code: 'INSUFFICIENT_FUNDS' });
}

export function sighashType(coin: Coin): number {
  const bitcore = getLib(coin);
  return bitcore.crypto.Signature.SIGHASH_ALL | (coin === 'xec' ? bitcore.crypto.Signature.SIGHASH_FORKID : 0);
}

export interface BuildTxOpts {
  coin: Coin;
  network: Network;
  inputs: UtxoInput[];
  toAddress: string;
  amount: number;
  changeAddress?: string | null;
  change: number;
  fee: number;
  m?: number;
}

export function createTransaction(opts: BuildTxOpts) {
  const bitcore = getLib(opts.coin);
  const tx = new bitcore.Transaction();
  const m = opts.m || 1;

  for (const input of opts.inputs) {
    const utxo: Record<string, unknown> = {
      txId: input.txid,
      outputIndex: input.vout,
      satoshis: input.satoshis,
      address: input.address
    };
    if (input.scriptPubKey) {
      utxo.script = input.scriptPubKey;
    }
    if (input.publicKeys && input.publicKeys.length > 1) {
      tx.from(
        utxo,
        input.publicKeys.map(hex => new bitcore.PublicKey(hex)),
        m
      );
    } else {
      tx.from(utxo);
    }
  }

  tx.to(opts.toAddress, opts.amount);
  if (opts.change > 0 && opts.changeAddress) {
    tx.change(opts.changeAddress);
  }
  tx.fee(opts.fee);
  return tx;
}

export function buildTransaction(opts: BuildTxOpts): { hex: string; txid?: string } {
  return { hex: createTransaction(opts).uncheckedSerialize() };
}

export function applyCopayerSignatures(
  coin: Coin,
  tx: { applySignature: (sig: unknown) => unknown },
  inputs: UtxoInput[],
  signatures: string[],
  xPubKey: string
) {
  const bitcore = getLib(coin);
  const xpub = new bitcore.HDPublicKey(xPubKey);
  const sigtype = sighashType(coin);

  signatures.forEach((sigHex, index) => {
    if (!sigHex || !inputs[index]) return;
    const publicKey = xpub.deriveChild(inputs[index].path).publicKey;
    const signature = bitcore.crypto.Signature.fromString(sigHex);
    tx.applySignature({
      inputIndex: index,
      signature,
      publicKey,
      sigtype
    });
  });
  return tx;
}

export function assembleSignedHex(opts: BuildTxOpts & { actions: Array<{ xPubKey: string; signatures: string[] }> }): string {
  const tx = createTransaction(opts);
  for (const action of opts.actions) {
    applyCopayerSignatures(opts.coin, tx, opts.inputs, action.signatures, action.xPubKey);
  }
  return tx.uncheckedSerialize();
}

export function applySignatures(
  coin: Coin,
  raw: string,
  inputs: UtxoInput[],
  signatures: string[],
  xPubKey: string,
  build?: BuildTxOpts
): string {
  const tx = build ? createTransaction(build) : createTransaction({
    coin,
    network: 'livenet',
    inputs,
    toAddress: inputs[0]?.address || '',
    amount: 0,
    change: 0,
    fee: 0
  });
  applyCopayerSignatures(coin, tx, inputs, signatures, xPubKey);
  return tx.uncheckedSerialize();
}

export function signInputs(
  coin: Coin,
  raw: string,
  inputs: UtxoInput[],
  accountXpriv: string,
  build?: BuildTxOpts
): string[] {
  const bitcore = getLib(coin);
  const hd = new bitcore.HDPrivateKey(accountXpriv);
  const tx = build ? createTransaction(build) : (() => {
    const parsed = new bitcore.Transaction(raw);
    inputs.forEach((input, index) => {
      if (!parsed.inputs[index]) return;
      const script = input.scriptPubKey
        ? new bitcore.Script(Buffer.from(input.scriptPubKey, 'hex'))
        : bitcore.Script.fromAddress(input.address);
      parsed.inputs[index].output = new bitcore.Transaction.Output({
        satoshis: input.satoshis,
        script
      });
    });
    return parsed;
  })();
  const sigtype = sighashType(coin);

  return inputs.map((input, index) => {
    const priv = hd.deriveChild(input.path).privateKey;
    const found = tx.getSignatures(priv, sigtype).find((s: { inputIndex: number }) => s.inputIndex === index);
    if (found) return found.signature.toString();
    const subscript = input.redeemScript
      ? new bitcore.Script(Buffer.from(input.redeemScript, 'hex'))
      : tx.inputs[index].output.script;
    const hashbuf = tx.inputs[index].getSighash(tx, sigtype, index, subscript);
    return bitcore.crypto.ECDSA.sign(hashbuf, priv, 'little').set({ nhashtype: sigtype }).toString();
  });
}

export function txidFromRaw(coin: Coin, raw: string): string {
  const bitcore = getLib(coin);
  const tx = new bitcore.Transaction(raw);
  return tx.id;
}

export function isFullySigned(coin: Coin, raw: string, m: number): boolean {
  const bitcore = getLib(coin);
  try {
    const tx = new bitcore.Transaction(raw);
    if (m === 1) {
      return tx.inputs.every((input: { isFullySigned?: () => boolean }) =>
        input.isFullySigned ? input.isFullySigned() : true
      );
    }
    return tx.isFullySigned();
  } catch {
    return false;
  }
}
