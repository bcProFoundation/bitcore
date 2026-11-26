---
'@bcpros/bitcore-lib-xpi': patch
'@bcpros/bitcore-p2p-xpi': patch
'@bcpros/bitcore-wallet-service': patch
---

Lotus: parse blocks that carry metadata fields, skip unknown P2P commands, read the XPI Chronik URL from CHRONIK_XPI_URL (default https://chronik.givelotus.org/xpi) and use the legacy Chronik client for XPI broadcasts and UTXO lookups.
