import { Request, Response, NextFunction } from 'express';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { config } from '../config.js';
import {
  getUserByEmail,
  createUser,
  touchLastLogin,
  User,
} from '../models/user.js';

// Augment Express's Request type to include user.
declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
  }
}

// ---------------------------------------------------------------------------
// Mock auth (local dev + CI)
// ---------------------------------------------------------------------------

/**
 * Mock auth: reads `x-user-email` header, loads user from DB.
 * Used in local dev and CI so contributors don't each need their own Google
 * OAuth client to run the app.
 */
export async function mockAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header('x-user-email');
  if (!header) {
    res.status(401).json({ error: 'Missing x-user-email header (dev mock auth)' });
    return;
  }

  const email = header.trim().toLowerCase();
  const user = await getUserByEmail(email);
  if (!user) {
    res.status(401).json({ error: `No user found for email: ${header}` });
    return;
  }

  // Best-effort — don't block the request on the timestamp update.
  void touchLastLogin(user.id).catch((err) => console.warn('[auth] touchLastLogin failed:', err));

  req.user = user;
  next();
}

// ---------------------------------------------------------------------------
// Google OAuth (production)
// ---------------------------------------------------------------------------

/**
 * Email allowlist. We accept Google sign-ins from CarePal and Impact Guru
 * Workspace accounts (verified via the `hd` hosted-domain claim, which Google
 * only sets for Workspace accounts they actually own — safer than parsing
 * the email suffix). One personal exception for the project owner.
 */
export const PERSONAL_ADMIN_EMAIL = 'jessevandezand@gmail.com';
export const ALLOWED_HOSTED_DOMAINS = ['carepalmoney.com', 'impactguru.com'];

export function isEmailAllowed(payload: {
  email?: string | null;
  email_verified?: boolean;
  hd?: string;
}): boolean {
  if (!payload.email_verified || !payload.email) return false;
  const email = payload.email.toLowerCase();
  if (email === PERSONAL_ADMIN_EMAIL) return true;
  if (payload.hd && ALLOWED_HOSTED_DOMAINS.includes(payload.hd)) return true;
  return false;
}

/**
 * Verifier signature — abstracted so tests can inject a stub instead of
 * hitting Google's public-key endpoint.
 */
export type IdTokenVerifier = (idToken: string) => Promise<TokenPayload | null>;

function defaultVerifier(): IdTokenVerifier {
  if (!config.googleClientId) {
    throw new Error('googleClientId required for google auth mode');
  }
  const client = new OAuth2Client(config.googleClientId);
  return async (idToken: string) => {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: config.googleClientId,
    });
    return ticket.getPayload() ?? null;
  };
}

/**
 * Build the Google auth middleware. Exported as a factory so tests can pass
 * in a stub verifier without touching Google's servers.
 */
export function googleAuthFactory(verifier: IdTokenVerifier = defaultVerifier()) {
  return async function googleAuth(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const header = req.header('authorization') ?? req.header('Authorization');
    if (!header || !header.toLowerCase().startsWith('bearer ')) {
      res.status(401).json({ error: 'Missing Authorization: Bearer <id_token> header' });
      return;
    }
    const idToken = header.slice('bearer '.length).trim();
    if (!idToken) {
      res.status(401).json({ error: 'Empty bearer token' });
      return;
    }

    let payload: TokenPayload | null;
    try {
      payload = await verifier(idToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'token verification failed';
      res.status(401).json({ error: `Invalid Google ID token: ${msg}` });
      return;
    }

    if (!payload) {
      res.status(401).json({ error: 'Google ID token verification returned no payload' });
      return;
    }

    if (!isEmailAllowed(payload)) {
      res
        .status(403)
        .json({ error: 'This email is not authorized to use CarePal HR Admin' });
      return;
    }

    const email = payload.email!.toLowerCase();
    let user = await getUserByEmail(email);

    if (!user) {
      // First sign-in: auto-provision as TA. Admins can promote afterwards
      // via the User Management UI (PATCH /api/users/:id/role).
      const domain =
        payload.hd ??
        (email.includes('@') ? email.split('@')[1] : 'unknown');
      user = await createUser({
        email,
        name: payload.name ?? email,
        role: 'ta',
        domain,
      });
    } else {
      void touchLastLogin(user.id).catch((err) => console.warn('[auth] touchLastLogin failed:', err));
    }

    req.user = user;
    next();
  };
}

// ---------------------------------------------------------------------------
// Combined entry point
// ---------------------------------------------------------------------------

/**
 * Picks the right middleware based on config.authMode. Use this from index.ts:
 * `app.use('/api', requireAuth())`.
 */
export function requireAuth() {
  return config.authMode === 'google' ? googleAuthFactory() : mockAuth;
}
