import { expect } from 'chai';
import { Deriver } from '../src';
import { encoding } from '@bcpros/bitcore-lib';
import { createKeyPairFromPrivateKeyBytes, getAddressDecoder } from '@solana/kit';

describe('Address Derivation', () => {
  it('should be able to generate a valid BTC address', () => {
    const xPub = 'xpub6A4DRTebM6TS5f6cUt5YAxKXikhDZd6ANwbyomHhFFkjJApdAwnADvMRfimdaKXf1xk1LTrPuRo7eGCGYARApdytZ18SqoUv6MTYtbCx4Xv';
    // 'select scout crash enforce riot rival spring whale hollow radar rule sentence';

    const path = Deriver.pathFor('BTC', 'mainnet');
    expect(path).to.equal("m/44'/0'/0'");

    const address = Deriver.deriveAddress('BTC', 'mainnet', xPub, 0, false);
    const expectedAddress = '1EDh8HXc2jwbyDPLEyDDnYea48f2D8z3ER';
    expect(address).to.equal(expectedAddress);
  });

  it('should be able to generate a valid BCH address', () => {
    const xPub = 'xpub6BM8E3eh3homN5uvHh12P4HQEP1QrXCuCA32JRgTTeR7Y7ChML4iV12TfSVV3KHnCGPB1kkDU26EnDHYqw3Koab2a2GjxHQuUVXE3fvcpek';
    // 'select scout crash enforce riot rival spring whale hollow radar rule sentence';

    const path = Deriver.pathFor('BCH', 'mainnet');
    expect(path).to.equal("m/44'/145'/0'");

    const address = Deriver.deriveAddress('BCH', 'mainnet', xPub, 0, false);
    const expectedAddress = 'qzltyqgzd3hvj7fvfdymzk6e47zrrczvzc9y37nnrr';
    expect(address).to.equal(expectedAddress);
  });

  it('should be able to generate a valid DOGE address', () => {
    const xPub = 'tpubDCs1d9wgHkn2LYY8KrWozaUwG7a3XSkiaGtn8isiNWmLhepenSdqgH1JCMwCLW9eeRZW37D14tpBjxvb3rjkMzak4ub1qHyF4tLbQDNXZ8K';
    // 'select scout crash enforce riot rival spring whale hollow radar rule sentence';

    const path = Deriver.pathFor('DOGE', 'mainnet');
    expect(path).to.equal("m/44'/3'/0'");

    const address = Deriver.deriveAddress('DOGE', 'mainnet', xPub, 0, false);
    const expectedAddress = 'DQnSpKaUdXYZz8Q4WUBCdaGBSthiAJbWBr';
    expect(address).to.equal(expectedAddress);
  });

  it('should be able to generate a valid LTC address', () => {
    const xPub = 'tpubDCetVaW8PG7S6SuLjRGmmyVA4QtXyXTUsqXySaC4WV44igJ3aJNQgYedjL1FX12a1tDctnh3kRPybKTMUjdi9mzUm4wJF3GNSjf8GwDUHpp';
    // 'select scout crash enforce riot rival spring whale hollow radar rule sentence';

    const path = Deriver.pathFor('LTC', 'mainnet');
    expect(path).to.equal("m/44'/2'/0'");

    const address = Deriver.deriveAddress('LTC', 'mainnet', xPub, 0, false);
    const expectedAddress = 'LYgDcZ3oW3aZBhZUyiC84fb99hyUPVxLwB';
    expect(address).to.equal(expectedAddress);
  });







  it('should be able to generate a valid XPI address', () => {
    const xPub = 'xpub6D8rChqkgFuaZULuq2n6VrS4zB5Cmv24gcRc889dFRRgYAH1CGQmQZ9kcPfMAfWGPnyMd1X5foBYFmJ5ZPfvwhm6tXjaY13ao1rQHRtkKDv';
    // 'select scout crash enforce riot rival spring whale hollow radar rule sentence';

    const path = Deriver.pathFor('XPI', 'mainnet');
    expect(path).to.equal("m/44'/10605'/0'");

    const address = Deriver.deriveAddress('XPI', 'mainnet', xPub, 0, false);
    const expectedAddress = 'lotus_16PSJKPkEQBaJvbbViTqyfwiM4C1y7QMM4jj4VDgP';
    expect(address).to.equal(expectedAddress);
  });

  it('should be able to generate a valid XEC address', () => {
    const xPub = 'xpub6D8rChqkgFuaZULuq2n6VrS4zB5Cmv24gcRc889dFRRgYAH1CGQmQZ9kcPfMAfWGPnyMd1X5foBYFmJ5ZPfvwhm6tXjaY13ao1rQHRtkKDv';

    const path = Deriver.pathFor('XEC', 'mainnet');
    expect(path).to.equal("m/44'/899'/0'");

    const address = Deriver.deriveAddress('XEC', 'mainnet', xPub, 0, false);
    const expectedAddress = 'qp98kjdc22329k0a8hvvtexaqtuhygm94saq45dkx4';
    expect(address).to.equal(expectedAddress);
  });




});
