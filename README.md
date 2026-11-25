# Bitcore



  <p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/bitcore-lib">
  <img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/m/bitpay/bitcore">
  <a href="https://opensource.org/licenses/MIT/" target="_blank"><img alt="MIT License" src="https://img.shields.io/badge/License-MIT-blue.svg" style="display: inherit;"/></a>
  <a href="https://github.com/bitpay/bitcore/graphs/contributors"> 
    <img alt="GitHub contributors" src="https://img.shields.io/github/contributors/bitpay/bitcore">
  </a>
  <br>
 <img src="https://circleci.com/gh/bitpay/bitcore.svg?style=shield" alt="master build">
</p>
  
  
  
**Infrastructure to build Bitcoin and blockchain-based applications for the next generation of financial technology.**

## Getting Started

### Requirements

- Trusted P2P Peer
- MongoDB Server >= v3.4
- make g++ gcc 

### Checkout the repo


```sh
git clone git@github.com:bitpay/bitcore.git
git checkout master
npm install
```

## Setup Guide

### 1. Setup Bitcore config

<details>
<summary>Example bitcore.config.json</summary>
<br>

```json
{
  "bitcoreNode": {
    "chains": {
      "BTC": {
        "mainnet": {
          "chainSource": "p2p",
          "trustedPeers": [
            {
              "host": "127.0.0.1",
              "port": 20008
            }
          ],
          "rpc": {
            "host": "127.0.0.1",
            "port": 20009,
            "username": "username",
            "password": "password"
          }
        },
        "regtest": {
          "chainSource": "p2p",
          "trustedPeers": [
            {
              "host": "127.0.0.1",
              "port": 20020
            }
          ],
          "rpc": {
            "host": "127.0.0.1",
            "port": 20021,
            "username": "username",
            "password": "password"
          }
        }
      },
      "BCH": {
        "mainnet": {
          "parentChain": "BTC",
          "forkHeight": 478558,
          "trustedPeers": [
            {
              "host": "127.0.0.1",
              "port": 30008
            }
          ],
          "rpc": {
            "host": "127.0.0.1",
            "port": 30009,
            "username": "username",
            "password": "password"
          }
        },
        "regtest": {
          "chainSource": "p2p",
          "trustedPeers": [
            {
              "host": "127.0.0.1",
              "port": 30020
            }
          ],
          "rpc": {
            "host": "127.0.0.1",
            "port": 30021,
            "username": "username",
            "password": "password"
          }
        }
      }
    }
  }
}
```

</details>

### 2. Setup Bitcoin Node

<details>
<summary>Example Bitcoin Mainnet Config</summary>

```sh
whitelist=127.0.0.1
txindex=0
listen=1
server=1
irc=1
upnp=1

# Make sure port & rpcport matches the
# bitcore.config.json ports for BTC mainnet

# if using Bitcoin Core v0.17+ prefix
# [main]

port=20008
rpcport=20009
rpcallowip=127.0.0.1

rpcuser=username
rpcpassword=password
```

</details>

### 3. Run Bitcoin node

<details>
<summary>Example Starting a Bitcoin Node</summary>

```sh
# Path to your bitcoin application and path to the config above
/Applications/Bitcoin-Qt.app/Contents/MacOS/Bitcoin-Qt -datadir=/Users/username/blockchains/bitcoin-core/networks/mainnet/
```

</details>

### 4. Start Bitcore

```sh
npm run node
```

## Applications

- [Bitcore Node](packages/bitcore-node) - A standardized API to interact with multiple blockchain networks
- [Bitcore Wallet](packages/bitcore-wallet) - A command-line based wallet client
- [Bitcore Wallet Client](packages/bitcore-wallet-client) - A client for Bitcore Wallet Service
- [Bitcore Wallet Service](packages/bitcore-wallet-service) - A coordination service for multisig wallets
- [Bitcore CLI](packages/bitcore-cli) - A command line interface for using BWS and BWC

## Libraries

- [Bitcore Channel](https://github.com/bitpay/bitcore-channel) - Micropayment channels for rapidly adjusting bitcoin transactions
- [Bitcore ECIES](https://github.com/bitpay/bitcore-ecies) - Uses ECIES symmetric key negotiation from public keys to encrypt arbitrarily long data streams
- [Bitcore Lib](packages/bitcore-lib) - A pure and powerful JavaScript Bitcoin library
- [Bitcore Lib Cash](packages/bitcore-lib-cash) - A pure and powerful JavaScript Bitcoin Cash library
- [Bitcore Message](https://github.com/bitpay/bitcore-message) - Bitcoin message verification and signing
- [Bitcore Mnemonic](packages/bitcore-mnemonic) - Implements mnemonic code for generating deterministic keys
- [Bitcore P2P](packages/bitcore-p2p) - The peer-to-peer networking protocol for BTC
- [Bitcore P2P Cash](packages/bitcore-p2p-cash) - The peer-to-peer networking protocol for BCH
- [Crypto Wallet Core](packages/crypto-wallet-core) - A coin-agnostic wallet library for creating transactions, signing, and address derivation
- [Crypto RPC](packages/crypto-rpc) - A library for connecting to blockchains' RPC interfaces

## Extras

- [Bitcore Build](packages/bitcore-build) - A helper to add tasks to gulp
- [Bitcore Client](packages/bitcore-client) - A helper to create a wallet using the bitcore-node infrastructure
- [Bitpay/Bitpay App](https://github.com/bitpay/bitpay-app) - An easy-to-use, multiplatform, multisignature, secure wallet for bitcoin, ethereum, and more

## Development

See [SETUP.md](SETUP.md) for Node/npm requirements, backend workspace setup,
build and test commands, Docker workflows, and dependency maintenance.

### Insight

Insight (`packages/insight`) is deliberately kept out of the workspace graph
and keeps its own independent lockfile and toolchain. Install and build it
separately from the root:

```sh
npm run insight:install
npm run insight:build
```

## Versioning

This repo follows the even-odd versioning convention. Major versions that are even (e.g. v8.x.x) are `stable` releases, odd are `beta` releases (e.g. v9.x.x). Beta versions may contain breaking changes or major feature additions that are still in testing.

## Contributing

See [CONTRIBUTING.md](https://github.com/bitpay/bitcore/blob/master/CONTRIBUTING.md) on the main bitcore repo for information about how to contribute.

## License

Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).

Copyright 2013-2025 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.

[^1]: The Bitcore P2P Doge library is no longer maintained as all the core functionality is contained in Bitcore P2P
