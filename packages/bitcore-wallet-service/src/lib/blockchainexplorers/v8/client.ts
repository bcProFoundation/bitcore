import * as requestStream from 'request';
import * as request from 'request-promise-native';
import { URL } from 'url';
import logger from '../../logger';
import axios from 'axios';
import { Readable } from 'stream';

const bitcoreLib = require('@bcpros/bitcore-lib');
const secp256k1 = require('secp256k1');
export class Client {
  authKey: { bn: { toBuffer: (arg) => Buffer } };
  baseUrl: string;

  constructor(params) {
    Object.assign(this, params);
  }

  getMessage(params: { method: string; url: string; payload?: any }) {
    const { method, url, payload = {} } = params;
    const parsedUrl = new URL(url);
    return [method, parsedUrl.pathname + parsedUrl.search, JSON.stringify(payload)].join('|');
  }

  sign(params: { method: string; url: string; payload?: any }) {
    const message = this.getMessage(params);
    const privateKey = this.authKey.bn.toBuffer({ size: 32 });
    const messageHash = bitcoreLib.crypto.Hash.sha256sha256(Buffer.from(message));

    // TODO: Should use bitcore-lib instead of an external dependency. Will want to add tests.
    // const privateKey = bitcoreLib.PrivateKey.fromBuffer(this.authKey.bn.toBuffer({ size: 32 }));
    // const sig = bitcoreLib.crypto.ECDSA.sign(messageHash, privateKey);
    // return Buffer.concat([ sig.r.toBuffer(), sig.s.toBuffer() ]);
    return Buffer.from(secp256k1.ecdsaSign(messageHash, privateKey).signature).toString('hex');
  }

  async register(params) {
    const { payload } = params;
    // allow you to overload the client's baseUrl
    const { baseUrl = this.baseUrl } = payload;
    const url = `${baseUrl}/wallet`;
    const signature = this.sign({ method: 'POST', url, payload });
    return request.post(url, {
      headers: { 'x-signature': signature },
      body: payload,
      json: true
    });
  }

  async getBalance(params) {
    const { payload, pubKey, tokenAddress, multisigContractAddress } = params;
    let query = '';
    let apiUrl = `${this.baseUrl}/wallet/${pubKey}/balance`;

    if (tokenAddress) {
      query = `?tokenAddress=${tokenAddress}`;
    }

    if (multisigContractAddress) {
      apiUrl = `${this.baseUrl}/address/${multisigContractAddress}/balance`;
    }

    const url = apiUrl + query;
    const signature = this.sign({ method: 'GET', url, payload });
    return request.get(url, {
      headers: { 'x-signature': signature },
      body: payload,
      json: true
    });
  }

  async getCheckData(params) {
    const { payload, pubKey } = params;
    const url = `${this.baseUrl}/wallet/${pubKey}/check`;
    logger.debug('WALLET CHECK');
    const signature = this.sign({ method: 'GET', url, payload });
    return request.get(url, {
      headers: { 'x-signature': signature },
      body: payload,
      json: true
    });
  }

  async getAddressTxos(params) {
    const { unspent, address } = params;
    const args = unspent ? `?unspent=${unspent}` : '';
    const url = `${this.baseUrl}/address/${address}${args}`;
    return request.get(url, {
      json: true
    });
  }

  async getTx(params) {
    const { txid } = params;
    const url = `${this.baseUrl}/tx/${txid}`;
    return request.get(url, {
      json: true
    });
  }

  async getCoins(params) {
    const { payload, pubKey, includeSpent } = params;

    var extra = '';
    if (includeSpent) {
      extra = `?includeSpent=${includeSpent}`;
    }
    const url = `${this.baseUrl}/wallet/${pubKey}/utxos${extra}`;
    logger.debug('GET UTXOS: %o', url);
    const signature = this.sign({ method: 'GET', url, payload });
    return request.get(url, {
      headers: { 'x-signature': signature },
      body: payload,
      json: true
    });
  }

  async getCoinsForTx(params) {
    const { txId } = params;
    const url = `${this.baseUrl}/tx/${txId}/coins`;
    logger.debug('GET COINS FOR TX: %o', url);
    return request.get(url, {
      json: true
    });
  }

  async listTransactions(params): Promise<Readable> {
    const {
      pubKey,
      startBlock,
      startDate,
      endBlock,
      endDate,
      includeMempool,
      tokenAddress,
      multisigContractAddress
    } = params;
    let query = '';
    let apiUrl = `${this.baseUrl}/wallet/${pubKey}/transactions?`;
    if (startBlock) {
      query += `startBlock=${startBlock}&`;
    }
    if (endBlock) {
      query += `endBlock=${endBlock}&`;
    }
    if (tokenAddress) {
      query += `tokenAddress=${tokenAddress}&`;
    }
    if (multisigContractAddress) {
      apiUrl = `${this.baseUrl}/ethmultisig/transactions/${multisigContractAddress}?`;
    }
    if (includeMempool) {
      query += 'includeMempool=true';
    }
    const url = apiUrl + query;
    const signature = this.sign({ method: 'GET', url });
    logger.debug('List transactions %o', url);
    return axios({
      method: 'get',
      url,
      headers: { 'x-signature': signature },
      responseType: 'stream'
    }).then(response => response.data);  // return the stream
  }

  async importAddresses(params) {
    const { payload, pubKey } = params;
    const url = `${this.baseUrl}/wallet/${pubKey}`;

    logger.debug('addAddresses: %o %o', url, payload);
    const signature = this.sign({ method: 'POST', url, payload });
    const h = { 'x-signature': signature };
    if (params.reprocess) {
      h['x-reprocess'] = params.reprocess;
    }
    return request.post(url, {
      headers: h,
      body: payload,
      json: true
    });
  }

  async broadcast(params) {
    const { payload } = params;
    const url = `${this.baseUrl}/tx/send`;
    logger.debug('Broadcast %o', url);
    return request.post(url, { body: payload, json: true });
  }
}
