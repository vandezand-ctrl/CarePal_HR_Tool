// Thin fetch wrapper pointing at the local backend.
// Swap API_BASE in production (single config point).
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

// Mock-auth user email. Read from localStorage so the dev user switcher persists across reloads.
// Default: Akhlaque (TA) — same as a typical recruiter session.
const DEFAULT_USER_EMAIL = 'akhlaque@carepalmoney.com';

export function getCurrentUserEmail() {
  return localStorage.getItem('devUserEmail') || DEFAULT_USER_EMAIL;
}

export function setCurrentUserEmail(email) {
  localStorage.setItem('devUserEmail', email);
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': getCurrentUserEmail(),
      ...(options.headers || {}),
    },
    ...options,
  });
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
  listRequisitions: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v && v !== 'all') params.set(k, v); });
    const qs = params.toString();
    return request(`/api/requisitions${qs ? `?${qs}` : ''}`);
  },
  getRequisition: (id) => request(`/api/requisitions/${id}`),
  createRequisition: (input) => request('/api/requisitions', { method: 'POST', body: JSON.stringify(input) }),
  updateRequisition: (id, patch) => request(`/api/requisitions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
};
