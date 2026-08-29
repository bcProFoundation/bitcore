import { Coin, COINS, Network } from './crypto';

export interface AppConfig {
  port: number;
  host: string;
  databaseUrl: string;
  chronik: Record<Coin, string[]>;
  ratesUrl: string;
}

function splitUrls(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  return value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export const config: AppConfig = {
  port: Number(process.env.PORT || 3232),
  host: process.env.HOST || '0.0.0.0',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://abcpay:abcpay@127.0.0.1:5432/abcpay?schema=public',
  chronik: {
    xec: splitUrls(process.env.CHRONIK_XEC_URLS, COINS.xec.chronikUrls),
    doge: splitUrls(process.env.CHRONIK_DOGE_URLS, COINS.doge.chronikUrls)
  },
  ratesUrl: process.env.RATES_URL || 'https://api.coingecko.com/api/v3/simple/price'
};

export function assertSupported(coin: string, network: string): asserts coin is Coin {
  if (coin !== 'xec' && coin !== 'doge') {
    throw Object.assign(new Error(`Unsupported coin: ${coin}`), { code: 'BAD_REQUEST', statusCode: 400 });
  }
  if (network !== 'livenet' && network !== 'testnet') {
    throw Object.assign(new Error(`Unsupported network: ${network}`), { code: 'BAD_REQUEST', statusCode: 400 });
  }
}

export type { Network };
