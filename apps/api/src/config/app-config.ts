export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
  jwtExpiresInSeconds: number;
  bcryptRounds: number;
  corsOrigins: string[];
  healthTimeoutMs: number;
  orderReservationTtlMinutes: number;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value.includes('REPLACE_')) throw new Error(`${name} is required`);
  return value;
}

function integer(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return value;
}

function durationSeconds(raw: string): number {
  const match = /^(\d+)(s|m|h|d)?$/.exec(raw);
  if (!match) throw new Error('JWT_EXPIRES_IN must be seconds or use s, m, h, or d');
  const amount = Number(match[1]);
  const multiplier = ({ s: 1, m: 60, h: 3600, d: 86400, undefined: 1 } as Record<string, number>)[match[2] ?? 'undefined'];
  const seconds = amount * multiplier;
  if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 86400) {
    throw new Error('JWT_EXPIRES_IN must be between 1 second and 24 hours');
  }
  return seconds;
}

export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('NODE_ENV is invalid');
  const databaseUrl = required('DATABASE_URL');
  let database: URL;
  try { database = new URL(databaseUrl); } catch { throw new Error('DATABASE_URL must be a valid PostgreSQL URL'); }
  if (!['postgres:', 'postgresql:'].includes(database.protocol)) throw new Error('DATABASE_URL must use PostgreSQL');

  const jwtSecret = required('JWT_SECRET');
  if (Buffer.byteLength(jwtSecret, 'utf8') < 32) throw new Error('JWT_SECRET must be at least 32 bytes');
  const origins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',').map((value) => value.trim());
  if (origins.some((origin) => {
    try { const parsed = new URL(origin); return !['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin; }
    catch { return true; }
  })) throw new Error('CORS_ORIGIN must contain valid origins separated by commas');
  if ((process.env.PAYMENT_PROVIDER ?? 'mock') !== 'mock') throw new Error('Only PAYMENT_PROVIDER=mock is supported');

  const config: AppConfig = {
    nodeEnv: nodeEnv as AppConfig['nodeEnv'],
    port: integer('PORT', 3001, 1, 65535),
    databaseUrl,
    jwtSecret,
    jwtIssuer: required('JWT_ISSUER'),
    jwtAudience: required('JWT_AUDIENCE'),
    jwtExpiresInSeconds: durationSeconds(process.env.JWT_EXPIRES_IN ?? '15m'),
    bcryptRounds: integer('BCRYPT_ROUNDS', 10, 10, 15),
    corsOrigins: origins,
    healthTimeoutMs: integer('HEALTHCHECK_TIMEOUT_MS', 2000, 100, 30000),
    orderReservationTtlMinutes: process.env.RESERVATION_TTL_SECONDS === undefined
      ? integer('ORDER_RESERVATION_TTL_MINUTES', 15, 1, 10080)
      : integer('RESERVATION_TTL_SECONDS', 900, 1, 604800) / 60,
  };
  return config;
}
