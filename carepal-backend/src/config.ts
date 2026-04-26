import 'dotenv/config';

export type AuthMode = 'mock' | 'google';

const nodeEnv = process.env.NODE_ENV || 'development';

// Default: production -> google, anything else -> mock. Override with AUTH_MODE.
const authMode: AuthMode =
  (process.env.AUTH_MODE as AuthMode | undefined) ??
  (nodeEnv === 'production' ? 'google' : 'mock');

if (authMode !== 'mock' && authMode !== 'google') {
  throw new Error(
    `[config] Invalid AUTH_MODE='${authMode}'. Must be 'mock' or 'google'.`,
  );
}

const googleClientId = process.env.GOOGLE_CLIENT_ID;

// Fail-fast: if we're going to verify Google ID tokens, we MUST have a client
// ID at boot. Booting without it would silently 401 every request — louder
// to crash now than to debug it from a Cloud Run log later.
if (authMode === 'google' && !googleClientId) {
  throw new Error(
    "[config] AUTH_MODE='google' requires GOOGLE_CLIENT_ID env var to be set.",
  );
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv,
  databaseUrl: process.env.DATABASE_URL,
  authMode,
  googleClientId,
} as const;
