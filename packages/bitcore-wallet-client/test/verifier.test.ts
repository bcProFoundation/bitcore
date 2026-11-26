'use strict';

import chai from 'chai';
import 'chai/register-should';
import sinon from 'sinon';
import { BitcoreLib, Constants } from '@bcpros/crypto-wallet-core';
import { Utils } from '../src/lib/common';
import { PayProV2 } from '../src/lib/payproV2';
import { Verifier } from '../src/lib/verifier';
import { Key } from '../src/lib/key';
import log from '../src/lib/log';

chai.should();

const aKey = new Key({
  seedData: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  seedType: 'mnemonic'
});

describe('Verifier', function() {
  describe('checkPaypro', function() {
    const amount = 10000;
    const addresses = {
      btc: [
        '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA',
        '1BoatSLRHtKNngkdXEeobR76b53LETtpyT'
      ],
      bch: {
        cashaddr: 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        legacy: 'CTH8H8Zj6DSnXFBKQeDG28ogAS92iS16Bp',
        different: 'bitcoincash:qr95sy3j9xwd2ap32xkykttr4cvcu7as4y0qverfuy'
      },
      doge: [
        'DBtUjAUFWHqS1y8CgetQtPW6YKDhffyFT4',
        'D77Z1nmgSZxJTmtN65n2MVF9yvLSB4MpiC'
      ],
      ltc: [
        'LQqWdV81RmiEzXoACvWDQPZEXXU1Q16suH',
        'Lcyaicjq2aFgcgRX5mDhhQkXN8RFvzWowa'
      ]
    };
    // Equivalent-but-not-identical-string encodings that a chain's own address
    // library treats as the same destination. Bech32 forms below are derived
    // from a fixed test-only private key scalar so they are deterministic and
    // independently reproducible; the P2SH pair is the ticket's own fixture.
    const equivalenceFixtures = {
      btcBech32: {
        lower: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        upper: 'BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4'
      },
      ltcBech32: {
        lower: 'ltc1qw508d6qejxtdg4y5r3zarvary0c5xw7kgmn4n9',
        upper: 'LTC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KGMN4N9'
      },
      ltcP2sh: {
        legacy: '3GueMn6ruWVfQTN4XKBGEbCbGLwRSUhfnS',
        modern: 'MP7nffWprdM6CxdxdCAc4ESzb3XsQQPZMp'
      }
    };
    const supportedChains = ['btc', 'bch', 'doge', 'ltc'];
    const addressFor = chain => chain === 'bch' ? addresses.bch.cashaddr : addresses[chain][0];
    const differentAddressFor = chain => chain === 'bch' ? addresses.bch.different : addresses[chain][1];
    const createTxp = (chain, overrides = {}) => ({
      version: 3,
      chain,
      coin: chain,
      network: 'livenet',
      amount,
      outputs: [{ toAddress: addressFor(chain), amount }],
      ...overrides
    });
    const createPaypro = (chain, overrides = {}) => ({
      chain,
      network: 'livenet',
      instructions: [{ toAddress: addressFor(chain), amount }],
      ...overrides
    });

    const matchingCases = [
      {
        description: 'accepts matching BTC PayPro destination and amount',
        chain: 'btc'
      },
      {
        description: 'accepts matching DOGE PayPro destination and amount',
        chain: 'doge'
      },
      {
        description: 'accepts matching LTC PayPro destination and amount',
        chain: 'ltc'
      }
    ];
    for (const testCase of matchingCases) {
      it(testCase.description, function() {
        Verifier.checkPaypro(
          createTxp(testCase.chain),
          createPaypro(testCase.chain)
        ).should.equal(true);
      });
    }

    const destinationMismatchCases = [
      {
        description: 'rejects a BTC PayPro destination mismatch with the correct amount',
        chain: 'btc'
      },
      {
        description: 'rejects a DOGE PayPro destination mismatch with the correct amount',
        chain: 'doge'
      },
      {
        description: 'rejects an LTC PayPro destination mismatch with the correct amount',
        chain: 'ltc'
      }
    ];
    for (const testCase of destinationMismatchCases) {
      it(testCase.description, function() {
        const paypro = createPaypro(testCase.chain, {
          instructions: [{
            toAddress: differentAddressFor(testCase.chain),
            amount
          }]
        });
        Verifier.checkPaypro(createTxp(testCase.chain), paypro).should.equal(false);
      });
    }

    it('accepts equivalent BCH cashaddr and legacy destinations', function() {
      const txp = createTxp('bch', {
        outputs: [{ toAddress: addresses.bch.legacy, amount }]
      });
      Verifier.checkPaypro(txp, createPaypro('bch')).should.equal(true);
    });

    it('rejects a different BCH PayPro destination with the correct amount', function() {
      const paypro = createPaypro('bch', {
        instructions: [{ toAddress: addresses.bch.different, amount }]
      });
      Verifier.checkPaypro(createTxp('bch'), paypro).should.equal(false);
    });

    it('rejects an amount mismatch for every supported multisig chain', function() {
      for (const chain of supportedChains) {
        const paypro = createPaypro(chain, {
          instructions: [{ toAddress: addressFor(chain), amount: amount + 1 }]
        });
        chai.expect(Verifier.checkPaypro(createTxp(chain), paypro), chain).to.equal(false);
      }
    });

    it('rejects an unsupported chain instead of accepting it by default', function() {
      const txp = createTxp('btc', { chain: 'unsupportedchain' });
      Verifier.checkPaypro(txp, createPaypro('btc')).should.equal(false);
    });

    it('rejects missing transaction or PayPro data without throwing', function() {
      const cases = [
        { txp: null, paypro: createPaypro('btc') },
        { txp: createTxp('btc'), paypro: null }
      ];
      for (const testCase of cases) {
        let result;
        chai.expect(() => {
          result = Verifier.checkPaypro(testCase.txp, testCase.paypro);
        }).not.to.throw();
        chai.expect(result).to.equal(false);
      }
    });

    it('rejects invalid transaction proposal versions instead of coercing them', function() {
      const invalidVersions = [undefined, null, true, {}, [], [3], 0, -1, 1.5, '', ' ', '3x'];
      for (const version of invalidVersions) {
        chai.expect(
          Verifier.checkPaypro(createTxp('btc', { version }), createPaypro('btc')),
          String(version)
        ).to.equal(false);
      }
    });

    const malformedInstructionCases = [
      { description: 'rejects missing PayPro instructions without throwing', paypro: {} },
      { description: 'rejects empty PayPro instructions without throwing', paypro: { instructions: [] } }
    ];
    for (const testCase of malformedInstructionCases) {
      it(testCase.description, function() {
        let result;
        chai.expect(() => {
          result = Verifier.checkPaypro(createTxp('btc'), testCase.paypro);
        }).not.to.throw();
        chai.expect(result).to.equal(false);
      });
    }

    const malformedOutputCases = [
      { description: 'rejects a version 3 proposal with missing outputs without throwing', outputs: undefined },
      { description: 'rejects a version 3 proposal with empty outputs without throwing', outputs: [] }
    ];
    for (const testCase of malformedOutputCases) {
      it(testCase.description, function() {
        let result;
        chai.expect(() => {
          result = Verifier.checkPaypro(
            createTxp('btc', { outputs: testCase.outputs }),
            createPaypro('btc')
          );
        }).not.to.throw();
        chai.expect(result).to.equal(false);
      });
    }

    it('logs the entry index and invalid field for malformed outputs and instructions', function() {
      const warn = sinon.stub(log, 'warn');
      try {
        const outputs = [
          { toAddress: addresses.btc[0], amount: 5000 },
          { toAddress: ' ', amount: 5000 }
        ];
        const instructions = [
          { toAddress: addresses.btc[0], amount: 5000 },
          { toAddress: addresses.btc[1], amount: 5000 }
        ];
        Verifier.checkPaypro(
          createTxp('btc', { id: 'txp-id', outputs }),
          createPaypro('btc', { instructions })
        ).should.equal(false);
        sinon.assert.calledOnceWithExactly(
          warn,
          '[TXP txp-id] PayPro verification failed: transaction output at index 1 has an invalid destination address'
        );

        warn.resetHistory();
        instructions[1] = { toAddress: addresses.btc[1], amount: -1 };
        outputs[1] = { toAddress: addresses.btc[1], amount: 5000 };
        Verifier.checkPaypro(
          createTxp('btc', { id: 'txp-id', outputs }),
          createPaypro('btc', { instructions })
        ).should.equal(false);
        sinon.assert.calledOnceWithExactly(
          warn,
          '[TXP txp-id] PayPro verification failed: PayPro instruction at index 1 has an invalid amount'
        );
      } finally {
        warn.restore();
      }
    });

    const unparseableBchCases = [
      {
        description: 'rejects an unparseable BCH proposal destination without throwing',
        txp: createTxp('bch', { outputs: [{ toAddress: 'not-a-bch-address', amount }] }),
        paypro: createPaypro('bch')
      },
      {
        description: 'rejects an unparseable BCH PayPro destination without throwing',
        txp: createTxp('bch'),
        paypro: createPaypro('bch', {
          instructions: [{ toAddress: 'not-a-bch-address', amount }]
        })
      }
    ];
    for (const testCase of unparseableBchCases) {
      it(testCase.description, function() {
        let result;
        chai.expect(() => {
          result = Verifier.checkPaypro(testCase.txp, testCase.paypro);
        }).not.to.throw();
        chai.expect(result).to.equal(false);
      });
    }

    const addressEquivalenceCases = [
      {
        description: 'accepts equivalent BTC Bech32 case forms',
        chain: 'btc',
        outputAddress: equivalenceFixtures.btcBech32.lower,
        instructionAddress: equivalenceFixtures.btcBech32.upper
      },
      {
        description: 'accepts equivalent LTC Bech32 case forms',
        chain: 'ltc',
        outputAddress: equivalenceFixtures.ltcBech32.lower,
        instructionAddress: equivalenceFixtures.ltcBech32.upper
      },
      {
        description: 'accepts equivalent LTC legacy 3... and modern M... P2SH destinations',
        chain: 'ltc',
        outputAddress: equivalenceFixtures.ltcP2sh.legacy,
        instructionAddress: equivalenceFixtures.ltcP2sh.modern
      }
    ];
    for (const testCase of addressEquivalenceCases) {
      it(testCase.description, function() {
        const txp = createTxp(testCase.chain, {
          outputs: [{ toAddress: testCase.outputAddress, amount }]
        });
        const paypro = createPaypro(testCase.chain, {
          instructions: [{ toAddress: testCase.instructionAddress, amount }]
        });
        Verifier.checkPaypro(txp, paypro).should.equal(true);
      });
    }

    const identicalMalformedDestinationChains = ['btc', 'bch', 'doge', 'ltc'];
    for (const chain of identicalMalformedDestinationChains) {
      it(`rejects identical malformed ${chain.toUpperCase()} destinations without throwing`, function() {
        const malformed = 'not-a-real-address!!!';
        const txp = createTxp(chain, { outputs: [{ toAddress: malformed, amount }] });
        const paypro = createPaypro(chain, { instructions: [{ toAddress: malformed, amount }] });
        let result;
        chai.expect(() => {
          result = Verifier.checkPaypro(txp, paypro);
        }).not.to.throw();
        chai.expect(result).to.equal(false);
      });

      it(`rejects a malformed ${chain.toUpperCase()} proposal destination with a valid PayPro instruction`, function() {
        const malformed = 'not-a-real-address!!!';
        const txp = createTxp(chain, { outputs: [{ toAddress: malformed, amount }] });
        let result;
        chai.expect(() => {
          result = Verifier.checkPaypro(txp, createPaypro(chain));
        }).not.to.throw();
        chai.expect(result).to.equal(false);
      });

      it(`rejects a malformed ${chain.toUpperCase()} PayPro instruction with a valid proposal destination`, function() {
        const malformed = 'not-a-real-address!!!';
        const paypro = createPaypro(chain, {
          instructions: [{ toAddress: malformed, amount }]
        });
        let result;
        chai.expect(() => {
          result = Verifier.checkPaypro(createTxp(chain), paypro);
        }).not.to.throw();
        chai.expect(result).to.equal(false);
      });
    }

    const legacyCases = [
      { chain: 'btc' },
      { chain: 'bch' },
      { chain: 'doge' },
      { chain: 'ltc' }
    ];
    for (const testCase of legacyCases) {
      it(`rejects legacy ${testCase.chain.toUpperCase()} transaction proposals`, function() {
        const txp = createTxp(testCase.chain, {
          version: 2,
          chain: undefined,
          toAddress: addressFor(testCase.chain),
          outputs: undefined
        });
        Verifier.checkPaypro(txp, createPaypro(testCase.chain)).should.equal(false);
      });

      it(`rejects a legacy ${testCase.chain.toUpperCase()} transaction proposal destination mismatch`, function() {
        const txp = createTxp(testCase.chain, {
          version: 2,
          chain: undefined,
          toAddress: differentAddressFor(testCase.chain),
          outputs: undefined
        });
        Verifier.checkPaypro(txp, createPaypro(testCase.chain)).should.equal(false);
      });
    }

    it('accepts a proposal whose complete output set matches all PayPro instructions', function() {
      const txp = createTxp('btc', {
        outputs: [
          { toAddress: addresses.btc[1], amount: 4000 },
          { toAddress: addresses.btc[0], amount: 6000 }
        ]
      });
      const paypro = createPaypro('btc', {
        instructions: [
          { toAddress: addresses.btc[0], amount: 6000 },
          { toAddress: addresses.btc[1], amount: 4000 }
        ]
      });
      Verifier.checkPaypro(txp, paypro).should.equal(true);
    });

    it('accepts matching duplicate output and instruction pairs', function() {
      const entries = [
        { toAddress: addresses.btc[0], amount: 5000 },
        { toAddress: addresses.btc[0], amount: 5000 }
      ];
      const txp = createTxp('btc', { outputs: entries });
      const paypro = createPaypro('btc', { instructions: entries });
      Verifier.checkPaypro(txp, paypro).should.equal(true);
    });

    it('rejects a proposal when a non-first PayPro destination is changed', function() {
      const txp = createTxp('btc', {
        outputs: [
          { toAddress: addresses.btc[0], amount: 6000 },
          { toAddress: addresses.btc[1], amount: 4000 }
        ]
      });
      const paypro = createPaypro('btc', {
        instructions: [
          { toAddress: addresses.btc[0], amount: 6000 },
          { toAddress: '1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp', amount: 4000 }
        ]
      });
      Verifier.checkPaypro(txp, paypro).should.equal(false);
    });

    it('rejects different output and instruction counts even when totals match', function() {
      const txp = createTxp('btc');
      const paypro = createPaypro('btc', {
        instructions: [
          { toAddress: addresses.btc[0], amount: 6000 },
          { toAddress: addresses.btc[1], amount: 4000 }
        ]
      });
      Verifier.checkPaypro(txp, paypro).should.equal(false);
    });

    it('rejects an output amount change even when the proposal total still matches', function() {
      const txp = createTxp('btc', {
        outputs: [
          { toAddress: addresses.btc[0], amount: 5000 },
          { toAddress: addresses.btc[1], amount: 5000 }
        ]
      });
      const paypro = createPaypro('btc', {
        instructions: [
          { toAddress: addresses.btc[0], amount: 6000 },
          { toAddress: addresses.btc[1], amount: 4000 }
        ]
      });
      Verifier.checkPaypro(txp, paypro).should.equal(false);
    });

    it('rejects an output total that differs from the transaction amount', function() {
      const txp = createTxp('btc', {
        outputs: [{ toAddress: addresses.btc[0], amount: amount + 1 }]
      });
      Verifier.checkPaypro(txp, createPaypro('btc')).should.equal(false);
    });

  });

  describe('checkTxProposal PayPro boundary', function() {
    const amount = 10000;
    const merchantAddress = 'LQqWdV81RmiEzXoACvWDQPZEXXU1Q16suH';
    const substitutedAddress = 'Lcyaicjq2aFgcgRX5mDhhQkXN8RFvzWowa';
    const paypro = {
      chain: 'ltc',
      network: 'livenet',
      instructions: [{ toAddress: merchantAddress, amount }]
    };
    const createTxp = toAddress => ({
      version: 3,
      chain: 'ltc',
      coin: 'ltc',
      network: 'livenet',
      amount,
      outputs: [{ toAddress, amount }]
    });
    let checkTxProposalSignatureStub;

    beforeEach(function() {
      checkTxProposalSignatureStub = sinon
        .stub(Verifier, 'checkTxProposalSignature')
        .returns(true);
    });

    afterEach(function() {
      checkTxProposalSignatureStub.restore();
    });

    it('does not run PayPro comparison when no PayPro response is supplied', function() {
      const checkPayproStub = sinon.stub(Verifier, 'checkPaypro');
      try {
        Verifier.checkTxProposal({}, createTxp(merchantAddress), { paypro: undefined }).should.equal(true);
        sinon.assert.notCalled(checkPayproStub);
      } finally {
        checkPayproStub.restore();
      }
    });

    it('accepts a matching LTC PayPro proposal through checkTxProposal', function() {
      Verifier.checkTxProposal({}, createTxp(merchantAddress), { paypro }).should.equal(true);
      sinon.assert.calledOnce(checkTxProposalSignatureStub);
    });

    it('rejects a substituted LTC PayPro destination through checkTxProposal', function() {
      Verifier.checkTxProposal({}, createTxp(substitutedAddress), { paypro }).should.equal(false);
      sinon.assert.calledOnce(checkTxProposalSignatureStub);
    });

    // Account-chain equivalent of the LTC boundary control above.
    const evmAddress = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
    const differentEvmAddress = '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A';
    const evmPaypro = { chain: 'eth', network: 'livenet', instructions: [{ toAddress: evmAddress, amount }] };
    const createEvmTxp = toAddress => ({
      version: 3,
      chain: 'eth',
      coin: 'eth',
      network: 'livenet',
      amount,
      outputs: [{ toAddress, amount }]
    });



    // Same destination and amount, different calldata - the destination
    // check alone is not be enough to accept an EVM PayPro proposal.
    const evmData = '0xa9059cbb0000000000000000000000009858effd232b4033e47d90003d41ec34ecaeda94000000000000000000000000000000000000000000000000000000000000989680';
    const differentEvmData = '0xa9059cbb0000000000000000000000009858effd232b4033e47d90003d41ec34ecaeda940000000000000000000000000000000000000000000000000000000000000001';
    const evmDataPaypro = { chain: 'eth', network: 'livenet', instructions: [{ toAddress: evmAddress, amount, to: evmAddress, value: amount, data: evmData }] };
    const createEvmTxpWithData = data => ({
      version: 3,
      chain: 'eth',
      coin: 'eth',
      network: 'livenet',
      amount,
      outputs: [{ toAddress: evmAddress, amount, data }]
    });


  });

  describe('checkProposalCreation', function() {
    const inputs = [
      {
        txid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        vout: 0,
        satoshis: 6000
      },
      {
        txid: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        vout: 1,
        satoshis: 5000
      }
    ];
    const createProposal = overrides => ({
      outputs: [{
        toAddress: '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA',
        amount: 10000
      }],
      ...overrides
    });
    const checkProposalCreation = (argsOverrides = {}, txpOverrides = {}) => {
      return Verifier.checkProposalCreation(
        createProposal(argsOverrides),
        createProposal(txpOverrides),
        'shared-encrypting-key'
      );
    };



    it('should accept a matching fixed fee and reordered explicit inputs', function() {
      checkProposalCreation(
        { fee: 1000n, inputs },
        {
          fee: '0x3e8',
          inputs: [
            { ...inputs[1], vout: '1', satoshis: '5000' },
            { ...inputs[0], vout: '0', satoshis: '6000' }
          ]
        }
      ).should.be.true;
    });

    it('should reject changed or invalid fixed fees', function() {
      const feePairs = [
        [1000, 1001],
        [-1, -1],
        [1.5, 1.5],
        ['01', '01'],
        ['0x', '0x'],
        ['0xgg', '0xgg']
      ];
      for (const [requestedFee, returnedFee] of feePairs) {
        checkProposalCreation({ fee: requestedFee }, { fee: returnedFee }).should.be.false;
      }
    });

    it('should compare unsafe integer fees using their represented JavaScript value', function() {
      const unsafeFee = Number.MAX_SAFE_INTEGER + 1;

      checkProposalCreation({ fee: unsafeFee }, { fee: unsafeFee }).should.be.true;
      checkProposalCreation({ fee: unsafeFee }, { fee: unsafeFee.toString() }).should.be.true;
      checkProposalCreation({ fee: unsafeFee }, { fee: unsafeFee + 2 }).should.be.false;
    });

    it('should reject changed or invalid explicit inputs', function() {
      const returnedInputSets = [
        [inputs[0]],
        [
          ...inputs,
          {
            txid: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
            vout: 2,
            satoshis: 4000
          }
        ],
        [inputs[0], { ...inputs[1], vout: 2 }],
        [{ ...inputs[0], satoshis: 6001 }, { ...inputs[1], satoshis: 4999 }],
        [inputs[0], inputs[0]]
      ];
      for (const returnedInputs of returnedInputSets) {
        checkProposalCreation({ inputs }, { inputs: returnedInputs }).should.be.false;
      }
    });

    it('should not verify fee or inputs unless explicitly requested', function() {
      checkProposalCreation(
        {},
        {
          fee: 9999,
          inputs: [{
            txid: 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
            vout: 3,
            satoshis: 1
          }]
        }
      ).should.be.true;
    });

    it('should treat a null fee as omitted', function() {
      checkProposalCreation(
        { fee: null },
        { fee: 1000 }
      ).should.be.true;
    });

    it('should treat null inputs as omitted', function() {
      checkProposalCreation(
        { inputs: null },
        { inputs }
      ).should.be.true;
    });


  });

  describe('checkPaypro', function() {
    const createPaypro = (chain, outputs) => ({
      chain,
      network: 'livenet',
      instructions: [{ outputs }]
    });
    const createTxp = (paypro, outputs) => ({
      version: 3,
      coin: paypro.chain,
      chain: paypro.chain,
      network: paypro.network,
      amount: outputs.reduce((total, output) => total + Number(output.amount), 0),
      outputs
    });
    const addresses = {
      btc: ['1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu'],
      bch: ['qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a', 'qrvcdmgpk73zyfd8pmdl9wnuld36zh9n4gms8s0u59'],
      doge: ['DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L', 'DTdKu8YgcxoXyjFCDtCeKimaZzsK27rcwT'],
      ltc: ['MTf4tP1TCNBn8dNkyxeBVoPrFCcVzxJvvh', 'MQMcJhpWHYVeQArcZR3sBgyPZxxRtnH441']
    };

    it('should verify every UTXO output address and amount', function() {
      for (const [chain, [address, otherAddress]] of Object.entries(addresses)) {
        const paypro = createPaypro(chain, [{ address, amount: 10000 }]);
        const txp = createTxp(paypro, [{ toAddress: address, amount: 10000 }]);

        Verifier.checkPaypro(txp, paypro).should.be.true;
        Verifier.checkPaypro({
          ...txp,
          outputs: [{ toAddress: otherAddress, amount: 10000 }]
        }, paypro).should.be.false;
        Verifier.checkPaypro({
          ...txp,
          outputs: [{ toAddress: address, amount: 9999 }]
        }, paypro).should.be.false;
        Verifier.checkPaypro({
          ...txp,
          outputs: [
            { toAddress: address, amount: 1 },
            { toAddress: otherAddress, amount: 9999 }
          ]
        }, paypro).should.be.false;
      }
    });

    it('should verify every output of UTXO instructions', function() {
      const outputs = [
        { address: addresses.btc[0], amount: 6000 },
        { address: addresses.btc[1], amount: 4000 }
      ];
      const paypro = createPaypro('btc', outputs);
      const txp = createTxp(paypro, outputs.map(output => ({
        toAddress: output.address,
        amount: output.amount
      })));

      Verifier.checkPaypro(txp, paypro).should.be.true;
      Verifier.checkPaypro({ ...txp, outputs: [txp.outputs[0]] }, paypro).should.be.false;
      Verifier.checkPaypro({ ...txp, outputs: [...txp.outputs].reverse() }, paypro).should.be.true;
      Verifier.checkPaypro(txp, {
        ...paypro,
        instructions: [
          { outputs: [outputs[0]] },
          { outputs: [outputs[1]] }
        ]
      }).should.be.true;
    });

    it('should accept equivalent BCH encodings and reject malformed addresses', function() {
      const paypro = createPaypro('bch', [{ address: addresses.bch[0], amount: 10000 }]);
      const txp = createTxp(paypro, [{
        toAddress: '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu',
        amount: 10000
      }]);

      Verifier.checkPaypro(txp, paypro).should.be.true;
      Verifier.checkPaypro({
        ...txp,
        outputs: [{ toAddress: 'not-an-address', amount: 10000 }]
      }, paypro).should.be.false;
    });

    it('should reject unsupported or mismatched chain, network, or instruction shape', function() {
      const paypro = createPaypro('btc', [{ address: addresses.btc[0], amount: 10000 }]);
      const txp = createTxp(paypro, [{ toAddress: addresses.btc[0], amount: 10000 }]);

      Verifier.checkPaypro({ ...txp, chain: 'doge' }, paypro).should.be.false;
      Verifier.checkPaypro({ ...txp, network: 'testnet' }, paypro).should.be.false;
      Verifier.checkPaypro(txp, { ...paypro, instructions: [] }).should.be.false;
      Verifier.checkPaypro({ ...txp, chain: 'unknown' }, { ...paypro, chain: 'unknown' }).should.be.false;
    });

    it('requires signed chain and network metadata and a supported network', function() {
      const paypro = createPaypro('btc', [{ address: addresses.btc[0], amount: 10000 }]);
      const txp = createTxp(paypro, [{ toAddress: addresses.btc[0], amount: 10000 }]);
      Verifier.checkPaypro(txp, paypro).should.be.true;
      Verifier.checkPaypro(txp, { ...paypro, chain: undefined }).should.be.false;
      Verifier.checkPaypro(txp, { ...paypro, network: undefined }).should.be.false;
      Verifier.checkPaypro({ ...txp, network: 'typo' }, { ...paypro, network: 'typo' }).should.be.false;
    });




  });

  describe('PayPro invoice and transaction builder fidelity', function() {
    const btcAddress = '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA';
    const otherBtcAddress = '1BoatSLRHtKNngkdXEeobR76b53LETtpyT';
    const evmAddress = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
    const xrpAddress = 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh';
    const solAddress = 'So11111111111111111111111111111111111111112';
    const txpFor = (chain, address, overrides = {}) => ({
      version: 3, chain, coin: chain, network: 'livenet', amount: 10000,
      outputs: [{ toAddress: address, amount: 10000 }],
      ...overrides
    });
    const invoiceFor = (chain, address) => ({
      chain, network: 'livenet',
      ...(chain === 'sol' ? { currency: 'SOL' } : {}),
      instructions: chain === 'eth'
        ? [{ to: address, value: 10000 }]
        : [{ outputs: [{ address, amount: 10000 }] }]
    });

    it('checks every nested output after real PayProV2 normalization', function() {
      const paypro = PayProV2.processResponse({
        chain: 'BTC', network: 'main', currency: 'BTC',
        instructions: [{ outputs: [
          { address: btcAddress, amount: 6000 },
          { address: otherBtcAddress, amount: 4000 }
        ] }]
      });
      // PayProV2's convenience aliases describe only the first output.
      paypro.instructions[0].amount.should.equal(6000);
      const complete = txpFor('btc', btcAddress, { outputs: [
        { toAddress: otherBtcAddress, amount: 4000 },
        { toAddress: btcAddress, amount: 6000 }
      ] });
      Verifier.checkPaypro(complete, paypro).should.equal(true);
      const incomplete = txpFor('btc', btcAddress, {
        amount: 6000, outputs: [{ toAddress: btcAddress, amount: 6000 }]
      });
      Verifier.checkPaypro(incomplete, paypro).should.equal(false);
    });


    it('does not fall back to aliases for malformed nested outputs', function() {
      for (const outputs of [undefined, null, [], {}, [null], [{ address: btcAddress }], new Array(1)]) {
        const paypro = { instructions: [{ toAddress: btcAddress, amount: 10000, outputs }] };
        chai.expect(() => Verifier.checkPaypro(txpFor('btc', btcAddress), paypro)).not.to.throw();
        Verifier.checkPaypro(txpFor('btc', btcAddress), paypro).should.equal(false);
      }
    });


    it('rejects scripts that override the verified UTXO destination during construction', function() {
      const script = BitcoreLib.Script.buildPublicKeyHashOut(otherBtcAddress).toHex();
      const txp = txpFor('btc', btcAddress, {
        addressType: 'P2PKH', sendMax: true, fee: 1000,
        inputs: [{ txid: 'a'.repeat(64), vout: 0, satoshis: 11000, address: btcAddress,
          scriptPubKey: BitcoreLib.Script.buildPublicKeyHashOut(btcAddress).toHex() }],
        outputs: [{ toAddress: btcAddress, amount: 10000, script }]
      });
      const built = Utils.buildTx(txp);
      built.outputs[0].script.toAddress().toString().should.equal(otherBtcAddress);
      Verifier.checkPaypro(txp, invoiceFor('btc', btcAddress)).should.equal(false);
    });











  });

  describe('BCH PayPro address matrix', function() {
    // All fixtures use hash 76a04053bda0a88bda5177b86a15c3b29f559873.
    // Fixed encodings keep the expected equivalence independent of the verifier.
    const fixtures = [
      {
        network: 'livenet', type: 'P2PKH',
        cash: 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        legacy: 'CTH8H8Zj6DSnXFBKQeDG28ogAS92iS16Bp',
        bitcoinLegacy: '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu'
      },
      {
        network: 'livenet', type: 'P2SH',
        cash: 'bitcoincash:ppm2qsznhks23z7629mms6s4cwef74vcwvn0h829pq',
        legacy: 'HHLN6S9BcP1JLSrMhgD5qe57iVEMFMLCBT',
        bitcoinLegacy: '3CWFddi6m4ndiGyKqzYvsFYagqDLPVMTzC'
      },
      {
        network: 'testnet', type: 'P2PKH',
        cash: 'bchtest:qpm2qsznhks23z7629mms6s4cwef74vcwvqcw003ap',
        legacy: 'mrLC19Je2BuWQDkWSTriGYPyQJXKkkBmCx',
        bitcoinLegacy: 'mrLC19Je2BuWQDkWSTriGYPyQJXKkkBmCx'
      },
      {
        network: 'testnet', type: 'P2SH',
        cash: 'bchtest:ppm2qsznhks23z7629mms6s4cwef74vcwvhanqgjxu',
        legacy: '2N44ThNe8NXHyv4bsX8AoVCXquBRW94Ls7W',
        bitcoinLegacy: '2N44ThNe8NXHyv4bsX8AoVCXquBRW94Ls7W'
      },
      {
        network: 'regtest', type: 'P2PKH',
        cash: 'bchreg:qpm2qsznhks23z7629mms6s4cwef74vcwv6ycwvz78',
        legacy: 'mrLC19Je2BuWQDkWSTriGYPyQJXKkkBmCx',
        bitcoinLegacy: 'mrLC19Je2BuWQDkWSTriGYPyQJXKkkBmCx'
      },
      {
        network: 'regtest', type: 'P2SH',
        cash: 'bchreg:ppm2qsznhks23z7629mms6s4cwef74vcwvdp9ptp96',
        legacy: '2N44ThNe8NXHyv4bsX8AoVCXquBRW94Ls7W',
        bitcoinLegacy: '2N44ThNe8NXHyv4bsX8AoVCXquBRW94Ls7W'
      }
    ];
    const encodings = fixture => ({
      cashaddr: fixture.cash,
      prefixless: fixture.cash.split(':')[1],
      uppercase: fixture.cash.toUpperCase(),
      uppercasePrefixless: fixture.cash.split(':')[1].toUpperCase(),
      legacy: fixture.legacy,
      bitcoinLegacy: fixture.bitcoinLegacy
    });
    const txpFor = (network, address) => ({
      version: 3, chain: 'bch', coin: 'bch', network, amount: 10000,
      outputs: [{ toAddress: address, amount: 10000 }]
    });
    const payproFor = (network, address) => ({
      chain: 'bch', network, currency: 'BCH',
      instructions: [{ outputs: [{ address, amount: 10000 }] }]
    });

    for (const fixture of fixtures) {
      describe(`${fixture.network} ${fixture.type}`, function() {
        for (const [name, address] of Object.entries(encodings(fixture))) {
          it(`matches ${name} against every equivalent invoice encoding`, function() {
            for (const [otherName, otherAddress] of Object.entries(encodings(fixture))) {
              chai.expect(Verifier.checkPaypro(
                txpFor(fixture.network, address), payproFor(fixture.network, otherAddress)
              ), `${name} -> ${otherName}`).to.equal(true);
            }
          });
        }

        it('rejects mixed-case and bad-checksum addresses on either side', function() {
          const [prefix, payload] = fixture.cash.split(':');
          const malformed = [
            `${prefix.toUpperCase()}:${payload}`,
            `${prefix}:${payload.toUpperCase()}`,
            payload[0].toUpperCase() + payload.slice(1),
            fixture.cash.slice(0, -1) + (fixture.cash.endsWith('q') ? 'p' : 'q'),
            fixture.bitcoinLegacy.slice(0, -1) + (fixture.bitcoinLegacy.endsWith('1') ? '2' : '1')
          ];
          for (const address of malformed) {
            for (const [proposalAddress, invoiceAddress] of [
              [address, fixture.cash], [fixture.cash, address], [address, address]
            ]) {
              chai.expect(Verifier.checkPaypro(
                txpFor(fixture.network, proposalAddress), payproFor(fixture.network, invoiceAddress)
              ), `${proposalAddress} -> ${invoiceAddress}`).to.equal(false);
            }
          }
        });

        it('rejects the other script type even when its hash is identical', function() {
          const other = fixtures.find(f => f.network === fixture.network && f.type !== fixture.type);
          for (const address of Object.values(encodings(other))) {
            Verifier.checkPaypro(txpFor(fixture.network, fixture.cash), payproFor(fixture.network, address)).should.equal(false);
          }
        });

        it('rejects addresses from another network, even when both addresses agree', function() {
          for (const other of fixtures.filter(f => f.type === fixture.type && f.network !== fixture.network)) {
            // Testnet and regtest share legacy bytes; the declared network
            // disambiguates them. CashAddr identifies the network explicitly.
            const otherEncodings = Object.values(encodings(other)).filter(address =>
              address !== fixture.legacy && address !== fixture.bitcoinLegacy
            );
            for (const address of otherEncodings) {
              Verifier.checkPaypro(txpFor(fixture.network, address), payproFor(fixture.network, fixture.cash)).should.equal(false);
              Verifier.checkPaypro(txpFor(fixture.network, fixture.cash), payproFor(fixture.network, address)).should.equal(false);
              Verifier.checkPaypro(txpFor(fixture.network, address), payproFor(fixture.network, address)).should.equal(false);
            }
            Verifier.checkPaypro(txpFor(fixture.network, fixture.cash), payproFor(other.network, fixture.cash)).should.equal(false);
          }
        });
      });
    }

    for (const network of ['livenet', 'testnet', 'regtest']) {
      it(`matches reordered mixed encodings and preserves duplicate counts on ${network}`, function() {
        const pkh = fixtures.find(f => f.network === network && f.type === 'P2PKH');
        const sh = fixtures.find(f => f.network === network && f.type === 'P2SH');
        const txp = {
          ...txpFor(network, pkh.cash),
          outputs: [
            { toAddress: sh.bitcoinLegacy, amount: 4000 },
            { toAddress: pkh.cash.toUpperCase(), amount: 3000 },
            { toAddress: pkh.legacy, amount: 3000 }
          ]
        };
        const paypro = {
          ...payproFor(network, pkh.cash),
          instructions: [{ outputs: [
            { address: pkh.cash.split(':')[1], amount: 3000 },
            { address: pkh.bitcoinLegacy, amount: 3000 },
            { address: sh.cash, amount: 4000 }
          ] }]
        };
        Verifier.checkPaypro(txp, paypro).should.equal(true);
        // Same count and total, but one duplicate pays the wrong script type.
        txp.outputs[2].toAddress = sh.cash;
        Verifier.checkPaypro(txp, paypro).should.equal(false);
      });
    }
  });

  describe('checkAddress', function() {
    it('should verify a BTC  address', () => {
      const cred = aKey.createCredentials(null, { coin: 'btc', network: 'livenet', account: 0, n: 1 });
      cred.addWalletInfo('id', 'name', 1, 1, 'copayer');

      Verifier.checkAddress(cred, {
        address: '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA',
        path: 'm/0/0',
        publicKeys: ['03aaeb52dd7494c361049de67cc680e83ebcbbbdbeb13637d92cd845f70308af5e']
      }).should.be.true;
    });


  });

  describe('checkProposalAddresses', function() {
    const btcCred = () => {
      const cred = aKey.createCredentials(null, { coin: 'btc', network: 'livenet', account: 0, n: 1 });
      cred.addWalletInfo('id', 'name', 1, 1, 'copayer');
      return cred;
    };
    const ourChange = {
      address: '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA',
      path: 'm/0/0',
      publicKeys: ['03aaeb52dd7494c361049de67cc680e83ebcbbbdbeb13637d92cd845f70308af5e']
    };
    const theirChange = { ...ourChange, address: '1BitcoinEaterAddressDontSendf59kuE' };

    it('should reject a change or escrow address on account-based chains', function() {
      const cred = btcCred();

      for (const chain of ['eth', 'matic', 'sol', 'xrp']) {
        Verifier.checkProposalAddresses(cred, chain, { id: 'txp' }).should.be.true;
        Verifier.checkProposalAddresses(cred, chain, { id: 'txp', changeAddress: ourChange }).should.be.false;
        Verifier.checkProposalAddresses(cred, chain, { id: 'txp', escrowAddress: ourChange }).should.be.false;
      }
    });

    it('should reject a chain it has no address rules for', function() {
      Verifier.checkProposalAddresses(btcCred(), 'notachain', { id: 'txp', sendMax: true }).should.be.false;
    });

    it('should require our change address on UTXO chains', function() {
      const cred = btcCred();

      Verifier.checkProposalAddresses(cred, 'btc', { id: 'txp', changeAddress: ourChange }).should.be.true;
      Verifier.checkProposalAddresses(cred, 'btc', { id: 'txp', sendMax: true }).should.be.true;
      Verifier.checkProposalAddresses(cred, 'btc', { id: 'txp', changeAddress: theirChange }).should.be.false;
      Verifier.checkProposalAddresses(cred, 'btc', { id: 'txp' }).should.be.false;
    });

    it('should require an escrow address only where the wallet can escrow', function() {
      const bchCred = (addressType) => {
        const cred = aKey.createCredentials(null, { coin: 'bch', network: 'livenet', account: 0, n: 1 });
        cred.addWalletInfo('id', 'name', 1, 1, 'copayer');
        cred.addressType = addressType;
        return cred;
      };
      // sendMax so the change check passes without deriving a per-chain change address
      const escrowTxp = { id: 'txp', sendMax: true, instantAcceptanceEscrow: 1000 };

      // BWS only creates an escrow address for a ZCE-capable wallet, so the flag alone owes us nothing
      Verifier.checkProposalAddresses(btcCred(), 'btc', escrowTxp).should.be.true;
      Verifier.checkProposalAddresses(bchCred('P2SH'), 'bch', escrowTxp).should.be.true;
      // on a wallet that can escrow, a proposal asking for it must carry an address, and it must be ours
      Verifier.checkProposalAddresses(bchCred('P2PKH'), 'bch', escrowTxp).should.be.false;
      Verifier.checkProposalAddresses(bchCred('P2PKH'), 'bch', {
        ...escrowTxp, escrowAddress: theirChange
      }).should.be.false;
    });
  });

  describe('checkPrePublishRaw', function() {
    const ATTACKER_EVM = '0x1111111111111111111111111111111111111111';
    const ATTACKER_SOL = 'F7FknkRckx4yvA3Gexnx1H3nwPxndMxVt58BwAzEQhcY';
    const ATTACKER_XRP = 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe';

    const solTxp = (overrides = {}) => ({
      chain: 'sol',
      category: 'transfer',
      from: '8WyoNvKsmfdG6zrbzNBVN8DETyLra3ond61saU9C52YR',
      outputs: [{ toAddress: '3xkNjKm2zvGRvH2z2Nf9Y5hFvHZFtQXbQb1PBxDT56Xy', amount: 3896000000000000 }],
      blockHash: 'GtV1Hb3FvP3HURHAsj8mGwEqCumvP3pv3i6CVCzYNj3d',
      blockHeight: 531575,
      ...overrides
    });

    const evmTxp = (overrides = {}) => ({
      chain: 'eth',
      network: 'livenet',
      outputs: [{ toAddress: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A', amount: 1000 }],
      from: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A',
      nonce: 0,
      gasLimit: 21000,
      gasPrice: 20000000000,
      data: '0x',
      ...overrides
    });

    const xrpTxp = (overrides = {}) => ({
      chain: 'xrp',
      outputs: [{ toAddress: 'rDzTZxa7NwD9vmNf5dvTbW4FQDNSRsfPv6', amount: 8000 }],
      from: 'rEqj9WKSH7wEkPvWf6b4gCi26Y3F7HbKUF',
      fee: 12,
      nonce: 1,
      ...overrides
    });






    it('rejects an unusable prePublishRaw instead of throwing on it', function() {
      // the server chooses this value, so it can be any shape, including one that hashes to nothing
      for (const prePublishRaw of [[], [''], [null], ['', ''], '', [Utils.buildTx(solTxp()).uncheckedSerialize()[0], '']]) {
        Verifier.checkPrePublishRaw('sol', solTxp({ prePublishRaw })).should.be.false;
      }
    });

    it('rejects prePublishRaw on a non-mutable (UTXO) chain', function() {
      Verifier.checkPrePublishRaw('btc', { chain: 'btc', prePublishRaw: 'anything' }).should.be.false;
    });
  });
});
