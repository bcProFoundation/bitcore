---
'@bcpros/bitcore-build': major
'@bcpros/bitcore-client': major
'@bcpros/bitcore-lib': major
'@bcpros/bitcore-lib-cash': major
'@bcpros/bitcore-lib-doge': major
'@bcpros/bitcore-lib-ltc': major
'@bcpros/bitcore-lib-xec': major
'@bcpros/bitcore-lib-xpi': major
'@bcpros/bitcore-mnemonic': major
'@bcpros/bitcore-node': major
'@bcpros/bitcore-p2p': major
'@bcpros/bitcore-p2p-cash': major
'@bcpros/bitcore-p2p-doge': major
'@bcpros/bitcore-p2p-xec': major
'@bcpros/bitcore-p2p-xpi': major
'@bcpros/bitcore-wallet': major
'@bcpros/bitcore-wallet-client': major
'@bcpros/bitcore-wallet-service': major
'@bcpros/crypto-wallet-core': major
'@bcpros/bitcore-logging': major
'@bcpros/bitcore-tss': major
'@bcpros/crypto-rpc': major
---

Sync with upstream bitpay/bitcore v11.11.7. Node 24 is now required. Brings upstream's security fixes and dependency pins, the BWS route split, TSS wallets and the new bitcore-logging, bitcore-tss and crypto-rpc packages. XEC, XPI, eTokens, Chronik and the AbcPay wallet service features are kept. The wallet stack stays UTXO-only: upstream's EVM, Solana and XRP support is left out, as in #132.
