import Fastify, { FastifyInstance, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { z, ZodError } from 'zod';
import { config } from './config';
import { Coin, COINS, requestAuthMessage, verifyMessage } from './crypto';
import { ClientError, Errors } from './errors';
import { Storage } from './storage';
import { ChainIndex } from './chronik';
import { WalletService, createWalletSchema, joinWalletSchema } from './wallet-service';
import { TxService, createProposalSchema } from './tx-service';

interface AuthContext {
  copayerId: string;
  walletId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

function sendError(error: unknown) {
  if (error instanceof ClientError) {
    return { statusCode: error.statusCode, payload: { code: error.code, message: error.message } };
  }
  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      payload: { code: 'BAD_REQUEST', message: error.issues[0]?.message || 'Invalid request' }
    };
  }
  const err = error as { code?: string; statusCode?: number; message?: string };
  if (err?.code) {
    return {
      statusCode: err.statusCode || 400,
      payload: { code: err.code, message: err.message || 'Request failed' }
    };
  }
  return { statusCode: 500, payload: { code: 'INTERNAL', message: (error as Error).message } };
}

export async function buildApp(opts: { storage: Storage; chain: ChainIndex }): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });

  const wallets = new WalletService(opts.storage);
  const txs = new TxService(opts.storage, opts.chain, wallets);

  async function requireAuth(req: FastifyRequest): Promise<AuthContext> {
    const identity = req.headers['x-identity'];
    const signature = req.headers['x-signature'];
    if (!identity || !signature || Array.isArray(identity) || Array.isArray(signature)) {
      throw Errors.NOT_AUTHORIZED;
    }
    const copayer = await opts.storage.getCopayerById(identity);
    if (!copayer) throw Errors.NOT_AUTHORIZED;
    const url = (req.url || '').split('?')[0];
    const message = requestAuthMessage(req.method, url, req.body || {});
    if (!verifyMessage(message, signature, copayer.requestPubKey)) {
      throw Errors.NOT_AUTHORIZED;
    }
    return { copayerId: copayer.id, walletId: copayer.walletId };
  }

  app.get('/health', async () => ({
    ok: true,
    service: 'abcpay-wallet-service',
    coins: Object.keys(COINS)
  }));

  app.post('/bws/api/v1/wallets', async (req, reply) => {
    try {
      const body = createWalletSchema.parse(req.body);
      const wallet = await wallets.createWallet(body);
      return { walletId: wallet.id, wallet };
    } catch (error) {
      const { statusCode, payload } = sendError(error);
      return reply.code(statusCode).send(payload);
    }
  });

  app.post('/bws/api/v1/wallets/:id/copayers', async (req, reply) => {
    try {
      const params = req.params as { id: string };
      const body = joinWalletSchema.parse({ ...(req.body as object), walletId: params.id });
      return await wallets.joinWallet(body);
    } catch (error) {
      const { statusCode, payload } = sendError(error);
      return reply.code(statusCode).send(payload);
    }
  });

  app.get('/bws/api/v1/wallets', async (req, reply) => {
    try {
      const auth = await requireAuth(req);
      return await wallets.getWallet(auth.walletId);
    } catch (error) {
      const { statusCode, payload } = sendError(error);
      return reply.code(statusCode).send(payload);
    }
  });

  app.post('/bws/api/v3/addresses', async (req, reply) => {
    try {
      const auth = await requireAuth(req);
      return await wallets.createAddress(auth.walletId, false);
    } catch (error) {
      const { statusCode, payload } = sendError(error);
      return reply.code(statusCode).send(payload);
    }
  });

  app.get('/bws/api/v4/addresses', async (req, reply) => {
    try {
      const auth = await requireAuth(req);
      return await wallets.listAddresses(auth.walletId);
    } catch (error) {
      const { statusCode, payload } = sendError(error);
      return reply.code(statusCode).send(payload);
    }
  });

  app.get('/bws/api/v1/balance', async (req, reply) => {
    try {
      const auth = await requireAuth(req);
      return await txs.getBalance(auth.walletId);
    } catch (error) {
      const { statusCode, payload } = sendError(error);
      return reply.code(statusCode).send(payload);
    }
  });

  app.get('/bws/api/v1/utxos', async (req, reply) => {
    try {
      const auth = await requireAuth(req);
      return await txs.getUtxos(auth.walletId);
    } catch (error) {
      const { statusCode, payload } = sendError(error);
      return reply.code(statusCode).send(payload);
    }
  });

  app.post('/bws/api/v3/txproposals', async (req, reply) => {
    try {
      const auth = await requireAuth(req);
      const body = createProposalSchema.parse(req.body);
      return await txs.createProposal(auth.walletId, auth.copayerId, body);
    } catch (error) {
      const { statusCode, payload } = sendError(error);
      return reply.code(statusCode).send(payload);
    }
  });

  app.post('/bws/api/v2/txproposals/:id/publish', async (req, reply) => {
    try {
      const auth = await requireAuth(req);
      const params = req.params as { id: string };
      return await txs.publishProposal(params.id, auth.copayerId);
    } catch (error) {
      const { statusCode, payload } = sendError(error);
      return reply.code(statusCode).send(payload);
    }
  });

  app.post('/bws/api/v1/txproposals/:id/signatures', async (req, reply) => {
    try {
      const auth = await requireAuth(req);
      const params = req.params as { id: string };
      const body = z.object({ signatures: z.array(z.string()) }).parse(req.body);
      return await txs.signProposal(params.id, auth.copayerId, body.signatures);
    } catch (error) {
      const { statusCode, payload } = sendError(error);
      return reply.code(statusCode).send(payload);
    }
  });

  app.post('/bws/api/v1/txproposals/:id/rejections', async (req, reply) => {
    try {
      const auth = await requireAuth(req);
      const params = req.params as { id: string };
      return await txs.rejectProposal(params.id, auth.copayerId);
    } catch (error) {
      const { statusCode, payload } = sendError(error);
      return reply.code(statusCode).send(payload);
    }
  });

  app.post('/bws/api/v1/txproposals/:id/broadcast', async (req, reply) => {
    try {
      const auth = await requireAuth(req);
      const params = req.params as { id: string };
      const body = z.object({ signedHex: z.string().min(1).optional() }).parse(req.body || {});
      return await txs.broadcastProposal(params.id, auth.copayerId, body.signedHex);
    } catch (error) {
      const { statusCode, payload } = sendError(error);
      return reply.code(statusCode).send(payload);
    }
  });

  app.delete('/bws/api/v1/txproposals/:id', async (req, reply) => {
    try {
      const auth = await requireAuth(req);
      const params = req.params as { id: string };
      return await txs.deleteProposal(params.id, auth.copayerId);
    } catch (error) {
      const { statusCode, payload } = sendError(error);
      return reply.code(statusCode).send(payload);
    }
  });

  app.get('/bws/api/v2/txproposals', async (req, reply) => {
    try {
      const auth = await requireAuth(req);
      return await txs.listProposals(auth.walletId);
    } catch (error) {
      const { statusCode, payload } = sendError(error);
      return reply.code(statusCode).send(payload);
    }
  });

  app.get('/bws/api/v1/txhistory', async (req, reply) => {
    try {
      const auth = await requireAuth(req);
      const query = req.query as { skip?: string; limit?: string };
      const page = Number(query.skip || 0);
      const limit = Number(query.limit || 50);
      return await txs.getHistory(auth.walletId, page, limit);
    } catch (error) {
      const { statusCode, payload } = sendError(error);
      return reply.code(statusCode).send(payload);
    }
  });

  app.put('/bws/api/v1/txnotes/:txid', async (req, reply) => {
    try {
      const auth = await requireAuth(req);
      const params = req.params as { txid: string };
      const body = z.object({ body: z.string() }).parse(req.body);
      await opts.storage.upsertNote({
        walletId: auth.walletId,
        txid: params.txid,
        copayerId: auth.copayerId,
        body: body.body
      });
      return { ok: true };
    } catch (error) {
      const { statusCode, payload } = sendError(error);
      return reply.code(statusCode).send(payload);
    }
  });

  app.get('/bws/api/v1/txnotes/:txid', async (req, reply) => {
    try {
      const auth = await requireAuth(req);
      const params = req.params as { txid: string };
      const body = await opts.storage.getNote(auth.walletId, params.txid, auth.copayerId);
      return { body };
    } catch (error) {
      const { statusCode, payload } = sendError(error);
      return reply.code(statusCode).send(payload);
    }
  });

  app.get('/bws/api/v3/fiatrates/:coin', async (req, reply) => {
    try {
      const params = req.params as { coin: string };
      const coin = params.coin.toLowerCase() as Coin;
      if (coin !== 'xec' && coin !== 'doge') {
        return reply.code(400).send({ code: 'BAD_REQUEST', message: 'Unsupported coin' });
      }
      const ids = coin === 'xec' ? 'ecash' : 'dogecoin';
      const res = await fetch(`${config.ratesUrl}?ids=${ids}&vs_currencies=usd,eur,gbp`);
      const json = (await res.json()) as Record<string, Record<string, number>>;
      const rates = json[ids] || {};
      return {
        coin,
        ts: Date.now(),
        rates: Object.entries(rates).map(([code, rate]) => ({ code: code.toUpperCase(), rate }))
      };
    } catch (error) {
      const { statusCode, payload } = sendError(error);
      return reply.code(statusCode).send(payload);
    }
  });

  return app;
}
