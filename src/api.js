// Thin fetch wrapper. Uses relative `/api/...` paths — Vite's dev server proxies
// them to the backend (see vite.config.js). In production, Express serves both
// the built frontend and the API from the same origin, so relative paths still work.
//
// Two auth modes (matches the backend's AUTH_MODE):
//   - 'mock'   (dev/CI default): sends `x-user-email` header from the dev switcher.
//   - 'google' (prod default):   sends `Authorization: Bearer <google_id_token>`.
//
// Switch with the build-time env var VITE_AUTH_MODE.

export const AUTH_MODE = import.meta.env.VITE_AUTH_MODE || 'mock';

// ───────────────────────────────────────────────────────────────────────────
// Mock mode: x-user-email
// ───────────────────────────────────────────────────────────────────────────

// Default to Akhlaque (TA) — same as a typical recruiter session.
const DEFAULT_USER_EMAIL = 'akhlaque@carepalmoney.com';

export function getCurrentUserEmail() {
  return localStorage.getItem('devUserEmail') || DEFAULT_USER_EMAIL;
}

export function setCurrentUserEmail(email) {
  localStorage.setItem('devUserEmail', email);
}

// ───────────────────────────────────────────────────────────────────────────
// Google mode: Authorization: Bearer <id_token>
// ───────────────────────────────────────────────────────────────────────────
//
// The token is held in memory + sessionStorage:
//   - In-memory variable for hot-path reads (every API call).
//   - sessionStorage so a hard refresh in the same tab keeps the user signed in,
//     without surviving a tab close (defense-in-depth — gmail tokens are short-lived
//     anyway, but this keeps them off disk).

const TOKEN_KEY = 'carepal.google.id_token';
let _idToken = null;

function readToken() {
  if (_idToken) return _idToken;
  try {
    _idToken = sessionStorage.getItem(TOKEN_KEY);
  } catch {
    _idToken = null;
  }
  return _idToken;
}

export function setIdToken(token) {
  _idToken = token || null;
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore storage failures (private mode etc.) */ }
}

export function getIdToken() {
  return readToken();
}

// ───────────────────────────────────────────────────────────────────────────
// Auth header builder — picks the right header for the active mode.
// ───────────────────────────────────────────────────────────────────────────

function authHeaders() {
  if (AUTH_MODE === 'google') {
    const t = readToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  }
  return { 'x-user-email': getCurrentUserEmail() };
}

// ───────────────────────────────────────────────────────────────────────────
// 401 handling — broadcast a global event so the App can boot us back to
// the login screen without every component having to know about auth.
// ───────────────────────────────────────────────────────────────────────────

function handleUnauthorized() {
  if (AUTH_MODE === 'google') {
    setIdToken(null);
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }
  // In mock mode a 401 just means the dev typed an unknown email — no redirect.
}

async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
    ...options,
  });
  if (res.status === 401) handleUnauthorized();
  if (!res.ok) {
    let body = null;
    try { body = await res.json(); } catch { /* ignore */ }
    const msg = body?.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  me: () => request('/api/me'),
  listUsers: () => request('/api/users'),
  updateUserRole: (id, role) =>
    request(`/api/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  listRequisitions: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v && v !== 'all') params.set(k, v); });
    const qs = params.toString();
    return request(`/api/requisitions${qs ? `?${qs}` : ''}`);
  },
  getRequisition: (id) => request(`/api/requisitions/${id}`),
  createRequisition: (input) => request('/api/requisitions', { method: 'POST', body: JSON.stringify(input) }),
  updateRequisition: (id, patch) => request(`/api/requisitions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  listCandidates: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v && v !== 'all') params.set(k, v); });
    const qs = params.toString();
    return request(`/api/candidates${qs ? `?${qs}` : ''}`);
  },
  getCandidate: (id) => request(`/api/candidates/${id}`),
  createCandidate: (input) => request('/api/candidates', { method: 'POST', body: JSON.stringify(input) }),
  updateCandidate: (id, patch) => request(`/api/candidates/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  getDashboard: (bu) => {
    const qs = bu && bu !== 'all' ? `?bu=${encodeURIComponent(bu)}` : '';
    return request(`/api/dashboard${qs}`);
  },
  listHeadcount: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v && v !== 'all') params.set(k, v); });
    const qs = params.toString();
    return request(`/api/headcount${qs ? `?${qs}` : ''}`);
  },
  listInterviewers: () => request('/api/interviewers'),
  listInterviews: (filters = {}) => {
    const params = new URLSearchParams();
    // Use explicit undefined/null check so legitimate `false` (e.g. includeCancelled=false)
    // can be sent if a caller wants it explicit. Empty strings still skipped.
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    const qs = params.toString();
    return request(`/api/interviews${qs ? `?${qs}` : ''}`);
  },
  scheduleInterview: (input) => request('/api/interviews', { method: 'POST', body: JSON.stringify(input) }),
  recordInterviewResult: (id, result) => request(`/api/interviews/${id}`, { method: 'PATCH', body: JSON.stringify({ result }) }),
  cancelInterview: (id, reason) => {
    const qs = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    return request(`/api/interviews/${id}${qs}`, { method: 'DELETE' });
  },
  offerCandidate: (id, offerDate) => request(`/api/candidates/${id}/offer`, { method: 'POST', body: JSON.stringify({ offerDate }) }),
  recordJoin: (id, joinDate) => request(`/api/candidates/${id}/join`, { method: 'POST', body: JSON.stringify({ joinDate }) }),

  listDocuments: (candidateId) => request(`/api/candidates/${candidateId}/documents`),
  uploadDocument: async (candidateId, file, docType) => {
    const form = new FormData();
    form.append('file', file);
    form.append('docType', docType);
    const res = await fetch(`/api/candidates/${candidateId}/documents`, {
      method: 'POST',
      headers: authHeaders(), // multipart sets its own Content-Type
      body: form,
    });
    if (res.status === 401) handleUnauthorized();
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error(body?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  },
  deleteDocument: (id) => request(`/api/documents/${id}`, { method: 'DELETE' }),
  // Download URL (not fetched via JSON) — used as href on download links.
  // In Google mode the browser can't attach the bearer header to a plain
  // anchor click, so download requires either a server cookie session OR a
  // signed URL. For now, in Google mode this requires the same-origin
  // session — fine because Cloud Run serves frontend + backend together.
  documentDownloadUrl: (id) => `/api/documents/${id}/download`,

  // Import is a multipart upload — skip the JSON wrapper
  importCandidates: async (file, { dryRun = true } = {}) => {
    const form = new FormData();
    form.append('file', file);
    const url = `/api/candidates/import?dryRun=${dryRun ? 'true' : 'false'}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    });
    if (res.status === 401) handleUnauthorized();
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error(body?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  },
};
