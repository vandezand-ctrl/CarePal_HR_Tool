import { useState, useEffect, useMemo, useRef } from 'react';
import { Search as SearchIcon, X, Users, MapPin, Building2, ClipboardList } from 'lucide-react';
import { useData } from './DataContext.jsx';

// Tiny debounce hook — value updates only after `delay` ms of stillness on
// the input. Avoids re-filtering / re-rendering on every keystroke.
function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const RESULTS_PER_CATEGORY = 5;

/**
 * Global search bar — replaces the inert input that used to live in the
 * Header. Pure client-side: filters the candidates / requisitions arrays
 * already in DataContext. No backend, no API, no DB.
 *
 * Click handlers call `onNavigate(intent)` which the parent (AppShell) uses
 * to set both `section` and `navIntent` — target sections then read the
 * intent and apply the side-effect (open candidate modal, expand city, etc.).
 *
 * Keyboard support intentionally limited to Escape-to-close in v1; arrow-key
 * navigation through results is documented as a follow-up.
 */
export default function Search({ onNavigate }) {
  const { candidates: CANDIDATES, requisitions: REQUISITIONS } = useData();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const debouncedQuery = useDebounced(query, 300);
  const wrapperRef = useRef(null);

  // Close dropdown on click outside.
  useEffect(() => {
    function onDocClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }
  }, [isOpen]);

  // Close on Escape (when input is focused).
  function onKeyDown(e) {
    if (e.key === 'Escape') {
      setIsOpen(false);
      e.target.blur();
    }
  }

  // Compute results from DataContext arrays — case-insensitive substring match.
  const results = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return null; // null = no query yet, dropdown stays closed below

    // Candidates — match name, company, email
    const candidates = CANDIDATES.filter(c => {
      const hay = `${c.name} ${c.company || ''} ${c.email || ''}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, RESULTS_PER_CATEGORY);

    // Cities — derived from REQUISITIONS' unique city set. For each match,
    // also count how many open (non-Filled) requisitions exist there.
    const cityCounts = new Map();
    for (const r of REQUISITIONS) {
      if (r.status === 'Filled') continue;
      cityCounts.set(r.city, (cityCounts.get(r.city) || 0) + 1);
    }
    const cities = Array.from(cityCounts.keys())
      .filter(city => city.toLowerCase().includes(q))
      .map(city => ({ city, openCount: cityCounts.get(city) }))
      .slice(0, RESULTS_PER_CATEGORY);

    // Hospitals — derived from REQUISITIONS' unique hospital set. Show city.
    const hospitalsSeen = new Set();
    const hospitals = [];
    for (const r of REQUISITIONS) {
      if (!r.hospital || hospitalsSeen.has(r.hospital)) continue;
      if (r.hospital.toLowerCase().includes(q)) {
        hospitalsSeen.add(r.hospital);
        hospitals.push({ hospital: r.hospital, city: r.city });
        if (hospitals.length >= RESULTS_PER_CATEGORY) break;
      }
    }

    // Requisitions — match by id (REQ-001) OR hospital name.
    const reqs = REQUISITIONS.filter(r => {
      const hay = `${r.id} ${r.hospital || ''}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, RESULTS_PER_CATEGORY);

    return { candidates, cities, hospitals, reqs };
  }, [debouncedQuery, CANDIDATES, REQUISITIONS]);

  const totalCount = results
    ? results.candidates.length + results.cities.length + results.hospitals.length + results.reqs.length
    : 0;

  // Click handler factory — closes dropdown, clears focus, fires intent.
  const navigate = (intent) => {
    setIsOpen(false);
    onNavigate(intent);
    // Don't clear the query — user can refine without re-typing.
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <SearchIcon size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
        onFocus={() => { if (query) setIsOpen(true); }}
        onKeyDown={onKeyDown}
        placeholder="Search candidates, cities, hospitals, requisitions…"
        style={{
          paddingLeft: 30, paddingRight: query ? 28 : 12, paddingTop: 7, paddingBottom: 7,
          fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, width: 280,
          outline: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#374151',
        }}
      />
      {query && (
        <button
          onClick={() => { setQuery(''); setIsOpen(false); }}
          title="Clear search"
          style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2, display: 'flex' }}
        >
          <X size={12} />
        </button>
      )}

      {/* Dropdown */}
      {isOpen && results && (
        <div style={dropdownStyle}>
          {totalCount === 0 ? (
            <div style={{ padding: '14px 14px', fontSize: 12, color: '#94a3b8' }}>
              No results for <strong style={{ color: '#374151' }}>{debouncedQuery}</strong>
            </div>
          ) : (
            <>
              <Section
                title="Candidates"
                icon={Users}
                items={results.candidates}
                renderItem={c => {
                  const req = REQUISITIONS.find(r => r.id === c.reqId);
                  return (
                    <ResultRow
                      key={c.id}
                      primary={c.name}
                      secondary={`${c.reqId} · ${c.stage}${req ? ` · ${req.city}` : ''}`}
                      onClick={() => navigate({ type: 'candidate', candidateId: c.id, reqId: c.reqId })}
                    />
                  );
                }}
              />
              <Section
                title="Cities"
                icon={MapPin}
                items={results.cities}
                renderItem={({ city, openCount }) => (
                  <ResultRow
                    key={city}
                    primary={city}
                    secondary={`${openCount} open requisition${openCount === 1 ? '' : 's'}`}
                    onClick={() => navigate({ type: 'city', city })}
                  />
                )}
              />
              <Section
                title="Hospitals"
                icon={Building2}
                items={results.hospitals}
                renderItem={({ hospital, city }) => (
                  <ResultRow
                    key={hospital}
                    primary={hospital}
                    secondary={city}
                    onClick={() => navigate({ type: 'hospital', hospital })}
                  />
                )}
              />
              <Section
                title="Requisitions"
                icon={ClipboardList}
                items={results.reqs}
                renderItem={r => (
                  <ResultRow
                    key={r.id}
                    primary={`${r.id} — ${r.hospital || r.city}`}
                    secondary={`${r.city} · ${r.status} · ${r.bu}`}
                    onClick={() => navigate({ type: 'req', reqId: r.id })}
                  />
                )}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, items, renderItem }) {
  if (items.length === 0) return null;
  return (
    <div style={{ borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px 6px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <Icon size={11} />
        {title}
      </div>
      {items.map(renderItem)}
    </div>
  );
}

function ResultRow({ primary, secondary, onClick }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        width: '100%', padding: '8px 14px', border: 'none', background: 'transparent',
        cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", textAlign: 'left',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{primary}</span>
      <span style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{secondary}</span>
    </button>
  );
}

const dropdownStyle = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  right: 0,
  width: 360,
  maxHeight: '60vh',
  overflowY: 'auto',
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  boxShadow: '0 10px 30px rgba(0,0,0,0.10)',
  zIndex: 100,
};
