# AbcPay Wallet Service

A rebuilt Bitcore Wallet Service for **eCash (XEC)** and **Dogecoin (DOGE)** only.

- TypeScript + Fastify
- PostgreSQL (Prisma) instead of MongoDB
- Chronik indexer for UTXOs, history, and broadcast
- Copay-style multisig (m-of-n) with no private keys on the server

## Why this exists

The legacy `bitcore-wallet-service` stacked BTC/BCH/ETH/XRP/LTC/XPI, BitPay extras, and MongoDB. This package keeps the Copay security model (client-held keys, independently derived addresses, signed tx proposals) and drops everything else.

## Coins

| Coin | Indexer | Address | Derivation | Multisig |
| ---- | ------- | ------- | ---------- | -------- |
| XEC | Chronik | `ecash:` cashaddr | `m/44'/1899'/0'` (1-of-1) or `m/48'/1899'/0'` (shared) | P2SH |
| DOGE | Chronik | Legacy P2PKH | `m/44'/3'/0'` or `m/48'/3'/0'` | P2SH |

Chronik URLs are configurable. Public eCash nodes are included by default. Dogecoin Chronik should be pointed at your own node if a public cluster is not available.

## Run

```sh
# from this package
docker compose up -d postgres
cp .env.example .env
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

Service: `http://localhost:3232/bws/api`

## Auth

Same Copay headers:

- `x-identity`: copayer id (`sha256(coin + xPubKey)`)
- `x-signature`: ECDSA of `method|url|JSON.stringify(body)` with the request key at `m/1'/0`

Private keys never leave the client.

## API

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| POST | `/v1/wallets` | no | Create wallet |
| POST | `/v1/wallets/:id/copayers` | no | Join with xpub |
| GET | `/v1/wallets` | yes | Wallet + copayers |
| POST | `/v3/addresses` | yes | New receive address |
| GET | `/v4/addresses` | yes | List addresses |
| GET | `/v1/balance` | yes | Balance from Chronik |
| GET | `/v1/utxos` | yes | Spendable UTXOs |
| POST | `/v3/txproposals` | yes | Create proposal |
| POST | `/v2/txproposals/:id/publish` | yes | Publish to copayers |
| POST | `/v1/txproposals/:id/signatures` | yes | Add signatures |
| POST | `/v1/txproposals/:id/broadcast` | yes | Broadcast via Chronik |
| POST | `/v1/txproposals/:id/rejections` | yes | Reject |
| DELETE | `/v1/txproposals/:id` | yes | Delete (creator) |
| GET | `/v2/txproposals` | yes | Pending proposals |
| GET | `/v1/txhistory` | yes | History from Chronik |
| GET | `/v3/fiatrates/:coin` | no | USD/EUR/GBP rates |

## Multisig flow

1. Creator generates a wallet keypair and `POST /v1/wallets` with `m`, `n`, and the public key.
2. Invitation secret (Base58 JSON) is shared out-of-band.
3. Each copayer joins with `xPubKey` + `requestPubKey`, signed with the wallet private key.
4. When `n` copayers have joined, the wallet is `complete`.
5. Addresses are m-of-n P2SH, derived independently by every client.
6. Spends are tx proposals. After `m` signatures the raw tx is broadcast through Chronik.

## Environment

```
PORT=3232
DATABASE_URL=postgresql://abcpay:abcpay@127.0.0.1:5432/abcpay?schema=public
CHRONIK_XEC_URLS=https://chronik.e.cash,https://chronik.pay2stay.com/xec
CHRONIK_DOGE_URLS=https://doge.chronik.be.cash
```
