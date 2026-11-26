import { expect } from 'chai';
import crypto from 'crypto';
import { Deriver } from '../src';

describe('IDeriver', function () {
  describe('getPublicKey (Buffer-first)', () => {
    it('BTC: should derive the compressed secp256k1 public key', () => {
      // Well-known secp256k1 test vector: private key 1 maps to generator point G.
      const privHex = '0000000000000000000000000000000000000000000000000000000000000001';
      const expectedPubKey = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
      const privBuf = Deriver.privateKeyToBuffer('BTC', privHex);
      try {
        const pubKey = Deriver.getPublicKey('BTC', 'testnet', privBuf);

        expect(pubKey).to.equal(expectedPubKey);
        expect(pubKey).to.match(/^(02|03)/);
        expect(pubKey).to.have.length(66);
      } finally {
        privBuf.fill(0);
      }
    });
  
  
  
  });

  describe('privateKeyToBuffer', function () {


  });
});


