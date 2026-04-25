import { useState } from 'react';
import { GoogleLogin, googleLogout } from '@react-oauth/google';
import { setIdToken, api } from './api.js';

/**
 * Sign-in gate. Renders when AUTH_MODE=google and there's no authenticated
 * user yet. Successful Google sign-in stores the ID token, calls /api/me to
 * confirm the user is allowlisted on the backend, then hands control to App.
 *
 * Three terminal states the caller cares about:
 *   - signed in & authorized → calls onAuthed(me)
 *   - signed in but rejected (403)  → shows "not authorized" screen
 *   - sign-in failed / cancelled    → shows error and lets them retry
 */
export default function Login({ onAuthed }) {
  const [error, setError] = useState(null); // 'rejected' | 'transient' | string | null
  const [busy, setBusy] = useState(false);

  async function handleSuccess({ credential }) {
    setError(null);
    setBusy(true);
    setIdToken(credential);
    try {
      const me = await api.me();
      onAuthed(me);
    } catch (err) {
      // The backend returns 403 for "valid Google account, but not allowlisted".
      // Any other failure is treated as transient — let the user retry.
      if (err.status === 403) {
        setError('rejected');
      } else {
        setError(err.message || 'Sign-in failed');
      }
      setIdToken(null);
      try { googleLogout(); } catch { /* google sdk may not be ready yet */ }
    } finally {
      setBusy(false);
    }
  }

  function handleError() {
    setError('Google sign-in was cancelled or failed. Please try again.');
    setIdToken(null);
  }

  function handleSignOut() {
    setError(null);
    setIdToken(null);
    try { googleLogout(); } catch { /* ignore */ }
  }

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        body, #root { font-family: 'Plus Jakarta Sans', sans-serif; }
      `}</style>
      <div style={styles.card}>
        <div style={styles.brandRow}>
          <div style={styles.brandMark}>cp</div>
          <div style={styles.brandText}>CarePal HR Admin</div>
        </div>

        {error === 'rejected' ? (
          <>
            <h1 style={styles.title}>Account not authorized</h1>
            <p style={styles.subtitle}>
              The Google account you signed in with isn't on the allowlist for
              CarePal HR Admin. Sign in with a CarePal Money or Impact Guru
              Workspace account, or ask Sahil for access.
            </p>
            <button onClick={handleSignOut} style={styles.button}>Try a different account</button>
          </>
        ) : (
          <>
            <h1 style={styles.title}>Sign in</h1>
            <p style={styles.subtitle}>
              Use your CarePal Money or Impact Guru Google account to continue.
            </p>
            <div style={styles.googleButtonWrap}>
              {busy ? (
                <div style={styles.busy}>Verifying…</div>
              ) : (
                <GoogleLogin
                  onSuccess={handleSuccess}
                  onError={handleError}
                  useOneTap
                  text="signin_with"
                  shape="pill"
                  theme="outline"
                  size="large"
                />
              )}
            </div>
            {error && error !== 'rejected' && (
              <div style={styles.errorBox}>{error}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: '#fff',
    borderRadius: 16,
    border: '1px solid #e2e8f0',
    padding: '40px 36px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 28,
  },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: '#0d9488',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  brandText: {
    fontSize: 15,
    fontWeight: 700,
    color: '#0f172a',
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 1.5,
    marginBottom: 24,
  },
  googleButtonWrap: {
    display: 'flex',
    justifyContent: 'center',
    minHeight: 44,
  },
  busy: {
    fontSize: 13,
    color: '#64748b',
    padding: '12px 0',
  },
  button: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    color: '#0f172a',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  errorBox: {
    marginTop: 16,
    padding: '10px 12px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 8,
    fontSize: 12,
    color: '#991b1b',
  },
};
