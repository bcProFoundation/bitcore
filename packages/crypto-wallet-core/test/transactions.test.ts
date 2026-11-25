import { expect } from 'chai';
import { ethers } from 'ethers';
import bitcoreLib from '@bcpros/bitcore-lib';
import bitcoreLibCash from '@bcpros/bitcore-lib-cash';
import bitcoreLibDoge from '@bcpros/bitcore-lib-doge';
import bitcoreLibLtc from '@bcpros/bitcore-lib-ltc';
import { Constants, Transactions } from '../src';

describe('Transaction', function () {
  const libs = {
    BTC: bitcoreLib,
    BCH: bitcoreLibCash,
    DOGE: bitcoreLibDoge,
    LTC: bitcoreLibLtc
  };
  describe('create', () => {
    it('should create a BTC tx', () => {
      const recipients = [{ address: 'mpNpzMoprLnSBu8CWDunNCYeJq3Mzdk59V', amount: 1e8 }];
      const change = 'msnAsQcCdtzDyiSWb4ZnNxFwUy3P9ogQvY';
      const utxos = [
        {
          mintTxid: '643ec66d6c4cad4cbdb8ed2166b8078975e0af9bb7ff7e30d394f43b0d9f18ab',
          mintIndex: 1,
          value: 0.02503422 * 1e8,
          script: '76a91457884dcfe2ab46d3354a42d97333c95e5b80cf0188ac',
          address: 'moVnNJpHHfssYJEnMTS5xXyGV8RhRQNRz5',
          sequenceNumber: 4294967294
        },
        {
          mintTxid: '643ec66d6c4cad4cbdb8ed2166b8078975e0af9bb7ff7e30d394f43b0d9f18ab',
          mintIndex: 0,
          value: 1e8,
          script: '76a9144e744a19a009a9dd43a23a7c12045c83e82ac9d288ac',
          address: 'mnfnJx2xWWptYmBzck3rdE851Dtu9GaZ3F',
          sequenceNumber: 4294967294
        }
      ];
      const fee = 7440;
      const tx = Transactions.create({ chain: 'BTC', recipients, change, utxos, fee, rbf: true });

      const keys = [
        {
          address: 'mnfnJx2xWWptYmBzck3rdE851Dtu9GaZ3F',
          privKey: 'cSFjiifSbZ2hU4jTFwE993LCe2rkZGULCTGWTDWXzHvuXRKxpnc1'
        },
        { address: 'moVnNJpHHfssYJEnMTS5xXyGV8RhRQNRz5', privKey: 'cUWVirwp5vh1D6WWbYci3tuGniyf28ERpgU4uL5VSiFDfvNEhJqy' }
      ];
      const signed = Transactions.sign({ chain: 'BTC', tx, keys, utxos });
      const expected =
        '0200000002ab189f0d3bf494d3307effb79bafe0758907b86621edb8bd4cad4c6c6dc63e64010000006a47304402202eeb967801c0aad4f8241d8f90e2a9e2236f95c189165ba6b2ba4dc6b17bacbe02201b5d4dc0c32f6aa134d93698f85bf4c098d15fcbaada0b6ca2b8076fd8aa2741012102c8f8fa438666cbd287e28fb384b99555e4acce610e8141e887c9c458bba5db5cffffffffab189f0d3bf494d3307effb79bafe0758907b86621edb8bd4cad4c6c6dc63e64000000006a473044022072bdde2c0b413fc42d15d93e768a26f818dc5b225b9359235c09fd0452d6121a022007c00afa396d60d5b7919f2ba31e638817561cab4e2afed7a86dd636ee293c1001210321f2f13aed42db7257b64f77d574071a6e81e460ab3693eefb7482c12d1ff697ffffffff0200e1f505000000001976a914612fb4d5e27a28f5c54018d8948ca3a650741c4188acee152600000000001976a91486823ef7c8e210184cc8675189d37c4c9d8e1e0288ac00000000';
      expect(signed).to.eq(expected);
    });

    describe('every utxo type: bitcore-node, UnspentOutput, and UnspentOutput.toObject', () => {
      const keys = [{
        address: 'mnfnJx2xWWptYmBzck3rdE851Dtu9GaZ3F',
        privKey: 'cSFjiifSbZ2hU4jTFwE993LCe2rkZGULCTGWTDWXzHvuXRKxpnc1'
      }];

      const bitcoreNodeUtxos =
        [
          {
            mintTxid: '643ec66d6c4cad4cbdb8ed2166b8078975e0af9bb7ff7e30d394f43b0d9f18ab',
            mintIndex: 1,
            mintHeight: 100,
            value: 90_000,
            script: '76a9144e744a19a009a9dd43a23a7c12045c83e82ac9d288ac',
            address: 'mnfnJx2xWWptYmBzck3rdE851Dtu9GaZ3F',
            sequenceNumber: 4294967294
          },
          {
            mintTxid: '643ec66d6c4cad4cbdb8ed2166b8078975e0af9bb7ff7e30d394f43b0d9f18ab',
            mintIndex: 0,
            mintHeight: 100,
            value: 30_000,
            script: '76a9144e744a19a009a9dd43a23a7c12045c83e82ac9d288ac',
            address: 'mnfnJx2xWWptYmBzck3rdE851Dtu9GaZ3F',
            sequenceNumber: 4294967294
          }
        ];
      
      const unspentOutputToObjectUtxos = [
        {
          txid: '643ec66d6c4cad4cbdb8ed2166b8078975e0af9bb7ff7e30d394f43b0d9f18ab',
          outputIndex: 1,
          amount: 0.0009,
          scriptPubKey: '76a9144e744a19a009a9dd43a23a7c12045c83e82ac9d288ac'
        },
        {
          txid: '643ec66d6c4cad4cbdb8ed2166b8078975e0af9bb7ff7e30d394f43b0d9f18ab',
          vout: 0,
          amount: 0.0003,
          scriptPubKey: '76a9144e744a19a009a9dd43a23a7c12045c83e82ac9d288ac'
        }
      ];

      const recipients = [{ address: 'moVnNJpHHfssYJEnMTS5xXyGV8RhRQNRz5', amount: 100_000 }];
      for (const chain of ['BTC', 'BCH', 'DOGE', 'LTC']) {
        const unspentOutputUtxos = [
          new libs[chain].Transaction.UnspentOutput({
            txId: '643ec66d6c4cad4cbdb8ed2166b8078975e0af9bb7ff7e30d394f43b0d9f18ab',
            outputIndex: 1,
            satoshis: 90_000,
            script: '76a9144e744a19a009a9dd43a23a7c12045c83e82ac9d288ac'
          }),
          new libs[chain].Transaction.UnspentOutput({
            txId: '643ec66d6c4cad4cbdb8ed2166b8078975e0af9bb7ff7e30d394f43b0d9f18ab',
            outputIndex: 0,
            satoshis: 30_000,
            script: '76a9144e744a19a009a9dd43a23a7c12045c83e82ac9d288ac'
          })
        ];
        const utxoSet = [
          bitcoreNodeUtxos,
          unspentOutputUtxos,
          unspentOutputToObjectUtxos
        ];
        let tx: string;
        const lib = libs[chain];
        it(`should create a tx with every utxo type for ${chain}`, () => {
          const txs = utxoSet.map(utxos => Transactions.create({
            chain,
            recipients,
            utxos
          }));
          
          tx = txs[0];
          for (const _tx of txs.slice(1)) {
            expect(tx, 'all transactions should be the same regardless of the utxo format').to.equal(_tx);
          }
          
          let expectedTx: string;
          if (chain === 'DOGE') {
            expectedTx = '0100000002ab189f0d3bf494d3307effb79bafe0758907b86621edb8bd4cad4c6c6dc63e640100000000ffffffffab189f0d3bf494d3307effb79bafe0758907b86621edb8bd4cad4c6c6dc63e640000000000ffffffff01a0860100000000001976a91457884dcfe2ab46d3354a42d97333c95e5b80cf0188ac00000000';
          } else {
            expectedTx = '0200000002ab189f0d3bf494d3307effb79bafe0758907b86621edb8bd4cad4c6c6dc63e640100000000ffffffffab189f0d3bf494d3307effb79bafe0758907b86621edb8bd4cad4c6c6dc63e640000000000ffffffff01a0860100000000001976a91457884dcfe2ab46d3354a42d97333c95e5b80cf0188ac00000000';
          }
          expect(tx).to.equal(expectedTx);
        });

        it(`should sign a tx with every utxo type ${chain}`, () => {
          const signedTxs = utxoSet.map(utxos => Transactions.sign({
            chain,
            tx,
            utxos,
            keys,
            sigtype: lib.crypto.Signature.SIGHASH_ALL
          }));
          const signedTx = signedTxs[0];
          for (const _signedTx of signedTxs.slice(1)) {
            expect(signedTx, 'signed transactions should all be the same regardless of utxo type').to.equal(_signedTx);
          }

          let expectedTx: string;
          if (chain === 'DOGE') {
            expectedTx = '0100000002ab189f0d3bf494d3307effb79bafe0758907b86621edb8bd4cad4c6c6dc63e64010000006a473044022015ceee1da23792e26cd1215c8327a35978c8b0494de9e69bab6d31ab3d0b56ad02205f9299162591672c6cde3d92d5819a11e1ad9f353a25d7a3ce494877ef27468901210321f2f13aed42db7257b64f77d574071a6e81e460ab3693eefb7482c12d1ff697ffffffffab189f0d3bf494d3307effb79bafe0758907b86621edb8bd4cad4c6c6dc63e64000000006b4830450221009f0b5dd0b4c0bd9bcf804e71020705eb9bda99a31cb2a4d123c364bdd394adeb022016939a51fb03c9efea4b7d53a7b90d7a3667fff71cd8365e366c81b1fdd0d3e001210321f2f13aed42db7257b64f77d574071a6e81e460ab3693eefb7482c12d1ff697ffffffff01a0860100000000001976a91457884dcfe2ab46d3354a42d97333c95e5b80cf0188ac00000000';
          } else {
            expectedTx = '0200000002ab189f0d3bf494d3307effb79bafe0758907b86621edb8bd4cad4c6c6dc63e64010000006b483045022100c74ab4fe359e8efc73fc28dce989e28da47d3b45eb06ee305dfc0e675da8700802201076a067337a3c6b90fad2077a55154aa150460cb842bc86373026eb071a7ac901210321f2f13aed42db7257b64f77d574071a6e81e460ab3693eefb7482c12d1ff697ffffffffab189f0d3bf494d3307effb79bafe0758907b86621edb8bd4cad4c6c6dc63e64000000006b483045022100ed22907cc96b5367ef469225f7f718efa8fb4eb2dc5fbf3909777c5f024cf5e902206480082ad9b413a8a76128ab147287da30d907cfb1a159be814392fa1138012801210321f2f13aed42db7257b64f77d574071a6e81e460ab3693eefb7482c12d1ff697ffffffff01a0860100000000001976a91457884dcfe2ab46d3354a42d97333c95e5b80cf0188ac00000000';
          }
          expect(signedTx).to.equal(expectedTx);
        });
        
        it(`should create valid sighashes for all utxo types ${chain}`, () => {
          const bitcoreTx = lib.Transaction()
            .from(unspentOutputUtxos)
            .to(recipients[0].address, recipients[0].amount);
          const signedTx = lib.Transaction()
            .from(unspentOutputUtxos)
            .to(recipients[0].address, recipients[0].amount);
          
          for (let index = 0; index < unspentOutputUtxos.length; index++) {
            const sighashes: string[] = [];
            for (const utxos of utxoSet) {
              sighashes.push(Transactions.getSighash({
                chain,
                tx,
                utxos,
                index,
                sigtype: lib.crypto.Signature.SIGHASH_ALL
              }));
            }
            
            // getSighash should work without utxos if a complete lib transaction is provided
            sighashes.push(Transactions.getSighash({
              chain,
              tx: bitcoreTx,
              index,
              sigtype: lib.crypto.Signature.SIGHASH_ALL
            }));

            const sighash = sighashes[0];
            for (const hash of sighashes) {
              expect(sighash).to.equal(hash);
            }
            expect(sighash.length).to.equal(64);
            const privateKey = new lib.PrivateKey(keys[0].privKey);
            const publicKey = privateKey.toPublicKey();
            const signature = lib.crypto.ECDSA.sign(Buffer.from(sighash, 'hex'), privateKey);
            signature.pubKey = publicKey;

            Transactions.applySignature({
              chain,
              tx: signedTx,
              signature,
              index
            });
          }
          if (chain === 'DOGE') {
            const serializedSignedTx = '0100000002ab189f0d3bf494d3307effb79bafe0758907b86621edb8bd4cad4c6c6dc63e64010000006a473044022015ceee1da23792e26cd1215c8327a35978c8b0494de9e69bab6d31ab3d0b56ad02205f9299162591672c6cde3d92d5819a11e1ad9f353a25d7a3ce494877ef27468901210321f2f13aed42db7257b64f77d574071a6e81e460ab3693eefb7482c12d1ff697ffffffffab189f0d3bf494d3307effb79bafe0758907b86621edb8bd4cad4c6c6dc63e64000000006b4830450221009f0b5dd0b4c0bd9bcf804e71020705eb9bda99a31cb2a4d123c364bdd394adeb022016939a51fb03c9efea4b7d53a7b90d7a3667fff71cd8365e366c81b1fdd0d3e001210321f2f13aed42db7257b64f77d574071a6e81e460ab3693eefb7482c12d1ff697ffffffff01a0860100000000001976a91457884dcfe2ab46d3354a42d97333c95e5b80cf0188ac00000000';
            expect(signedTx.serialize({ disableSmallFees: true, disableDustOutputs: true })).to.equal(serializedSignedTx);
          } else {
            const serializedSignedTx = '0200000002ab189f0d3bf494d3307effb79bafe0758907b86621edb8bd4cad4c6c6dc63e64010000006b483045022100c74ab4fe359e8efc73fc28dce989e28da47d3b45eb06ee305dfc0e675da8700802201076a067337a3c6b90fad2077a55154aa150460cb842bc86373026eb071a7ac901210321f2f13aed42db7257b64f77d574071a6e81e460ab3693eefb7482c12d1ff697ffffffffab189f0d3bf494d3307effb79bafe0758907b86621edb8bd4cad4c6c6dc63e64000000006b483045022100ed22907cc96b5367ef469225f7f718efa8fb4eb2dc5fbf3909777c5f024cf5e902206480082ad9b413a8a76128ab147287da30d907cfb1a159be814392fa1138012801210321f2f13aed42db7257b64f77d574071a6e81e460ab3693eefb7482c12d1ff697ffffffff01a0860100000000001976a91457884dcfe2ab46d3354a42d97333c95e5b80cf0188ac00000000';
            expect(signedTx.serialize()).to.equal(serializedSignedTx);
          }
        });
      }
    });

    it('should sign a BTC opreturn tx', () => {
      const tx =
        '0200000001ab189f0d3bf494d3307effb79bafe0758907b86621edb8bd4cad4c6c6dc63e640100000000ffffffff0200000000000000000b6a096a07696f6e3a61626340420f00000000001976a91457884dcfe2ab46d3354a42d97333c95e5b80cf0188ac00000000';
      const utxos = [
        {
          mintTxid: '643ec66d6c4cad4cbdb8ed2166b8078975e0af9bb7ff7e30d394f43b0d9f18ab',
          mintIndex: 1,
          value: 0.02503422 * 1e8,
          script: '76a91457884dcfe2ab46d3354a42d97333c95e5b80cf0188ac',
          address: 'moVnNJpHHfssYJEnMTS5xXyGV8RhRQNRz5',
          sequenceNumber: 4294967294
        }
      ];
      const keys = [
        {
          address: 'mnfnJx2xWWptYmBzck3rdE851Dtu9GaZ3F',
          privKey: 'cSFjiifSbZ2hU4jTFwE993LCe2rkZGULCTGWTDWXzHvuXRKxpnc1'
        },
        { address: 'moVnNJpHHfssYJEnMTS5xXyGV8RhRQNRz5', privKey: 'cUWVirwp5vh1D6WWbYci3tuGniyf28ERpgU4uL5VSiFDfvNEhJqy' }
      ];
      const signed = Transactions.sign({ chain: 'BTC', tx, keys, utxos });
      const expected =
        '0200000001ab189f0d3bf494d3307effb79bafe0758907b86621edb8bd4cad4c6c6dc63e64010000006b483045022100a3e6e04d311930ec19b11033e77d973ae37181ead6b2db582ec1c21028c469350220602faacf6f6753b271571452e4597205971ab1d790e60080d50c206c8c327f86012102c8f8fa438666cbd287e28fb384b99555e4acce610e8141e887c9c458bba5db5cffffffff0200000000000000000b6a096a07696f6e3a61626340420f00000000001976a91457884dcfe2ab46d3354a42d97333c95e5b80cf0188ac00000000';
      expect(signed).to.eq(expected);
    });

    it('should sign a BTC tx with uncompressed pubkey inputs', () => {
      const uncompPk = new bitcoreLib.PrivateKey({ bn: '86d32c754853c7d5788d101f0aa5c3ea4da69c0f42ffc3f7403aafba23112b0c', network: 'mainnet', compressed: false });
      const uncompAddy = uncompPk.publicKey.toAddress();
      const compPk = new bitcoreLib.PrivateKey('86d32c754853c7d5788d101f0aa5c3ea4da69c0f42ffc3f7403aafba23112b0c');
      const compAddy = compPk.publicKey.toAddress();

      const tx = new bitcoreLib.Transaction();
      const utxos = [{
        mintTxid: '643ec66d6c4cad4cbdb8ed2166b8078975e0af9bb7ff7e30d394f43b0d9f18ab',
        mintIndex: 0,
        value: 1e8,
        address: uncompAddy,
        script: bitcoreLib.Script.fromAddress(uncompAddy)
      }, {
        mintTxid: '643ec66d6c4cad4cbdb8ed2166b8078975e0af9bb7ff7e30d394f43b0d9f18ab',
        mintIndex: 1,
        value: 1e8,
        address: compAddy,
        script: bitcoreLib.Script.fromAddress(compAddy)
      }];
      const bitcoreUtxos = utxos.map(utxo => new bitcoreLib.Transaction.UnspentOutput({ txid: utxo.mintTxid, vout: utxo.mintIndex, satoshis: utxo.value, ...utxo }));
      tx.from(bitcoreUtxos);
      tx.change('mpNpzMoprLnSBu8CWDunNCYeJq3Mzdk59V');
      expect(tx.inputs.every(input => input._scriptBuffer?.length === 0)).to.be.true;

      const keys = [{ privKey: uncompPk, address: uncompAddy.toString() }, { privKey: compPk, address: compAddy.toString() }];
      const signed = Transactions.sign({ chain: 'BTC', tx: tx.uncheckedSerialize(), utxos, keys });
      const signedTx = new bitcoreLib.Transaction(signed);
      expect(signedTx.inputs.every(input => input._scriptBuffer?.length > 0)).to.be.true;
    });

    it.skip('should fail to get signatures on a BTC txs', () => {
      // TODO !!
    });































    it('should create a DOGE tx', () => {
      const recipients = [{ address: 'mpNpzMoprLnSBu8CWDunNCYeJq3Mzdk59V', amount: 1e8 }];
      const change = 'msnAsQcCdtzDyiSWb4ZnNxFwUy3P9ogQvY';
      const utxos = [
        {
          mintTxid: '643ec66d6c4cad4cbdb8ed2166b8078975e0af9bb7ff7e30d394f43b0d9f18ab',
          mintIndex: 1,
          value: 0.02503422 * 1e8,
          script: '76a91457884dcfe2ab46d3354a42d97333c95e5b80cf0188ac',
          address: 'moVnNJpHHfssYJEnMTS5xXyGV8RhRQNRz5',
          sequenceNumber: 4294967294
        },
        {
          mintTxid: '643ec66d6c4cad4cbdb8ed2166b8078975e0af9bb7ff7e30d394f43b0d9f18ab',
          mintIndex: 0,
          value: 1e8,
          script: '76a9144e744a19a009a9dd43a23a7c12045c83e82ac9d288ac',
          address: 'mnfnJx2xWWptYmBzck3rdE851Dtu9GaZ3F',
          sequenceNumber: 4294967294
        }
      ];
      const fee = 7440;
      const tx = Transactions.create({ chain: 'DOGE', recipients, change, utxos, fee, rbf: true });

      const keys = [
        {
          address: 'mnfnJx2xWWptYmBzck3rdE851Dtu9GaZ3F',
          privKey: 'cSFjiifSbZ2hU4jTFwE993LCe2rkZGULCTGWTDWXzHvuXRKxpnc1'
        },
        { address: 'moVnNJpHHfssYJEnMTS5xXyGV8RhRQNRz5', privKey: 'cUWVirwp5vh1D6WWbYci3tuGniyf28ERpgU4uL5VSiFDfvNEhJqy' }
      ];
      const signed = Transactions.sign({ chain: 'DOGE', tx, keys, utxos });
      const expected =
        '0100000002ab189f0d3bf494d3307effb79bafe0758907b86621edb8bd4cad4c6c6dc63e64010000006b483045022100b4fb37f92fb4ec7007166c415d59d888c9526b4550e3ed111e615cfe0e63ba9a022003381d0c43cf3e0762926f4fdff05a2d16fc0e62d59d79a9ca69646d1595b887012102c8f8fa438666cbd287e28fb384b99555e4acce610e8141e887c9c458bba5db5cffffffffab189f0d3bf494d3307effb79bafe0758907b86621edb8bd4cad4c6c6dc63e64000000006a47304402207b4a0deed6371e8ad46bcae7a9a098d99f2210d44600bab72bccba747ef7554c02207678fb99e91275c4fc7d5665371fb935cb789b4e0ad5a880780513368cca8b4b01210321f2f13aed42db7257b64f77d574071a6e81e460ab3693eefb7482c12d1ff697ffffffff0200e1f505000000001976a914612fb4d5e27a28f5c54018d8948ca3a650741c4188acee152600000000001976a91486823ef7c8e210184cc8675189d37c4c9d8e1e0288ac00000000';
      expect(signed).to.eq(expected);
    });

    it('should create a LTC tx', () => {
      const recipients = [{ address: 'mpNpzMoprLnSBu8CWDunNCYeJq3Mzdk59V', amount: 1e8 }];
      const change = 'msnAsQcCdtzDyiSWb4ZnNxFwUy3P9ogQvY';
      const utxos = [
        {
          mintTxid: '643ec66d6c4cad4cbdb8ed2166b8078975e0af9bb7ff7e30d394f43b0d9f18ab',
          mintIndex: 1,
          value: 0.02503422 * 1e8,
          script: '76a91457884dcfe2ab46d3354a42d97333c95e5b80cf0188ac',
          address: 'moVnNJpHHfssYJEnMTS5xXyGV8RhRQNRz5',
          sequenceNumber: 4294967294
        },
        {
          mintTxid: '643ec66d6c4cad4cbdb8ed2166b8078975e0af9bb7ff7e30d394f43b0d9f18ab',
          mintIndex: 0,
          value: 1e8,
          script: '76a9144e744a19a009a9dd43a23a7c12045c83e82ac9d288ac',
          address: 'mnfnJx2xWWptYmBzck3rdE851Dtu9GaZ3F',
          sequenceNumber: 4294967294
        }
      ];
      const fee = 7440;
      const tx = Transactions.create({ chain: 'LTC', recipients, change, utxos, fee, rbf: true });

      const keys = [
        {
          address: 'mnfnJx2xWWptYmBzck3rdE851Dtu9GaZ3F',
          privKey: 'cSFjiifSbZ2hU4jTFwE993LCe2rkZGULCTGWTDWXzHvuXRKxpnc1'
        },
        { address: 'moVnNJpHHfssYJEnMTS5xXyGV8RhRQNRz5', privKey: 'cUWVirwp5vh1D6WWbYci3tuGniyf28ERpgU4uL5VSiFDfvNEhJqy' }
      ];
      const signed = Transactions.sign({ chain: 'LTC', tx, keys, utxos });
      const expected =
        '0200000002ab189f0d3bf494d3307effb79bafe0758907b86621edb8bd4cad4c6c6dc63e64010000006a47304402202eeb967801c0aad4f8241d8f90e2a9e2236f95c189165ba6b2ba4dc6b17bacbe02201b5d4dc0c32f6aa134d93698f85bf4c098d15fcbaada0b6ca2b8076fd8aa2741012102c8f8fa438666cbd287e28fb384b99555e4acce610e8141e887c9c458bba5db5cffffffffab189f0d3bf494d3307effb79bafe0758907b86621edb8bd4cad4c6c6dc63e64000000006a473044022072bdde2c0b413fc42d15d93e768a26f818dc5b225b9359235c09fd0452d6121a022007c00afa396d60d5b7919f2ba31e638817561cab4e2afed7a86dd636ee293c1001210321f2f13aed42db7257b64f77d574071a6e81e460ab3693eefb7482c12d1ff697ffffffff0200e1f505000000001976a914612fb4d5e27a28f5c54018d8948ca3a650741c4188acee152600000000001976a91486823ef7c8e210184cc8675189d37c4c9d8e1e0288ac00000000';
      expect(signed).to.eq(expected);
    });



  });

  describe('getMutableFields', () => {


  });

  describe('sign', () => {






  });

  describe('getSignature', function() {

  });

  describe('applyTransaction', function() {
    describe('BTC', function() {
      const chain = 'BTC';
      const network = 'regtest';
      const lib = bitcoreLib;
      const privkey = new lib.PrivateKey('65a1c4421a01e07355a59aa4d7d2b2ebd4d14e3c3ce0c239b9081a523c5d69ba', network);
      const pubkey = privkey.toPublicKey();
      const to = 'bcrt1qxerc45n2rv360s8z3wj67fdq93h22m5gstud4z';
      const change = pubkey.toAddress(network, 'p2pkh');

      it('should apply signature to a P2PK tx', function() {
        const tx = new lib.Transaction()
          .from({
            txid: 'ba50b12d89162134c31a89ae1f289a1c86fe0a2e7c1861768296408090e30864',
            vout: 0,
            satoshis: 1e9,
            script: lib.Script.buildPublicKeyOut(pubkey).toString()
          })
          .to(to, 1234)
          .change(change);

        const signature = tx.inputs[0].getSignatures(tx, privkey, 0)[0];
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signed = Transactions.applySignature({ chain, tx, signature, index: 0 });
        expect(signed).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(true);
        expect(() => tx.serialize()).to.not.throw();
      });

      it('should apply signature to a P2PKH tx', function() {
        const addy = pubkey.toAddress(network, 'p2pkh');
        const tx = new lib.Transaction()
          .from({
            txid: 'ba50b12d89162134c31a89ae1f289a1c86fe0a2e7c1861768296408090e30864',
            vout: 0,
            satoshis: 1e9,
            script: lib.Script.fromAddress(addy)
          })
          .to(to, 1234)
          .change(change);

        const signature = tx.inputs[0].getSignatures(tx, privkey, 0)[0];
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signed = Transactions.applySignature({ chain, tx, signature, index: 0 });
        expect(signed).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(true);
        expect(() => tx.serialize()).to.not.throw();
      });

      it('should apply signature to a P2SH tx', function() {
        const addy = pubkey.toAddress(network, 'p2sh');
        const tx = new lib.Transaction()
          .from({
            txid: 'ba50b12d89162134c31a89ae1f289a1c86fe0a2e7c1861768296408090e30864',
            vout: 0,
            satoshis: 1e9,
            script: lib.Script.fromAddress(addy)
          })
          .to(to, 1234)
          .change(change);

        const signature = tx.inputs[0].getSignatures(tx, privkey, 0)[0];
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signed = Transactions.applySignature({ chain, tx, signature, index: 0 });
        expect(signed).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(true);
        expect(() => tx.serialize()).to.not.throw();
      });

      it('should apply signature to a P2WPKH tx', function() {
        const addy = pubkey.toAddress(network, 'p2wpkh');
        const tx = new lib.Transaction()
          .from({
            txid: 'ba50b12d89162134c31a89ae1f289a1c86fe0a2e7c1861768296408090e30864',
            vout: 0,
            satoshis: 1e9,
            script: lib.Script.fromAddress(addy)
          })
          .to(to, 1234)
          .change(change);

        const signature = tx.inputs[0].getSignatures(tx, privkey, 0)[0];
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signed = Transactions.applySignature({ chain, tx, signature, index: 0 });
        expect(signed).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(true);
        expect(() => tx.serialize()).to.not.throw();
      });

      it('should apply signature to a multisig P2SH tx', function() {
        const privkey2 = new lib.PrivateKey('61059599ffc27072ccb7a7ddbe32c031433bf3b7bf1e128b0b4e80a6c68c027e', network);
        const pubkey2 = privkey2.toPublicKey();
        const privkey3 = new lib.PrivateKey('4fac3c5338abc4cd27ef98ad1122215dc4651c4f30c9c59ebe7b33dc416ec33e', network);
        const pubkey3 = privkey3.toPublicKey();
        const addy = lib.Address.createMultisig([pubkey, pubkey2, pubkey3], 2, network, false); // p2sh
        const tx = new lib.Transaction()
          .from({
            txid: 'ba50b12d89162134c31a89ae1f289a1c86fe0a2e7c1861768296408090e30864',
            vout: 0,
            satoshis: 1e9,
            script: lib.Script.fromAddress(addy).toString()
          }, [pubkey, pubkey2, pubkey3], 2)
          .to(to, 1234)
          .change(change);

        const signature2 = tx.inputs[0].getSignatures(tx, privkey2, 0)[0];
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signed2 = Transactions.applySignature({ chain, tx, signature: signature2, index: 0 });
        expect(signed2).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signature3 = tx.inputs[0].getSignatures(tx, privkey3, 0)[0];
        const signed3 = Transactions.applySignature({ chain, tx, signature: signature3, index: 0 });
        expect(signed3).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(true);
        expect(() => tx.serialize()).to.not.throw();
      });

      it('should apply signature to a multisig P2WSH tx', function() {
        const privkey2 = new lib.PrivateKey('61059599ffc27072ccb7a7ddbe32c031433bf3b7bf1e128b0b4e80a6c68c027e', network);
        const pubkey2 = privkey2.toPublicKey();
        const privkey3 = new lib.PrivateKey('4fac3c5338abc4cd27ef98ad1122215dc4651c4f30c9c59ebe7b33dc416ec33e', network);
        const pubkey3 = privkey3.toPublicKey();
        const addy = lib.Address.createMultisig([pubkey, pubkey2, pubkey3], 2, network, true); // p2wsh
        const tx = new lib.Transaction()
          .from({
            txid: 'ba50b12d89162134c31a89ae1f289a1c86fe0a2e7c1861768296408090e30864',
            vout: 0,
            satoshis: 1e9,
            script: lib.Script.fromAddress(addy).toString()
          }, [pubkey, pubkey2, pubkey3], 2)
          .to(to, 1234)
          .change(change);

        const signature2 = tx.inputs[0].getSignatures(tx, privkey2, 0)[0];
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signed2 = Transactions.applySignature({ chain, tx, signature: signature2, index: 0 });
        expect(signed2).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signature3 = tx.inputs[0].getSignatures(tx, privkey3, 0)[0];
        const signed3 = Transactions.applySignature({ chain, tx, signature: signature3, index: 0 });
        expect(signed3).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(true);
        expect(() => tx.serialize()).to.not.throw();
      });

      it('should apply signature to a P2TR tx', function() {
        const addy = pubkey.toAddress(network, 'p2tr');
        const tx = new lib.Transaction()
          .from({
            txid: 'ba50b12d89162134c31a89ae1f289a1c86fe0a2e7c1861768296408090e30864',
            vout: 0,
            satoshis: 1e9,
            script: lib.Script.fromAddress(addy).toString()
          })
          .to(to, 1234)
          .change(change);

        const signature = tx.inputs[0].getSignatures(tx, privkey, 0)[0];
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signed = Transactions.applySignature({ chain, tx, signature, index: 0 });
        expect(signed).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(true);
        expect(() => tx.serialize()).to.not.throw();
      });
    });

    describe('BCH', function() {
      const chain = 'BCH';
      const network = 'regtest';
      const lib = bitcoreLibCash;
      const privkey = new lib.PrivateKey('65a1c4421a01e07355a59aa4d7d2b2ebd4d14e3c3ce0c239b9081a523c5d69ba', network);
      const pubkey = privkey.toPublicKey();
      const to = 'qzpjx6cvau7tunx0hxvr4czrrllm0ecd95gz8y5euh';
      const change = pubkey.toAddress(network, 'p2pkh');

      it('should apply signature to a P2PK tx', function() {
        const tx = new lib.Transaction()
          .from({
            txid: 'ba50b12d89162134c31a89ae1f289a1c86fe0a2e7c1861768296408090e30864',
            vout: 0,
            satoshis: 1e9,
            script: lib.Script.buildPublicKeyOut(pubkey).toString()
          })
          .to(to, 1234)
          .change(change);

        const signature = tx.inputs[0].getSignatures(tx, privkey, 0)[0];
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signed = Transactions.applySignature({ chain, tx, signature, index: 0 });
        expect(signed).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(true);
        expect(() => tx.serialize()).to.not.throw();
      });

      it('should apply signature to a P2PKH tx', function() {
        const addy = pubkey.toAddress(network, 'p2pkh');
        const tx = new lib.Transaction()
          .from({
            txid: 'ba50b12d89162134c31a89ae1f289a1c86fe0a2e7c1861768296408090e30864',
            vout: 0,
            satoshis: 1e9,
            script: lib.Script.fromAddress(addy)
          })
          .to(to, 1234)
          .change(change);

        const signature = tx.inputs[0].getSignatures(tx, privkey, 0)[0];
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signed = Transactions.applySignature({ chain, tx, signature, index: 0 });
        expect(signed).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(true);
        expect(() => tx.serialize()).to.not.throw();
      });

      it.skip('should apply signature to a P2SH tx', function() {
        // single-sig P2SH is not completely supported in bitcore-lib-cash due to it's unusual usage, unlike BTC and LTC
        // skipping this test for now but leaving it as a possibility if/when we add full P2SH support in bitcore-lib-cash
        const addy = pubkey.toAddress(network, 'p2sh');
        const tx = new lib.Transaction()
          .from({
            txid: 'ba50b12d89162134c31a89ae1f289a1c86fe0a2e7c1861768296408090e30864',
            vout: 0,
            satoshis: 1e9,
            script: lib.Script.fromAddress(addy)
          })
          .to(to, 1234)
          .change(change);

        const signature = tx.inputs[0].getSignatures(tx, privkey, 0)[0];
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signed = Transactions.applySignature({ chain, tx, signature, index: 0 });
        expect(signed).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(true);
        expect(() => tx.serialize()).to.not.throw();
      });

      it('should apply signature to a multisig P2SH tx', function() {
        const privkey2 = new lib.PrivateKey('61059599ffc27072ccb7a7ddbe32c031433bf3b7bf1e128b0b4e80a6c68c027e', network);
        const pubkey2 = privkey2.toPublicKey();
        const privkey3 = new lib.PrivateKey('4fac3c5338abc4cd27ef98ad1122215dc4651c4f30c9c59ebe7b33dc416ec33e', network);
        const pubkey3 = privkey3.toPublicKey();
        const addy = lib.Address.createMultisig([pubkey, pubkey2, pubkey3], 2, network, false); // p2sh
        const tx = new lib.Transaction()
          .from({
            txid: 'ba50b12d89162134c31a89ae1f289a1c86fe0a2e7c1861768296408090e30864',
            vout: 0,
            satoshis: 1e9,
            script: lib.Script.fromAddress(addy).toString()
          }, [pubkey, pubkey2, pubkey3], 2)
          .to(to, 1234)
          .change(change);

        const signature2 = tx.inputs[0].getSignatures(tx, privkey2, 0)[0];
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signed2 = Transactions.applySignature({ chain, tx, signature: signature2, index: 0 });
        expect(signed2).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signature3 = tx.inputs[0].getSignatures(tx, privkey3, 0)[0];
        const signed3 = Transactions.applySignature({ chain, tx, signature: signature3, index: 0 });
        expect(signed3).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(true);
        expect(() => tx.serialize()).to.not.throw();
      });

      it('should apply signature to an escrow tx', function() {
        const privkey2 = new lib.PrivateKey('61059599ffc27072ccb7a7ddbe32c031433bf3b7bf1e128b0b4e80a6c68c027e', network);
        const pubkey2 = privkey2.toPublicKey();
        const privkey3 = new lib.PrivateKey('4fac3c5338abc4cd27ef98ad1122215dc4651c4f30c9c59ebe7b33dc416ec33e', network);
        const pubkey3 = privkey3.toPublicKey();
        const addy = lib.Address.createMultisig([pubkey, pubkey2, pubkey3], 2, network, false); // p2sh
        const tx = new lib.Transaction()
          .from({
            txid: 'ba50b12d89162134c31a89ae1f289a1c86fe0a2e7c1861768296408090e30864',
            vout: 0,
            satoshis: 1e9,
            script: lib.Script.fromAddress(addy).toString()
          }, [pubkey, pubkey2, pubkey3], 2)
          .to(to, 1234)
          .change(change);

        const signature2 = tx.inputs[0].getSignatures(tx, privkey2, 0)[0];
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signed2 = Transactions.applySignature({ chain, tx, signature: signature2, index: 0 });
        expect(signed2).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signature3 = tx.inputs[0].getSignatures(tx, privkey3, 0)[0];
        const signed3 = Transactions.applySignature({ chain, tx, signature: signature3, index: 0 });
        expect(signed3).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(true);
        expect(() => tx.serialize()).to.not.throw();
      });
    });

    describe('DOGE', function() {
      const chain = 'DOGE';
      const network = 'regtest';
      const lib = bitcoreLibDoge;
      const privkey = new lib.PrivateKey('65a1c4421a01e07355a59aa4d7d2b2ebd4d14e3c3ce0c239b9081a523c5d69ba', network);
      const pubkey = privkey.toPublicKey();
      const to = 'mwHPw7Vtty66L9znjDY2NhFB2wJG7Lw42v';
      const change = pubkey.toAddress(network, 'p2pkh');

      it('should apply signature to a P2PK tx', function() {
        const tx = new lib.Transaction()
          .from({
            txid: 'ba50b12d89162134c31a89ae1f289a1c86fe0a2e7c1861768296408090e30864',
            vout: 0,
            satoshis: 1e9,
            script: lib.Script.buildPublicKeyOut(pubkey).toString()
          })
          .to(to, 1e7)
          .change(change);

        const signature = tx.inputs[0].getSignatures(tx, privkey, 0)[0];
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signed = Transactions.applySignature({ chain, tx, signature, index: 0 });
        expect(signed).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(true);
        expect(() => tx.serialize()).to.not.throw();
      });

      it('should apply signature to a P2PKH tx', function() {
        const addy = pubkey.toAddress(network, 'p2pkh');
        const tx = new lib.Transaction()
          .from({
            txid: 'ba50b12d89162134c31a89ae1f289a1c86fe0a2e7c1861768296408090e30864',
            vout: 0,
            satoshis: 1e9,
            script: lib.Script.fromAddress(addy)
          })
          .to(to, 1e7)
          .change(change);

        const signature = tx.inputs[0].getSignatures(tx, privkey, 0)[0];
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signed = Transactions.applySignature({ chain, tx, signature, index: 0 });
        expect(signed).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(true);
        expect(() => tx.serialize()).to.not.throw();
      });

      it.skip('should apply signature to a P2SH tx', function() {
        // single-sig P2SH is not completely supported in bitcore-lib-doge due to it's unusual usage, unlike BTC and LTC
        // skipping this test for now but leaving it as a possibility if/when we add full P2SH support in bitcore-lib-doge
        const addy = pubkey.toAddress(network, 'p2sh');
        const tx = new lib.Transaction()
          .from({
            txid: 'ba50b12d89162134c31a89ae1f289a1c86fe0a2e7c1861768296408090e30864',
            vout: 0,
            satoshis: 1e9,
            script: lib.Script.fromAddress(addy)
          })
          .to(to, 1e7)
          .change(change);

        const signature = tx.inputs[0].getSignatures(tx, privkey, 0)[0];
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signed = Transactions.applySignature({ chain, tx, signature, index: 0 });
        expect(signed).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(true);
        expect(() => tx.serialize()).to.not.throw();
      });

      it('should apply signature to a multisig P2SH tx', function() {
        const privkey2 = new lib.PrivateKey('61059599ffc27072ccb7a7ddbe32c031433bf3b7bf1e128b0b4e80a6c68c027e', network);
        const pubkey2 = privkey2.toPublicKey();
        const privkey3 = new lib.PrivateKey('4fac3c5338abc4cd27ef98ad1122215dc4651c4f30c9c59ebe7b33dc416ec33e', network);
        const pubkey3 = privkey3.toPublicKey();
        const addy = lib.Address.createMultisig([pubkey, pubkey2, pubkey3], 2, network, false); // p2sh
        const tx = new lib.Transaction()
          .from({
            txid: 'ba50b12d89162134c31a89ae1f289a1c86fe0a2e7c1861768296408090e30864',
            vout: 0,
            satoshis: 1e9,
            script: lib.Script.fromAddress(addy).toString()
          }, [pubkey, pubkey2, pubkey3], 2)
          .to(to, 1e7)
          .change(change);

        const signature2 = tx.inputs[0].getSignatures(tx, privkey2, 0)[0];
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signed2 = Transactions.applySignature({ chain, tx, signature: signature2, index: 0 });
        expect(signed2).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signature3 = tx.inputs[0].getSignatures(tx, privkey3, 0)[0];
        const signed3 = Transactions.applySignature({ chain, tx, signature: signature3, index: 0 });
        expect(signed3).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(true);
        expect(() => tx.serialize()).to.not.throw();
      });
    });

    describe('LTC', function() {
      const chain = 'LTC';
      const network = 'regtest';
      const lib = bitcoreLibLtc;
      const privkey = new lib.PrivateKey('65a1c4421a01e07355a59aa4d7d2b2ebd4d14e3c3ce0c239b9081a523c5d69ba', network);
      const pubkey = privkey.toPublicKey();
      const to = 'rltc1q6tvvdn702mmfnu0ujdkw97qw9aac9xm2c6wgk6';
      const change = pubkey.toAddress(network, 'p2pkh');

      it('should apply signature to a P2PK tx', function() {
        const tx = new lib.Transaction()
          .from({
            txid: 'ba50b12d89162134c31a89ae1f289a1c86fe0a2e7c1861768296408090e30864',
            vout: 0,
            satoshis: 1e9,
            script: lib.Script.buildPublicKeyOut(pubkey).toString()
          })
          .to(to, 1e4)
          .change(change);

        const signature = tx.inputs[0].getSignatures(tx, privkey, 0)[0];
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signed = Transactions.applySignature({ chain, tx, signature, index: 0 });
        expect(signed).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(true);
        expect(() => tx.serialize()).to.not.throw();
      });

      it('should apply signature to a P2PKH tx', function() {
        const addy = pubkey.toAddress(network, 'p2pkh');
        const tx = new lib.Transaction()
          .from({
            txid: 'ba50b12d89162134c31a89ae1f289a1c86fe0a2e7c1861768296408090e30864',
            vout: 0,
            satoshis: 1e9,
            script: lib.Script.fromAddress(addy)
          })
          .to(to, 1e4)
          .change(change);

        const signature = tx.inputs[0].getSignatures(tx, privkey, 0)[0];
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signed = Transactions.applySignature({ chain, tx, signature, index: 0 });
        expect(signed).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(true);
        expect(() => tx.serialize()).to.not.throw();
      });

      it('should apply signature to a P2SH tx', function() {
        const addy = pubkey.toAddress(network, 'p2sh');
        const tx = new lib.Transaction()
          .from({
            txid: 'ba50b12d89162134c31a89ae1f289a1c86fe0a2e7c1861768296408090e30864',
            vout: 0,
            satoshis: 1e9,
            script: lib.Script.fromAddress(addy)
          })
          .to(to, 1e4)
          .change(change);

        const signature = tx.inputs[0].getSignatures(tx, privkey, 0)[0];
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signed = Transactions.applySignature({ chain, tx, signature, index: 0 });
        expect(signed).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(true);
        expect(() => tx.serialize()).to.not.throw();
      });

      it('should apply signature to a P2WPKH tx', function() {
        const addy = pubkey.toAddress(network, 'p2wpkh');
        const tx = new lib.Transaction()
          .from({
            txid: 'ba50b12d89162134c31a89ae1f289a1c86fe0a2e7c1861768296408090e30864',
            vout: 0,
            satoshis: 1e9,
            script: lib.Script.fromAddress(addy)
          })
          .to(to, 1e4)
          .change(change);

        const signature = tx.inputs[0].getSignatures(tx, privkey, 0)[0];
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signed = Transactions.applySignature({ chain, tx, signature, index: 0 });
        expect(signed).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(true);
        expect(() => tx.serialize()).to.not.throw();
      });

      it('should apply signature to a multisig P2SH tx', function() {
        const privkey2 = new lib.PrivateKey('61059599ffc27072ccb7a7ddbe32c031433bf3b7bf1e128b0b4e80a6c68c027e', network);
        const pubkey2 = privkey2.toPublicKey();
        const privkey3 = new lib.PrivateKey('4fac3c5338abc4cd27ef98ad1122215dc4651c4f30c9c59ebe7b33dc416ec33e', network);
        const pubkey3 = privkey3.toPublicKey();
        const addy = lib.Address.createMultisig([pubkey, pubkey2, pubkey3], 2, network, false); // p2sh
        const tx = new lib.Transaction()
          .from({
            txid: 'ba50b12d89162134c31a89ae1f289a1c86fe0a2e7c1861768296408090e30864',
            vout: 0,
            satoshis: 1e9,
            script: lib.Script.fromAddress(addy).toString()
          }, [pubkey, pubkey2, pubkey3], 2)
          .to(to, 1e4)
          .change(change);

        const signature2 = tx.inputs[0].getSignatures(tx, privkey2, 0)[0];
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signed2 = Transactions.applySignature({ chain, tx, signature: signature2, index: 0 });
        expect(signed2).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signature3 = tx.inputs[0].getSignatures(tx, privkey3, 0)[0];
        const signed3 = Transactions.applySignature({ chain, tx, signature: signature3, index: 0 });
        expect(signed3).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(true);
        expect(() => tx.serialize()).to.not.throw();
      });

      it('should apply signature to a multisig P2WSH tx', function() {
        const privkey2 = new lib.PrivateKey('61059599ffc27072ccb7a7ddbe32c031433bf3b7bf1e128b0b4e80a6c68c027e', network);
        const pubkey2 = privkey2.toPublicKey();
        const privkey3 = new lib.PrivateKey('4fac3c5338abc4cd27ef98ad1122215dc4651c4f30c9c59ebe7b33dc416ec33e', network);
        const pubkey3 = privkey3.toPublicKey();
        const addy = lib.Address.createMultisig([pubkey, pubkey2, pubkey3], 2, network, true); // p2wsh
        const tx = new lib.Transaction()
          .from({
            txid: 'ba50b12d89162134c31a89ae1f289a1c86fe0a2e7c1861768296408090e30864',
            vout: 0,
            satoshis: 1e9,
            script: lib.Script.fromAddress(addy).toString()
          }, [pubkey, pubkey2, pubkey3], 2)
          .to(to, 1e4)
          .change(change);

        const signature2 = tx.inputs[0].getSignatures(tx, privkey2, 0)[0];
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signed2 = Transactions.applySignature({ chain, tx, signature: signature2, index: 0 });
        expect(signed2).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(false);
        const signature3 = tx.inputs[0].getSignatures(tx, privkey3, 0)[0];
        const signed3 = Transactions.applySignature({ chain, tx, signature: signature3, index: 0 });
        expect(signed3).to.equal(tx);
        expect(tx.inputs[0].isFullySigned()).to.equal(true);
        expect(() => tx.serialize()).to.not.throw();
      });
    });











  });

  describe('getHash', function() {




  });





});
