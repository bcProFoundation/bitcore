import { PrismaClient } from '@prisma/client';
import { ChronikIndex } from './chronik';
import { config } from './config';
import { PrismaStorage } from './prisma-storage';
import { buildApp } from './app';

async function main() {
  const prisma = new PrismaClient();
  const storage = new PrismaStorage(prisma);
  const chain = new ChronikIndex();
  const app = await buildApp({ storage, chain });

  await app.listen({ port: config.port, host: config.host });
  console.log(`AbcPay Wallet Service listening on ${config.host}:${config.port}`);
  console.log('Coins: XEC, DOGE | Indexer: Chronik | DB: Postgres');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
