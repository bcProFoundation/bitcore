import { Key } from '../../derivation';

export class BTCTxProvider {
  lib = require('@bcpros/bitcore-lib');

  selectCoins(
    recipients: Array<{ amount: number }>,
    utxos: Array<{
      value: number;
      mintHeight: number;
      txid?: string;
      mintTxid?: string;
      mintIndex?: number;
    }>,
    fee: number
  ) {
    utxos = utxos.sort(function(a, b) {
      return a.mintHeight - b.mintHeight;
    });

    let index = 0;
    let utxoSum = 0;
    let recepientSum = recipients.reduce((sum, cur) => sum + Number(cur.amount), fee || 0);
    while (utxoSum < recepientSum) {
      const utxo = utxos[index];
      utxoSum += Number(utxo.value);
      index += 1;
    }
    const filteredUtxos = utxos.slice(0, index);
    return filteredUtxos;
  }

  create({ recipients, utxos = [], change, feeRate, fee, isSweep, replaceByFee, lockUntilDate, lockUntilBlock }) {
    const filteredUtxos = isSweep ? utxos : this.selectCoins(recipients, utxos, fee);
    const btcUtxos = filteredUtxos.map(utxo => {
      const btcUtxo = Object.assign({}, utxo, {
        amount: utxo.value / 1e8,
        txid: utxo.mintTxid,
        outputIndex: utxo.mintIndex
      });
      return new this.lib.Transaction.UnspentOutput(btcUtxo);
    });
    let tx = new this.lib.Transaction().from(btcUtxos);
    if (fee) {
      tx.fee(fee);
    }
    if (feeRate) {
      tx.feePerByte(Number(feeRate));
    }
    if (change) {
      tx.change(change);
    }
    for (const recipient of recipients) {
      tx.to(recipient.address, parseInt(recipient.amount));
    }
    if (replaceByFee && typeof tx.enableRBF === 'function') {
      tx.enableRBF();
    }
    if (lockUntilBlock > 0) {
      tx.lockUntilBlockHeight(lockUntilBlock);
    } else if (lockUntilDate > 0) {
      tx.lockUntilDate(lockUntilDate);
    }
    return tx.uncheckedSerialize();
  }

  getSignature(params: { tx: string; keys: Array<Key> }) {
    throw new Error('function getSignature not implemented for UTXO coins');
  }

  applySignature(params: { tx: string; keys: Array<Key> }) {
    throw new Error('function applySignature not implemented for UTXO coins');
  }

  getHash(params: { tx: string }) {
    const bitcoreTx = new this.lib.Transaction(params.tx);
    return bitcoreTx.hash;
  }

  sign(params: { tx: string; keys: Array<Key>; utxos: any[]; pubkeys?: any[]; threshold?: number; opts: any }) {
    const { tx, keys, pubkeys, threshold, opts } = params;
    let utxos = params.utxos || [];
    let bitcoreTx = new this.lib.Transaction(tx);
    let applicableUtxos = this.getRelatedUtxos({
      outputs: bitcoreTx.inputs,
      utxos
    });
    bitcoreTx.associateInputs(applicableUtxos, pubkeys, threshold, opts);
    const uniqePrivKeys = Object.values(keys.reduce((map, key) => {
      // Need to preserve (un)compressed property, so don't use key.privKey.toString();
      const pk = new this.lib.PrivateKey(key.privKey);
      map[pk.publicKey.toString()] = pk;
      return map;
    }, {}));
    const signedTx = bitcoreTx.sign(uniqePrivKeys).toString();
    return signedTx;
  }

  getRelatedUtxos({ outputs, utxos }) {
    let txids = outputs.map(output => output.toObject().prevTxId);
    let applicableUtxos = utxos.filter(utxo => txids.includes(utxo.txid || utxo.mintTxid));
    return applicableUtxos.map(utxo => {
      const btcUtxo = Object.assign({}, utxo, {
        amount: utxo.value / Math.pow(10, 8),
        txid: utxo.mintTxid,
        outputIndex: utxo.mintIndex
      });
      return new this.lib.Transaction.UnspentOutput(btcUtxo);
    });
  }

  getOutputsFromTx({ tx }) {
    return tx.outputs.map(({ script, satoshis }) => {
      let address = script;
      return { address, satoshis };
    });
  }

  getSigningAddresses({ tx, utxos }): string[] {
    let bitcoreTx = new this.lib.Transaction(tx);
    let applicableUtxos = this.getRelatedUtxos({
      outputs: bitcoreTx.inputs,
      utxos
    });
    return applicableUtxos.map(utxo => utxo.address);
  }
}
