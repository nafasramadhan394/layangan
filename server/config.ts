// Internal server configuration. NEVER imported by client code.

// Database: Vercel env var takes precedence; the fallback points to the
// project's Neon Postgres instance (server-side only, never bundled to the client).
export const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  'postgresql://neondb_owner:npg_8AJFTun0aZXM@ep-curly-flower-b52q2m9s-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require';

// Owner account. Only a salted scrypt hash of the password is stored here —
// the plaintext password is not present anywhere in the codebase.
export const OWNER_USERNAME = process.env.OWNER_USERNAME || 'fasszk';
export const OWNER_PASS_HASH =
  process.env.OWNER_PASS_HASH ||
  'scrypt$5aee51618695da6543c53f68f912474c$23074d4ca1cbf11d35325e4aa5c9bb15348070571e872e9b6fed83a570a82362155e5e959e9b6a1199771315d6c0a360e9e2ff7705fe75bb4291e04d65ff9d62';

export const SESSION_DAYS = 30;
export const ONLINE_WINDOW_S = 30;
export const INVITE_TTL_S = 60;
export const MAX_KITES_PER_USER = 30;
export const MAX_KITE_IMAGE_CHARS = 600_000;
export const SCHEMA_VERSION = 'v3';
