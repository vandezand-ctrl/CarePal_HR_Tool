// Thin fetch wrapper pointing at the local backend.
// Swap API_BASE in production (single config point).
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
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
