// Thin fetch wrapper. Uses relative `/api/...` paths — Vite's dev server proxies
// them to the backend (see vite.config.js). In production, Express serves both
// the built frontend and the API from the same origin, so relative paths still work.

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
  const res = await fetch(path, {
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

  listCandidates: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v && v !== 'all') params.set(k, v); });
    const qs = params.toString();
    return request(`/api/candidates${qs ? `?${qs}` : ''}`);
  },
  getCandidate: (id) => request(`/api/candidates/${id}`),
  createCandidate: (input) => request('/api/candidates', { method: 'POST', body: JSON.stringify(input) }),
  updateCandidate: (id, patch) => request(`/api/candidates/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  listHeadcount: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v && v !== 'all') params.set(k, v); });
    const qs = params.toString();
    return request(`/api/headcount${qs ? `?${qs}` : ''}`);
  },
  listInterviewers: () => request('/api/interviewers'),
  listInterviews: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    const qs = params.toString();
    return request(`/api/interviews${qs ? `?${qs}` : ''}`);
  },
  scheduleInterview: (input) => request('/api/interviews', { method: 'POST', body: JSON.stringify(input) }),
  recordInterviewResult: (id, result) => request(`/api/interviews/${id}`, { method: 'PATCH', body: JSON.stringify({ result }) }),
  offerCandidate: (id, offerDate) => request(`/api/candidates/${id}/offer`, { method: 'POST', body: JSON.stringify({ offerDate }) }),
  recordJoin: (id, joinDate) => request(`/api/candidates/${id}/join`, { method: 'POST', body: JSON.stringify({ joinDate }) }),
};
