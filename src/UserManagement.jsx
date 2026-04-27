import { useState, useEffect, useCallback } from 'react';
import { Shield } from 'lucide-react';
import { api } from './api.js';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'approver', label: 'Approver' },
  { value: 'ta', label: 'TA team' },
];

const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map(r => [r.value, r.label]));

function fmtLastLogin(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return d.toLocaleDateString();
}

/**
 * User Management section. Only rendered for admins (gated in App.jsx).
 *
 * Loads its own user list (rather than relying on DataContext.users) so a
 * promotion immediately re-fetches the freshest version without coupling to
 * the global state. Optimistic updates: the dropdown changes UI right away
 * and rolls back if the PATCH fails.
 */
export default function UserManagement({ me }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  // Transient confirmation indicator. Cleared after 2s. The functional updater
  // + equality check below means rapid back-to-back changes only ever show the
  // most recent row's "Saved" — no flicker or stuck indicator on an old row.
  const [justSavedId, setJustSavedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changeRole(user, newRole) {
    if (user.role === newRole) return;
    setSavingId(user.id);
    setError(null);
    const previous = user.role;
    // Optimistic update.
    setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, role: newRole } : u)));
    try {
      const updated = await api.updateUserRole(user.id, newRole);
      setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
      // Show "✓ Saved" briefly. Equality check on clear prevents stomping a
      // newer save's indicator if Jesse changes another role within the window.
      setJustSavedId(user.id);
      setTimeout(
        () => setJustSavedId(curr => (curr === user.id ? null : curr)),
        2000,
      );
    } catch (err) {
      // Roll back.
      setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, role: previous } : u)));
      setError(`Couldn't change ${user.name}'s role: ${err.message || 'unknown error'}`);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            <Shield size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            User Management
          </h1>
          <p style={styles.subtitle}>
            Manage role assignments. New users default to <strong>TA team</strong> on first sign-in.
          </p>
        </div>
        <button onClick={load} style={styles.refreshBtn} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Domain</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Last login</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && !loading && (
              <tr>
                <td colSpan={5} style={{ ...styles.td, textAlign: 'center', color: '#94a3b8' }}>
                  No users yet.
                </td>
              </tr>
            )}
            {users.map(u => {
              const isMe = me && me.id === u.id;
              return (
                <tr key={u.id}>
                  <td style={styles.td}>
                    <strong>{u.name}</strong>
                    {isMe && <span style={styles.youBadge}>you</span>}
                  </td>
                  <td style={styles.td}>{u.email}</td>
                  <td style={styles.td}>{u.domain}</td>
                  <td style={styles.td}>
                    <select
                      value={u.role}
                      onChange={e => changeRole(u, e.target.value)}
                      disabled={savingId === u.id}
                      title={isMe ? 'You can demote yourself — another admin will need to promote you back' : `Change role for ${u.name}`}
                      style={styles.roleSelect}
                    >
                      {ROLE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {savingId === u.id && <span style={styles.savingHint}>saving…</span>}
                    {savingId !== u.id && justSavedId === u.id && (
                      <span style={styles.savedHint}>✓ Saved</span>
                    )}
                  </td>
                  <td style={styles.td}>
                    <span style={{ color: u.last_login_at ? '#374151' : '#94a3b8' }}>
                      {fmtLastLogin(u.last_login_at)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={styles.note}>
        Roles per the README: <strong>Admin</strong> has full access and can change roles here;{' '}
        <strong>Approver</strong> can approve requisitions; <strong>TA team</strong> can input candidates and schedule interviews.
        Display label "TA team" maps to DB role <code>ta</code>.
      </p>
    </div>
  );
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    color: '#0f172a',
    margin: 0,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    maxWidth: 600,
  },
  refreshBtn: {
    padding: '8px 14px',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    background: '#fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    color: '#374151',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  errorBox: {
    marginBottom: 16,
    padding: '10px 14px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 8,
    fontSize: 13,
    color: '#991b1b',
  },
  tableWrap: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  td: {
    padding: '12px 16px',
    fontSize: 13,
    color: '#374151',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'middle',
  },
  roleSelect: {
    fontSize: 12,
    padding: '6px 10px',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    background: '#fff',
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    color: '#374151',
    outline: 'none',
  },
  savingHint: {
    marginLeft: 8,
    fontSize: 11,
    color: '#64748b',
  },
  savedHint: {
    marginLeft: 8,
    fontSize: 11,
    color: '#059669',
    fontWeight: 600,
  },
  youBadge: {
    marginLeft: 8,
    padding: '2px 6px',
    fontSize: 10,
    fontWeight: 700,
    color: '#0f766e',
    background: '#ccfbf1',
    borderRadius: 99,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  note: {
    marginTop: 16,
    fontSize: 12,
    color: '#64748b',
    lineHeight: 1.5,
  },
};

// Re-export the label map so the header can stay in sync.
export { ROLE_LABEL };
