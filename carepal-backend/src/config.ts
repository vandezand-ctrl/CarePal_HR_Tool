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

if (authMode === 'mock' && nodeEnv === 'production') {
  throw new Error(
    "[config] AUTH_MODE='mock' is not allowed in NODE_ENV='production'. " +
      'Mock auth accepts any x-user-email header without verification.',
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

// F3 — AI resume screener. Optional: when absent the screening endpoint
// returns { screened: false, reason: 'not configured' } instead of crashing.
// Mirrors the email service's soft-failure pattern (isEmailConfigured()).
const anthropicApiKey = process.env.ANTHROPIC_API_KEY || undefined;

export const config = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv,
  databaseUrl: process.env.DATABASE_URL,
  authMode,
  googleClientId,
  anthropicApiKey,
} as const;
