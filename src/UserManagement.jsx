import { useState, useEffect, useCallback } from 'react';
import { Shield, X, Check } from 'lucide-react';
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

function CityChips({ cities, role }) {
  if (role === 'admin') {
    return <span style={styles.allCitiesBadge}>All cities</span>;
  }
  if (!cities || cities.length === 0) {
    return <span style={styles.noCitiesBadge}>No cities assigned</span>;
  }
  const MAX_SHOW = 3;
  const shown = cities.slice(0, MAX_SHOW);
  const remaining = cities.length - MAX_SHOW;
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {shown.map(c => (
        <span key={c} style={styles.cityChip}>{c}</span>
      ))}
      {remaining > 0 && (
        <span style={styles.cityChipMore}>+{remaining}</span>
      )}
    </span>
  );
}

function EditPanel({ user, allCities, onClose, onSaved }) {
  const [role, setRole] = useState(user.role);
  const [selectedCities, setSelectedCities] = useState(new Set(user.cities || []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isAdmin = role === 'admin';
  const allSelected = allCities.length > 0 && selectedCities.size === allCities.length;

  function toggleCity(city) {
    setSelectedCities(prev => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city);
      else next.add(city);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelectedCities(new Set());
    else setSelectedCities(new Set(allCities));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (role !== user.role) {
        await api.updateUserRole(user.id, role);
      }
      if (!isAdmin) {
        await api.updateUserCities(user.id, [...selectedCities]);
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const hasChanges =
    role !== user.role ||
    (!isAdmin && (
      selectedCities.size !== (user.cities || []).length ||
      [...selectedCities].some(c => !(user.cities || []).includes(c))
    ));

  return (
    <>
      <div style={styles.overlay} onClick={onClose} />
      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Edit User</h2>
            <p style={styles.panelSubtitle}>{user.name}</p>
            <p style={{ ...styles.panelSubtitle, marginTop: 2 }}>{user.email}</p>
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <div style={styles.panelSection}>
          <label style={styles.fieldLabel}>Role</label>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            style={styles.roleSelect}
          >
            {ROLE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div style={styles.divider} />

        <div style={styles.panelSection}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={styles.fieldLabel}>City Access</label>
            {!isAdmin && (
              <span style={styles.cityCount}>{selectedCities.size} of {allCities.length}</span>
            )}
          </div>

          {isAdmin ? (
            <p style={styles.adminNote}>
              Admins always have access to all cities. City assignment only applies to Approver and TA roles.
            </p>
          ) : (
            <>
              <button onClick={toggleAll} style={styles.selectAllBtn}>
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
              <div style={styles.cityList}>
                {allCities.map(city => {
                  const checked = selectedCities.has(city);
                  return (
                    <label key={city} style={{
                      ...styles.cityItem,
                      background: checked ? '#f0fdfa' : '#fff',
                    }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCity(city)}
                        style={styles.checkbox}
                      />
                      <span style={{ color: checked ? '#0f766e' : '#374151' }}>{city}</span>
                    </label>
                  );
                })}
                {allCities.length === 0 && (
                  <p style={{ fontSize: 12, color: '#94a3b8', padding: 8 }}>
                    No cities found in the system yet.
                  </p>
                )}
              </div>
              <p style={styles.cityHint}>
                This user will only see requisitions, candidates, headcount, and dashboard data for the selected cities.
              </p>
            </>
          )}
        </div>

        <div style={styles.panelFooter}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button
            onClick={save}
            disabled={saving || !hasChanges}
            style={{
              ...styles.saveBtn,
              opacity: (saving || !hasChanges) ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </>
  );
}

export default function UserManagement({ me }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allCities, setAllCities] = useState([]);
  const [editingUser, setEditingUser] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, citiesData] = await Promise.all([
        api.listUsers(),
        api.listCities(),
      ]);
      setUsers(usersData);
      setAllCities(citiesData);
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleEditSaved() {
    setEditingUser(null);
    load();
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
            Manage role assignments and city access. New users default to <strong>TA team</strong> with no city access on first sign-in.
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
              <th style={styles.th}>Role</th>
              <th style={styles.th}>City Access</th>
              <th style={styles.th}>Last login</th>
              <th style={{ ...styles.th, width: 70 }}></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && !loading && (
              <tr>
                <td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: '#94a3b8' }}>
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
                  <td style={styles.td}>
                    <span style={styles.roleBadge}>{ROLE_LABEL[u.role] || u.role}</span>
                  </td>
                  <td style={styles.td}>
                    <CityChips cities={u.cities} role={u.role} />
                  </td>
                  <td style={styles.td}>
                    <span style={{ color: u.last_login_at ? '#374151' : '#94a3b8' }}>
                      {fmtLastLogin(u.last_login_at)}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <button
                      onClick={() => setEditingUser(u)}
                      style={styles.editBtn}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={styles.note}>
        Roles per the README: <strong>Admin</strong> has full access to all cities and can manage users;{' '}
        <strong>Approver</strong> can approve requisitions for their assigned cities;{' '}
        <strong>TA team</strong> can input candidates and schedule interviews for their assigned cities.
      </p>

      {editingUser && (
        <EditPanel
          user={editingUser}
          allCities={allCities}
          onClose={() => setEditingUser(null)}
          onSaved={handleEditSaved}
        />
      )}
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
  roleBadge: {
    display: 'inline-block',
    padding: '3px 10px',
    fontSize: 11,
    fontWeight: 600,
    color: '#374151',
    background: '#f1f5f9',
    borderRadius: 99,
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
  cityChip: {
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 500,
    color: '#0f766e',
    background: '#f0fdfa',
    borderRadius: 99,
    border: '1px solid #99f6e4',
  },
  cityChipMore: {
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 600,
    color: '#0d9488',
    background: '#f0fdfa',
    borderRadius: 99,
  },
  allCitiesBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 600,
    color: '#0f766e',
    background: '#ccfbf1',
    borderRadius: 99,
  },
  noCitiesBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 600,
    color: '#dc2626',
    background: '#fef2f2',
    borderRadius: 99,
    border: '1px solid #fecaca',
  },
  editBtn: {
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: '#0d9488',
    background: '#f0fdfa',
    border: '1px solid #99f6e4',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  note: {
    marginTop: 16,
    fontSize: 12,
    color: '#64748b',
    lineHeight: 1.5,
  },

  // Edit panel
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.3)',
    zIndex: 999,
  },
  panel: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: 420,
    maxWidth: '100vw',
    background: '#fff',
    boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '24px 24px 16px',
    borderBottom: '1px solid #e2e8f0',
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
  },
  panelSubtitle: {
    fontSize: 13,
    color: '#64748b',
    margin: 0,
    marginTop: 4,
  },
  closeBtn: {
    padding: 6,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: '#64748b',
    borderRadius: 6,
  },
  panelSection: {
    padding: '16px 24px',
  },
  fieldLabel: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  roleSelect: {
    width: '100%',
    fontSize: 13,
    padding: '8px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    background: '#fff',
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    color: '#374151',
    outline: 'none',
  },
  divider: {
    height: 1,
    background: '#e2e8f0',
    margin: '0 24px',
  },
  cityCount: {
    fontSize: 12,
    fontWeight: 600,
    color: '#0d9488',
    background: '#f0fdfa',
    padding: '2px 8px',
    borderRadius: 99,
  },
  adminNote: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 1.5,
    padding: '12px 14px',
    background: '#f0fdfa',
    borderRadius: 8,
    border: '1px solid #99f6e4',
    margin: 0,
  },
  selectAllBtn: {
    fontSize: 12,
    fontWeight: 600,
    color: '#0d9488',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    marginBottom: 8,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  cityList: {
    maxHeight: 280,
    overflowY: 'auto',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
  },
  cityItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: 13,
    borderBottom: '1px solid #f1f5f9',
  },
  checkbox: {
    accentColor: '#0d9488',
    width: 16,
    height: 16,
    cursor: 'pointer',
  },
  cityHint: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 8,
    lineHeight: 1.4,
  },
  panelFooter: {
    marginTop: 'auto',
    padding: '16px 24px',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  saveBtn: {
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    background: '#0d9488',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
};

// Re-export the label map so the header can stay in sync.
export { ROLE_LABEL };
