import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import {
  LayoutDashboard, ClipboardList, Users, CalendarCheck, Inbox,
  Plus, X, ChevronRight, ChevronDown, Phone, Mail,
  MapPin, Clock, Check, FileText, AlertCircle, Shield, Pencil, Bell
} from "lucide-react";
import { DataProvider, useData } from "./DataContext.jsx";
import { api, AUTH_MODE, setIdToken, getIdToken } from "./api.js";
import Login from "./Login.jsx";
import UserManagement from "./UserManagement.jsx";
import ScheduleInterviewModal from "./ScheduleInterviewModal.jsx";
import Search from "./Search.jsx";
import { googleLogout } from "@react-oauth/google";

/* ─── GLOBAL FONT ──────────────────────────────────────────── */
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body, #root { font-family: 'Plus Jakarta Sans', sans-serif; height: 100%; }
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: #f1f5f9; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
  `}</style>
);

/* ─── MOCK DATA ─────────────────────────────────────────────── */
// Requisitions now come from the backend via DataContext.
// Requisitions and candidates now come from the backend via DataContext.
// HEADCOUNT stays inline until Stage 5.

// Pipeline stages — extended in PR-E (C3) with Training + Active so the
// dashboard reflects the full post-join lifecycle. Order must match the
// backend's PIPELINE_STAGES.
const STAGES = ["Sourced","R1 Scheduled","R1 Complete","R2 Scheduled","R2 Complete","Offered","Joined","Training","Active"];

// HEADCOUNT comes from the backend via DataContext (auto-calculated per city+BU).

/* ─── STYLE HELPERS ────────────────────────────────────────── */
const S = {
  primary: "#0d9488",
  primaryDark: "#0f766e",
  sidebar: "#0f4c46",
  sidebarHover: "#1a5c55",
  sidebarActive: "#0d9488",
};

const STATUS_CLS = {
  "Pending Approval": { bg:"#fef3c7", color:"#92400e", dot:"#f59e0b" },
  "Approved":         { bg:"#dbeafe", color:"#1e40af", dot:"#3b82f6" },
  "Active":           { bg:"#d1fae5", color:"#065f46", dot:"#10b981" },
  "Filled":           { bg:"#f1f5f9", color:"#64748b", dot:"#94a3b8" },
};

const STAGE_CLS = {
  "Sourced":      "#64748b",
  "R1 Scheduled": "#2563eb",
  "R1 Complete":  "#0891b2",
  "R2 Scheduled": "#7c3aed",
  "R2 Complete":  "#6d28d9",
  "Offered":      "#d97706",
  "Joined":       "#059669",
  "Training":     "#2563eb",
  "Active":       "#047857",
};

const fmt = n => n != null ? `₹${(n/1000).toFixed(0)}k` : "—";

/* ─── ATOMS ─────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const s = STATUS_CLS[status] || STATUS_CLS["Filled"];
  return (
    <span style={{ background:s.bg, color:s.color, display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px", borderRadius:99, fontSize:11, fontWeight:600 }}>
      <span style={{ width:6, height:6, borderRadius:99, background:s.dot, display:"inline-block" }} />
      {status}
    </span>
  );
}

function StageBadge({ stage }) {
  const c = STAGE_CLS[stage] || "#94a3b8";
  return (
    <span style={{ background:`${c}18`, color:c, padding:"2px 8px", borderRadius:99, fontSize:11, fontWeight:600 }}>
      {stage}
    </span>
  );
}

function BUBadge({ bu }) {
  return (
    <span style={{ background: bu === "CPM" ? "#dbeafe" : "#ede9fe", color: bu === "CPM" ? "#1e40af" : "#5b21b6", padding:"2px 8px", borderRadius:99, fontSize:11, fontWeight:600 }}>
      {bu === "CPM" ? "CPM · Lending" : "IGIV · Crowdfunding"}
    </span>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", padding:"20px 22px" }}>
      <div style={{ fontSize:32, fontWeight:800, color, fontFamily:"'DM Mono', monospace" }}>{value}</div>
      <div style={{ fontSize:13, fontWeight:600, color:"#374151", marginTop:4 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function Th({ children }) {
  return <th style={{ padding:"9px 10px", textAlign:"left", fontSize:11, fontWeight:600, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.03em", whiteSpace:"nowrap" }}>{children}</th>;
}
function Td({ children, style }) {
  return <td style={{ padding:"10px 10px", fontSize:13, borderBottom:"1px solid #f1f5f9", verticalAlign:"middle", ...style }}>{children}</td>;
}

/* ─── SIDEBAR ───────────────────────────────────────────────── */
const NAV = [
  { id:"dashboard",    label:"Dashboard",    icon:LayoutDashboard },
  { id:"inbox",        label:"Inbox",        icon:Inbox, roles:["ta","admin"] },
  { id:"requisitions", label:"Requisitions", icon:ClipboardList },
  { id:"pipeline",     label:"Candidates",   icon:Users },
  { id:"interviews",   label:"Interviews",   icon:CalendarCheck },
  { id:"users",        label:"User Management", icon:Shield, adminOnly:true },
];

// First two letters of the first two whitespace-separated words in a name,
// uppercased. "Jesse van de Zand" -> "JV", "Sahil" -> "SA", "" -> "?".
function initials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const SIDEBAR_ROLE_LABEL = { admin: "Admin", approver: "Approver", ta: "TA team" };

// PR-L: format multi-TA assignment for compact list/card display.
// 1-2 names: comma-separated. 3+: first two + " +N more".
function formatAssignees(assignedTas) {
  if (!assignedTas || assignedTas.length === 0) return "—";
  if (assignedTas.length <= 2) return assignedTas.map((t) => t.name).join(", ");
  const more = assignedTas.length - 2;
  return `${assignedTas[0].name}, ${assignedTas[1].name} +${more} more`;
}

function Sidebar({ active, onNav, role }) {
  const items = NAV.filter(n => {
    if (n.adminOnly) return role === 'admin';
    if (n.roles) return n.roles.includes(role);
    return true;
  });
  const { me, unseenInboxCount } = useData();
  return (
    <div style={{ width:220, flexShrink:0, background:S.sidebar, display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Logo */}
      <div style={{ padding:"20px 18px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
        <img src="https://carepalmoney.com/assets/img/carepal-logo.png" alt="CarePal" style={{ height:28, objectFit:"contain", filter:"brightness(0) invert(1)" }}
          onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="block"; }} />
        <div style={{ display:"none", color:"#fff", fontWeight:800, fontSize:16 }}>CarePal</div>
        <div style={{ color:"rgba(255,255,255,0.45)", fontSize:10, fontWeight:600, letterSpacing:"0.1em", marginTop:5, textTransform:"uppercase" }}>HR Admin</div>
      </div>
      {/* Nav */}
      <nav style={{ flex:1, padding:"12px 10px", display:"flex", flexDirection:"column", gap:2 }}>
        {items.map(({ id, label, icon:Icon }) => {
          const isActive = active === id;
          return (
            <button key={id} onClick={() => onNav(id)} style={{
              display:"flex", alignItems:"center", gap:10, padding:"9px 12px",
              borderRadius:10, border:"none", cursor:"pointer", textAlign:"left",
              background: isActive ? S.sidebarActive : "transparent",
              color: isActive ? "#fff" : "rgba(255,255,255,0.55)",
              fontSize:13, fontWeight:isActive ? 600 : 500,
              fontFamily:"'Plus Jakarta Sans', sans-serif",
              transition:"all 0.15s",
            }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = S.sidebarHover; e.currentTarget.style.color="#fff"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; e.currentTarget.style.color="rgba(255,255,255,0.55)"; }}>
              <Icon size={15} />
              <span style={{ flex:1 }}>{label}</span>
              {id === "inbox" && unseenInboxCount > 0 && (
                <span style={{
                  background:S.primary, color:"#fff", fontSize:10, fontWeight:700,
                  borderRadius:10, padding:"1px 6px", minWidth:18, textAlign:"center",
                }}>{unseenInboxCount}</span>
              )}
            </button>
          );
        })}
      </nav>
      {/* User */}
      <div style={{ padding:"14px 14px", borderTop:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:"50%", background:S.primary, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:12, fontWeight:700, flexShrink:0 }}>{initials(me?.name)}</div>
        <div style={{ minWidth:0 }}>
          <div style={{ color:"#fff", fontSize:12, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:140 }}>{me?.name || "Loading…"}</div>
          <div style={{ color:"rgba(255,255,255,0.4)", fontSize:10 }}>{me ? (SIDEBAR_ROLE_LABEL[me.role] || me.role) : ""}</div>
        </div>
      </div>
    </div>
  );
}

/* ─── HEADER ────────────────────────────────────────────────── */
const ROLE_LABEL = { admin: "Admin", approver: "Approver", ta: "TA team" };

function handleSignOut() {
  setIdToken(null);
  try { googleLogout(); } catch { /* google sdk may not be ready */ }
  window.location.reload();
}

function Header({ bu, setBu, onNavigate }) {
  const { me, users, switchUser } = useData();
  const roleColors = {
    admin: { bg: "#fef3c7", text: "#92400e" },
    approver: { bg: "#dbeafe", text: "#1e40af" },
    ta: { bg: "#d1fae5", text: "#065f46" },
  };
  const roleBadge = me && roleColors[me.role];
  return (
    <div style={{ height:56, background:"#fff", borderBottom:"1px solid #e2e8f0", display:"flex", alignItems:"center", padding:"0 24px", gap:12, flexShrink:0 }}>
      <div style={{ display:"flex", background:"#f1f5f9", borderRadius:10, padding:3, gap:1 }}>
        {[["all","All Units"],["CPM","CPM · Lending"],["IGIV","IGIV · Crowdfunding"]].map(([v, l]) => (
          <button key={v} onClick={() => setBu(v)} style={{
            padding:"5px 12px", borderRadius:8, border:"none", cursor:"pointer",
            background: bu === v ? "#fff" : "transparent",
            boxShadow: bu === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            color: bu === v ? S.primary : "#64748b",
            fontSize:12, fontWeight:600,
            fontFamily:"'Plus Jakarta Sans', sans-serif",
            transition:"all 0.15s",
          }}>{l}</button>
        ))}
      </div>
      <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:12 }}>
        <Search onNavigate={onNavigate}/>
        {me && (
          <div style={{ display:"flex", alignItems:"center", gap:8, paddingLeft:12, borderLeft:"1px solid #e2e8f0" }}>
            <span style={{ fontSize:10, fontWeight:700, color:roleBadge.text, background:roleBadge.bg, padding:"3px 8px", borderRadius:99, textTransform:"uppercase", letterSpacing:0.4 }}>
              {ROLE_LABEL[me.role] || me.role}
            </span>
            {AUTH_MODE === "mock" ? (
              <select
                value={me.email}
                onChange={(e) => switchUser(e.target.value)}
                title="Dev user switcher (mock auth)"
                style={{ fontSize:12, border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 10px", background:"#fff", cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", color:"#374151", outline:"none", maxWidth:200 }}
              >
                {users.map(u => (
                  <option key={u.email} value={u.email}>{u.name} — {u.role}</option>
                ))}
              </select>
            ) : (
              <>
                <span style={{ fontSize:12, color:"#374151", fontWeight:600 }}>{me.name}</span>
                <button
                  onClick={handleSignOut}
                  style={{ fontSize:12, border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 10px", background:"#fff", cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", color:"#64748b" }}
                  title="Sign out"
                >
                  Sign out
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── DASHBOARD ─────────────────────────────────────────────── */
function Dashboard({ bu, onNav, setReqFilter, navIntent, clearNavIntent }) {
  const [expandedCity, setExpandedCity] = useState(null);
  const { requisitions: REQUISITIONS, candidates: CANDIDATES, me } = useData();
  const isAdmin = me?.role === 'admin';
  const isTA = me?.role === 'ta';

  // Inline AOP edit — admin clicks the pencil on a Target HC cell, types a
  // new value, presses Enter or Save. Only one cell editable at a time.
  // editingKey is `${city}|${bu}` since (city, bu) is the headcount PK; the
  // sentinel `${city}|all` opens the two-BU editor that PR-N introduced for
  // the All-BUs view (since "All" sums two records, the single-input form
  // would lose granularity).
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');
  // PR-O: "Got it" handler on the changes-since-you-last-viewed toast.
  const [aopSeenSaving, setAopSeenSaving] = useState(false);
  const [editValueByBu, setEditValueByBu] = useState({ CPM: '', IGIV: '' });
  const [editError, setEditError] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  // Search → city: pre-expand the matching City Summary row, then clear the
  // intent so navigating away + back doesn't re-expand it. The lint rule
  // discourages setState in effects, but here the intent IS the external
  // trigger we're syncing into local state — exactly the pattern the rule
  // exempts. clearNavIntent on next tick guarantees a single cascade.
  useEffect(() => {
    if (navIntent?.type === 'city') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpandedCity(navIntent.city);
      clearNavIntent();
    }
  }, [navIntent, clearNavIntent]);

  // Server-side aggregation — one request, authoritative numbers.
  const [dash, setDash] = useState(null);
  const [dashError, setDashError] = useState(null);
  // Bumped after a successful AOP edit to force the data effect to refetch.
  const [reloadTick, setReloadTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setDashError(null);
        const data = await api.getDashboard(bu);
        if (!cancelled) setDash(data);
      } catch (err) {
        if (!cancelled) setDashError(err.message || "Failed to load dashboard");
      }
    })();
    return () => { cancelled = true; };
    // Re-fetch whenever bu changes, or whenever the reqs/cands lists mutate
    // (approval, stage transition, import, etc.) so the dashboard stays live.
  }, [bu, REQUISITIONS, CANDIDATES, reloadTick]);

  function startEdit(city, rowBu, currentAop) {
    setEditingKey(`${city}|${rowBu}`);
    setEditValue(String(currentAop));
    setEditError(null);
  }
  // PR-N: All-BUs editor — opens the two-input form prefilled with both BU
  // values. We intentionally keep this separate from the single-BU `startEdit`
  // so the inline editor stays one-input-fast for admins setting many cells
  // in one BU back-to-back.
  function startEditAll(city, aopByBu) {
    setEditingKey(`${city}|all`);
    setEditValueByBu({ CPM: String(aopByBu.CPM), IGIV: String(aopByBu.IGIV) });
    setEditError(null);
  }
  function cancelEdit() {
    setEditingKey(null);
    setEditValue('');
    setEditValueByBu({ CPM: '', IGIV: '' });
    setEditError(null);
  }
  async function saveEdit(city, rowBu) {
    setEditError(null);
    const n = Number(editValue);
    if (!Number.isInteger(n) || n < 0) {
      setEditError('Must be a non-negative whole number');
      return;
    }
    try {
      setEditSaving(true);
      await api.updateHeadcountTarget(city, rowBu, n);
      setEditingKey(null);
      setEditValue('');
      setReloadTick((t) => t + 1);
    } catch (err) {
      setEditError(err?.message || 'Save failed');
    } finally {
      setEditSaving(false);
    }
  }
  async function saveEditAll(city, originalAopByBu) {
    setEditError(null);
    const cpm = Number(editValueByBu.CPM);
    const igiv = Number(editValueByBu.IGIV);
    if (!Number.isInteger(cpm) || cpm < 0 || !Number.isInteger(igiv) || igiv < 0) {
      setEditError('Both values must be non-negative whole numbers');
      return;
    }
    try {
      setEditSaving(true);
      // Only send PATCHes for values that actually changed — keeps the audit
      // trail (and any future notification feed) precise.
      const calls = [];
      if (cpm !== originalAopByBu.CPM) calls.push(api.updateHeadcountTarget(city, 'CPM', cpm));
      if (igiv !== originalAopByBu.IGIV) calls.push(api.updateHeadcountTarget(city, 'IGIV', igiv));
      if (calls.length === 0) {
        setEditingKey(null);
        setEditValueByBu({ CPM: '', IGIV: '' });
        return;
      }
      await Promise.all(calls);
      setEditingKey(null);
      setEditValueByBu({ CPM: '', IGIV: '' });
      setReloadTick((t) => t + 1);
    } catch (err) {
      setEditError(err?.message || 'Save failed');
    } finally {
      setEditSaving(false);
    }
  }

  // PR-O: "Got it" handler. POSTs the seen timestamp, then bumps reloadTick
  // so the dashboard refetches and the toast disappears (driven entirely by
  // dash.unseenAopChanges from the backend — single source of truth).
  async function handleAopSeen() {
    try {
      setAopSeenSaving(true);
      await api.markAopSeen();
      setReloadTick((t) => t + 1);
    } finally {
      setAopSeenSaving(false);
    }
  }

  if (dashError) return <div style={{ padding:24, color:"#dc2626", fontSize:13 }}>Dashboard error: {dashError}</div>;
  if (!dash) return <div style={{ padding:24, color:"#64748b", fontSize:13 }}>Loading dashboard…</div>;

  const { funnel, pendingApprovals, cityBreakdown: cityRows } = dash;
  const maxF = Math.max(...funnel.map(f => f.count), 1);
  // reqs used by the expandable city rows (lookup by city for hospital detail)
  const reqs = REQUISITIONS.filter(r => bu === "all" || r.bu === bu);

  // Headcount totals across all city rows. Notice/PIP/Training are placeholder
  // zeros until the Sujeet integration lands — At Risk will start showing real
  // numbers automatically when the backend stops returning zeros.
  const tot = cityRows.reduce(
    (acc, r) => ({
      aop: acc.aop + r.aopTotal,
      active: acc.active + r.activeTotal,
      notice: acc.notice + r.noticeTotal,
      pip: acc.pip + r.pipTotal,
      training: acc.training + r.trainingTotal,
      offered: acc.offered + r.offeredTotal,
      deficit: acc.deficit + r.deficitTotal,
    }),
    { aop: 0, active: 0, notice: 0, pip: 0, training: 0, offered: 0, deficit: 0 },
  );
  const atRisk = tot.notice + tot.pip;

  // PR-O: list of AOP changes by other admins since this admin last
  // acknowledged. Empty array for non-admins (backend short-circuits).
  const unseenAopChanges = dash.unseenAopChanges ?? [];
  const VISIBLE_CHANGES = 5;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* PR-O: "changes since you last viewed" toast. Shown to admins when
          another admin has edited an AOP target since this user's last
          last_aop_seen_at. "Got it" bumps the timestamp and the toast
          disappears via the dash refetch. */}
      {isAdmin && unseenAopChanges.length > 0 && (
        <div style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"14px 16px", background:"#dbeafe", border:"1px solid #bfdbfe", borderRadius:12 }}
             data-testid="aop-changes-toast">
          <Bell size={16} color="#1e40af" style={{ marginTop:2, flexShrink:0 }} />
          <div style={{ flex:1, fontSize:13, color:"#1e3a8a", lineHeight:1.55 }}>
            <strong>{unseenAopChanges.length} AOP target{unseenAopChanges.length === 1 ? '' : 's'} changed since you last viewed</strong>
            <ul style={{ margin:"6px 0 0", paddingLeft:18, listStyle:"disc" }}>
              {unseenAopChanges.slice(0, VISIBLE_CHANGES).map((c, i) => (
                <li key={`${c.city}|${c.bu}|${i}`} style={{ marginBottom:2 }}>
                  <strong>{c.city} {c.bu}</strong> (now {c.aop}) — {c.updatedBy.name},{' '}
                  <span style={{ color:"#475569" }}>
                    {new Date(c.updatedAt).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                  </span>
                </li>
              ))}
              {unseenAopChanges.length > VISIBLE_CHANGES && (
                <li style={{ color:"#475569", fontStyle:"italic" }}>
                  + {unseenAopChanges.length - VISIBLE_CHANGES} more
                </li>
              )}
            </ul>
          </div>
          <button onClick={handleAopSeen} disabled={aopSeenSaving}
                  style={{ padding:"6px 12px", border:"1px solid #1e40af", borderRadius:8, background:"#1e40af", color:"#fff", fontSize:12, fontWeight:600, cursor: aopSeenSaving ? "wait" : "pointer", flexShrink:0 }}>
            {aopSeenSaving ? "…" : "Got it"}
          </button>
        </div>
      )}

      {/* PR-N: empty-state nudge for the cold-start admin flow. Backend
          decides via shouldShowEmptyTargetsBanner — gated to All-BUs +
          all-zero rows, so we don't need to recompute on the client. */}
      {isAdmin && dash.showEmptyTargetsBanner && (
        <div style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"12px 16px", background:"#fef3c7", border:"1px solid #fde68a", borderRadius:12 }}
             data-testid="aop-empty-banner">
          <AlertCircle size={16} color="#92400e" style={{ marginTop:1, flexShrink:0 }} />
          <div style={{ fontSize:13, color:"#92400e", lineHeight:1.5 }}>
            <strong>Add Annual Operating Plan targets to enable headcount tracking.</strong>{' '}
            Click any city's <em>Target HC</em> in the table below.
          </div>
        </div>
      )}

      {/* Stat row — Headcount-focused per Sahil's "exact view" feedback.
          PR-J: hidden for TAs since headcount planning isn't their job. */}
      {!isTA && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
          <StatCard label="Target Headcount (AOP)" value={tot.aop}    sub="Approved positions total" color="#0f172a" />
          <StatCard label="Active Headcount"       value={tot.active} sub="Deployed & productive"    color="#059669" />
          <StatCard label="At Risk (Notice + PIP)" value={atRisk}     sub="Potential vacancies"      color="#d97706" />
          <StatCard label="Net Deficit"            value={tot.deficit} sub="Roles to be filled"      color={tot.deficit>0?"#dc2626":"#059669"} />
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns: isTA ? "1fr" : "1fr 300px", gap:14 }}>
        {/* Funnel */}
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", padding:22 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#0f172a", marginBottom:18 }}>Hiring Funnel</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {funnel.map(({ stage, count }) => (
              <div key={stage} style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:108, fontSize:11, color:"#64748b", textAlign:"right", flexShrink:0, fontWeight:500 }}>{stage}</div>
                <div style={{ flex:1, background:"#f1f5f9", borderRadius:99, height:18, position:"relative", overflow:"hidden" }}>
                  <div style={{ height:18, borderRadius:99, background:`linear-gradient(90deg, ${S.primary}, #14b8a6)`, width:`${Math.max(5,(count/maxF)*100)}%`, transition:"width 0.3s" }} />
                </div>
                <div style={{ width:20, fontSize:12, fontWeight:700, color:"#374151", fontFamily:"'DM Mono', monospace" }}>{count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending approvals — hidden for TAs (PR-J): not relevant to their workflow. */}
        {!isTA && (
          <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", padding:22 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#0f172a", marginBottom:14 }}>
              Pending Approvals
              {pendingApprovals.length > 0 && <span style={{ marginLeft:8, background:"#fef3c7", color:"#92400e", padding:"1px 7px", borderRadius:99, fontSize:11, fontWeight:600 }}>{pendingApprovals.length}</span>}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {pendingApprovals.length === 0
                ? <div style={{ fontSize:12, color:"#94a3b8", textAlign:"center", padding:"20px 0" }}>No pending approvals</div>
                : pendingApprovals.map(r => (
                  <div key={r.id} style={{ padding:"10px 12px", background:"#fffbeb", borderRadius:10, border:"1px solid #fde68a", cursor:"pointer" }}
                    onClick={() => { setReqFilter(r.id); onNav("pipeline"); }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                      {/* Hospital is now the headline (R1 polish from Apr 29 backlog) — Sahil's
                          "I cannot work with REQ-number + Focus BD" feedback. */}
                      <div style={{ fontSize:12, fontWeight:600, color:"#1e293b" }}>{r.hospital || "Hospital TBD"} · {r.city}</div>
                      <BUBadge bu={r.bu} />
                    </div>
                    <div style={{ fontSize:11, color:"#64748b", marginTop:3 }}>{r.bdType} BD · {r.hireType} hire</div>
                    <div style={{ fontSize:11, color:"#92400e", marginTop:4 }}>Raised by {r.raisedBy} · <span style={{ fontWeight:600 }}>{r.status}</span></div>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>

      {/* City table — merged from the old Headcount tab. Notice/PIP/Training
          show 0 until the Sujeet integration lands. PR-N: pencil-edit is
          admin-only but available in every BU view — All-BUs uses a
          two-input editor (one per BU) so granularity is preserved without
          forcing a filter switch. */}
      <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", overflow:"hidden" }}>
        <div style={{ padding:"16px 20px", borderBottom:"1px solid #f1f5f9", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>Headcount by City {bu!=="all"?`· ${bu}`:""}</span>
          <span style={{ fontSize:11, color:"#94a3b8" }}>Deficit = Target HC − Active</span>
        </div>
        <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:780 }}>
          <thead style={{ background:"#f8fafc" }}>
            <tr>{["City","BU","Target HC","Active","On Notice","PIP","In Training","Offered","Open","Deficit"].map(h=><Th key={h}>{h}</Th>)}</tr>
          </thead>
          <tbody>
            {cityRows.map((r) => {
              const { city, aopTotal, aopByBu, activeTotal, noticeTotal, pipTotal, trainingTotal, offeredTotal, openReqs, deficitTotal } = r;
              const isExpanded = expandedCity === city;
              const cityReqs = reqs.filter(req=>req.city===city && req.status!=="Filled");
              const editKey = `${city}|${bu}`;
              const isEditing = editingKey === editKey;
              // PR-N: gate dropped — admin can edit in any BU view. The All
              // view opens a two-input editor (one per BU); single-BU views
              // stay on the fast inline form.
              const canEditCell = isAdmin;
              return (
                <Fragment key={city}>
                  <tr style={{ cursor:"pointer", background:isExpanded?"#f8fafc":"transparent" }}
                    onClick={()=>setExpandedCity(isExpanded?null:city)}
                    onMouseEnter={e=>{if(!isExpanded)e.currentTarget.style.background="#f8fafc";}}
                    onMouseLeave={e=>{if(!isExpanded)e.currentTarget.style.background="transparent";}}>
                    <Td style={{ fontWeight:600, color:"#0f172a" }}>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
                        {isExpanded ? <ChevronDown size={12} color="#94a3b8"/> : <ChevronRight size={12} color="#94a3b8"/>}
                        {city}
                      </span>
                    </Td>
                    <Td>{bu==="all" ? <span style={{ color:"#94a3b8", fontSize:11 }}>All</span> : <BUBadge bu={bu}/>}</Td>
                    <Td style={{ color:"#374151", fontFamily:"'DM Mono', monospace" }}
                        onClick={(e)=>{ if (isEditing) e.stopPropagation(); }}>
                      {isEditing && bu !== 'all' ? (
                        <span style={{ display:"inline-flex", alignItems:"center", gap:6 }} onClick={(e)=>e.stopPropagation()}>
                          <input type="number" min="0" step="1" value={editValue}
                                 onChange={(e)=>setEditValue(e.target.value)}
                                 onKeyDown={(e)=>{ if (e.key==='Enter') saveEdit(city, bu); if (e.key==='Escape') cancelEdit(); }}
                                 style={{ width:60, padding:"3px 6px", border:"1px solid #cbd5e1", borderRadius:6, fontFamily:"'DM Mono', monospace", fontSize:12 }}
                                 autoFocus disabled={editSaving} />
                          <button onClick={()=>saveEdit(city, bu)} disabled={editSaving}
                                  style={{ padding:"3px 8px", border:"none", borderRadius:6, background:"#0f766e", color:"#fff", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                            {editSaving ? "…" : "Save"}
                          </button>
                          <button onClick={cancelEdit} disabled={editSaving}
                                  style={{ padding:"3px 8px", border:"1px solid #e2e8f0", borderRadius:6, background:"#fff", fontSize:11, color:"#64748b", cursor:"pointer" }}>
                            Cancel
                          </button>
                          {editError && <span style={{ fontSize:10, color:"#dc2626" }}>{editError}</span>}
                        </span>
                      ) : isEditing && bu === 'all' ? (
                        // PR-N: All-BUs editor — two stacked inputs, one per BU.
                        <span style={{ display:"inline-flex", flexDirection:"column", gap:4 }}
                              onClick={(e)=>e.stopPropagation()}
                              data-testid={`aop-editor-all-${city}`}>
                          {['CPM', 'IGIV'].map((b) => (
                            <span key={b} style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <span style={{ fontSize:10, fontWeight:600, color:"#64748b", width:34 }}>{b}</span>
                              <input type="number" min="0" step="1" value={editValueByBu[b]}
                                     onChange={(e)=>setEditValueByBu((v)=>({ ...v, [b]: e.target.value }))}
                                     onKeyDown={(e)=>{ if (e.key==='Enter') saveEditAll(city, aopByBu); if (e.key==='Escape') cancelEdit(); }}
                                     style={{ width:54, padding:"2px 6px", border:"1px solid #cbd5e1", borderRadius:6, fontFamily:"'DM Mono', monospace", fontSize:12 }}
                                     autoFocus={b==='CPM'} disabled={editSaving}
                                     aria-label={`Target HC for ${city} ${b}`} />
                            </span>
                          ))}
                          <span style={{ display:"flex", gap:6, marginTop:2 }}>
                            <button onClick={()=>saveEditAll(city, aopByBu)} disabled={editSaving}
                                    style={{ padding:"3px 8px", border:"none", borderRadius:6, background:"#0f766e", color:"#fff", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                              {editSaving ? "…" : "Save"}
                            </button>
                            <button onClick={cancelEdit} disabled={editSaving}
                                    style={{ padding:"3px 8px", border:"1px solid #e2e8f0", borderRadius:6, background:"#fff", fontSize:11, color:"#64748b", cursor:"pointer" }}>
                              Cancel
                            </button>
                          </span>
                          {editError && <span style={{ fontSize:10, color:"#dc2626" }}>{editError}</span>}
                        </span>
                      ) : (
                        <span style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
                          {aopTotal}
                          {canEditCell && (
                            <button title="Edit Target HC (admin)"
                                    onClick={(e)=>{
                                      e.stopPropagation();
                                      if (bu === 'all') startEditAll(city, aopByBu);
                                      else startEdit(city, bu, aopTotal);
                                    }}
                                    style={{ background:"transparent", border:"none", padding:0, cursor:"pointer", display:"inline-flex", alignItems:"center" }}>
                              <Pencil size={13} color="#475569"/>
                            </button>
                          )}
                        </span>
                      )}
                    </Td>
                    <Td style={{ color:"#059669", fontWeight:600, fontFamily:"'DM Mono', monospace" }}>{activeTotal}</Td>
                    <Td style={{ fontFamily:"'DM Mono', monospace", color:noticeTotal>0?"#d97706":"#cbd5e1" }}>{noticeTotal}</Td>
                    <Td style={{ fontFamily:"'DM Mono', monospace", color:pipTotal>0?"#dc2626":"#cbd5e1" }}>{pipTotal}</Td>
                    <Td style={{ fontFamily:"'DM Mono', monospace", color:trainingTotal>0?"#2563eb":"#cbd5e1" }}>{trainingTotal}</Td>
                    <Td style={{ fontFamily:"'DM Mono', monospace", color:offeredTotal>0?"#0f766e":"#cbd5e1" }}>{offeredTotal}</Td>
                    <Td>{openReqs>0 ? <span style={{ color:"#d97706", fontWeight:700, fontFamily:"'DM Mono', monospace" }}>{openReqs}</span> : <span style={{ color:"#cbd5e1" }}>0</span>}</Td>
                    <Td><span style={{ fontFamily:"'DM Mono', monospace", fontWeight:800, color:deficitTotal>0?"#dc2626":deficitTotal<0?"#059669":"#94a3b8" }}>{deficitTotal>0?`+${deficitTotal}`:deficitTotal}</span></Td>
                  </tr>
                  {isExpanded && cityReqs.length > 0 && cityReqs.map(req=>(
                    <tr key={req.id} style={{ background:"#fafafa" }}>
                      <Td style={{ paddingLeft:36, color:"#64748b", fontSize:12 }} colSpan="2">{req.hospital||req.area||"—"}</Td>
                      <Td style={{ fontSize:11, color:"#94a3b8" }} colSpan="2">{req.bdType} BD</Td>
                      <Td style={{ fontSize:11, color:"#94a3b8" }} colSpan="2"><BUBadge bu={req.bu}/></Td>
                      <Td style={{ fontSize:11, color:"#94a3b8" }} colSpan="2">{req.hireType}</Td>
                      <Td colSpan="2"><StatusBadge status={req.status}/></Td>
                    </tr>
                  ))}
                  {isExpanded && cityReqs.length === 0 && (
                    <tr style={{ background:"#fafafa" }}>
                      <Td style={{ paddingLeft:36, color:"#94a3b8", fontSize:12 }} colSpan="10">No open requisitions</Td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot style={{ borderTop:"2px solid #e2e8f0", background:"#f8fafc" }}>
            <tr>
              <Td style={{ fontWeight:800, color:"#0f172a" }} colSpan="2">Total</Td>
              <Td style={{ fontFamily:"'DM Mono', monospace", fontWeight:700, color:"#374151" }}>{tot.aop}</Td>
              <Td style={{ fontFamily:"'DM Mono', monospace", fontWeight:700, color:"#059669" }}>{tot.active}</Td>
              <Td style={{ fontFamily:"'DM Mono', monospace", fontWeight:700, color:"#d97706" }}>{tot.notice}</Td>
              <Td style={{ fontFamily:"'DM Mono', monospace", fontWeight:700, color:"#dc2626" }}>{tot.pip}</Td>
              <Td style={{ fontFamily:"'DM Mono', monospace", fontWeight:700, color:"#2563eb" }}>{tot.training}</Td>
              <Td style={{ fontFamily:"'DM Mono', monospace", fontWeight:700, color:"#0f766e" }}>{tot.offered}</Td>
              <Td style={{ fontFamily:"'DM Mono', monospace", fontWeight:700, color:"#374151" }}>{cityRows.reduce((s,r)=>s+r.openReqs,0)}</Td>
              <Td><span style={{ fontFamily:"'DM Mono', monospace", fontWeight:800, color:tot.deficit>0?"#dc2626":tot.deficit<0?"#059669":"#94a3b8" }}>{tot.deficit>0?`+${tot.deficit}`:tot.deficit}</span></Td>
            </tr>
          </tfoot>
        </table>
        </div>
      </div>
    </div>
  );
}

/* ─── REQUISITIONS ──────────────────────────────────────────── */
function Requisitions({ bu, onNav, setReqFilter, setShowNew, navIntent, clearNavIntent }) {
  const { requisitions: REQUISITIONS, candidates: CANDIDATES, loading, error, me, updateRequisition, approveRequisition } = useData();
  const canApprove = me && (me.role === 'approver' || me.role === 'admin');
  const [statusF, setStatusF] = useState("all");
  const [cityF, setCityF] = useState("all");
  const [hospitalF, setHospitalF] = useState("all");
  const [selected, setSelected] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Inline closure-date edit (PR-D / R3). Approver/admin only. Same pattern
  // as the Target HC pencil on the Dashboard (PR-C).
  const [closureEditId, setClosureEditId] = useState(null);
  const [closureEditValue, setClosureEditValue] = useState('');
  const [closureSaving, setClosureSaving] = useState(false);
  const [closureError, setClosureError] = useState(null);
  function startClosureEdit(r) {
    setClosureEditId(r.id);
    setClosureEditValue(r.closureDate || '');
    setClosureError(null);
  }
  function cancelClosureEdit() {
    setClosureEditId(null);
    setClosureEditValue('');
    setClosureError(null);
  }
  async function saveClosureEdit(reqId) {
    setClosureError(null);
    // Empty input clears the date; otherwise it must be YYYY-MM-DD.
    const v = closureEditValue.trim();
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      setClosureError('Use YYYY-MM-DD');
      return;
    }
    try {
      setClosureSaving(true);
      await updateRequisition(reqId, { closureDate: v || null });
      setClosureEditId(null);
      setClosureEditValue('');
    } catch (err) {
      setClosureError(err?.message || 'Save failed');
    } finally {
      setClosureSaving(false);
    }
  }

  // Search → req: pre-open the side panel for that requisition.
  // Search → hospital: pre-set the hospital filter.
  // Same external-trigger sync pattern as Dashboard (see comment there).
  useEffect(() => {
    if (navIntent?.type === 'req') {
      const req = REQUISITIONS.find(r => r.id === navIntent.reqId);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (req) setSelected(req);
      clearNavIntent();
    } else if (navIntent?.type === 'hospital') {
      setHospitalF(navIntent.hospital);
      clearNavIntent();
    }
  }, [navIntent, REQUISITIONS, clearNavIntent]);

  const approveSelected = async () => {
    if (!selected) return;
    setActionError(null);
    try {
      const updated = await approveRequisition(selected.id);
      setSelected(updated);
    } catch (err) {
      setActionError(err.message || 'Failed to approve');
    }
  };

  const reqs = useMemo(() => REQUISITIONS.filter(r =>
    (bu==="all"||r.bu===bu) && (statusF==="all"||r.status===statusF) && (cityF==="all"||r.city===cityF) && (hospitalF==="all"||r.hospital===hospitalF)
  ), [REQUISITIONS, bu, statusF, cityF, hospitalF]);

  const cities = [...new Set(REQUISITIONS.map(r=>r.city))].sort();
  const hospitals = [...new Set(REQUISITIONS.filter(r=>r.hospital && (cityF==="all"||r.city===cityF)).map(r=>r.hospital))].sort();

  if (loading) return <div style={{ padding: 24, color: "#64748b", fontSize: 13 }}>Loading requisitions…</div>;
  if (error) return <div style={{ padding: 24, color: "#dc2626", fontSize: 13 }}>Error loading requisitions: {error}</div>;

  const sel = (k, style = {}) => ({
    fontSize:12, border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 10px",
    background:"#fff", cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", color:"#374151",
    outline:"none", ...style,
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Controls */}
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <select value={statusF} onChange={e=>setStatusF(e.target.value)} style={sel()}>
          <option value="all">All Statuses</option>
          {["Pending Approval","Approved","Active","Filled"].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <select value={cityF} onChange={e=>{setCityF(e.target.value);setHospitalF("all");}} style={sel()}>
          <option value="all">All Cities</option>
          {cities.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <select value={hospitalF} onChange={e=>setHospitalF(e.target.value)} style={sel()}>
          <option value="all">All Hospitals</option>
          {hospitals.map(h=><option key={h} value={h}>{h}</option>)}
        </select>
        <button onClick={()=>setShowNew(true)} style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:9, border:"none", cursor:"pointer", background:S.primary, color:"#fff", fontSize:12, fontWeight:600, fontFamily:"'Plus Jakarta Sans', sans-serif" }}>
          <Plus size={13}/> New Requisition
        </button>
      </div>

      {/* Table */}
      <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:920 }}>
          <thead style={{ background:"#f8fafc", borderBottom:"1px solid #e2e8f0" }}>
            <tr>{["ID","City","Hospital / Area","BD Type","BU","Hire Type","Replacing","Raised By","Date","Closure Date","Offer?","Expected Joining","Status",""].map(h=><Th key={h}>{h}</Th>)}</tr>
          </thead>
          <tbody>
            {reqs.map(r=>{
              // R4: derive offer presence from candidates linked to this req.
              // Post-offer stages include Training + Active per PR-E (C3).
              const linkedPostOffer = CANDIDATES.filter(c =>
                c.reqId === r.id && ['Offered', 'Joined', 'Training', 'Active'].includes(c.stage),
              );
              const hasOffer = linkedPostOffer.length > 0;
              // R5: earliest expected joining date among the post-offer candidates.
              // null if none have set it yet.
              const expectedJoiningDates = linkedPostOffer
                .map(c => c.expectedJoiningDate)
                .filter(Boolean)
                .sort();
              const earliestExpectedJoining = expectedJoiningDates[0] || null;
              const isEditingClosure = closureEditId === r.id;
              return (
              <tr key={r.id} style={{ cursor:"pointer" }}
                onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                onClick={()=>{ if (!isEditingClosure) setSelected(r); }}>
                <Td style={{ color:S.primary, fontWeight:700, fontSize:12 }}>{r.id}</Td>
                <Td style={{ fontWeight:600, color:"#0f172a" }}>{r.city}</Td>
                <Td style={{ color:"#64748b", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={`${r.hospital||""} · ${r.area||""}`}>{r.hospital||"—"}</Td>
                <Td style={{ color:"#374151" }}>{r.bdType}</Td>
                <Td><BUBadge bu={r.bu}/></Td>
                <Td style={{ color:"#374151" }}>{r.hireType}</Td>
                <Td style={{ color:"#64748b" }}>{r.replacementFor||"—"}</Td>
                <Td style={{ color:"#64748b", fontSize:11 }}>{r.raisedBy}</Td>
                <Td style={{ color:"#94a3b8", fontSize:11, fontFamily:"'DM Mono', monospace" }}>{r.date}</Td>
                <Td style={{ color:"#374151", fontSize:11, fontFamily:"'DM Mono', monospace" }}
                    onClick={(e)=>{ if (isEditingClosure) e.stopPropagation(); }}>
                  {isEditingClosure ? (
                    <span style={{ display:"inline-flex", alignItems:"center", gap:6 }} onClick={(e)=>e.stopPropagation()}>
                      <input type="date" value={closureEditValue}
                             onChange={(e)=>setClosureEditValue(e.target.value)}
                             onKeyDown={(e)=>{ if (e.key==='Enter') saveClosureEdit(r.id); if (e.key==='Escape') cancelClosureEdit(); }}
                             style={{ padding:"3px 6px", border:"1px solid #cbd5e1", borderRadius:6, fontFamily:"'DM Mono', monospace", fontSize:11 }}
                             autoFocus disabled={closureSaving} />
                      <button onClick={(e)=>{e.stopPropagation(); saveClosureEdit(r.id);}} disabled={closureSaving}
                              style={{ padding:"3px 8px", border:"none", borderRadius:6, background:"#0f766e", color:"#fff", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                        {closureSaving ? "…" : "Save"}
                      </button>
                      <button onClick={(e)=>{e.stopPropagation(); cancelClosureEdit();}} disabled={closureSaving}
                              style={{ padding:"3px 8px", border:"1px solid #e2e8f0", borderRadius:6, background:"#fff", fontSize:11, color:"#64748b", cursor:"pointer" }}>
                        Cancel
                      </button>
                      {closureError && <span style={{ fontSize:10, color:"#dc2626" }}>{closureError}</span>}
                    </span>
                  ) : (
                    <span style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
                      {r.closureDate || <span style={{ color:"#cbd5e1" }}>—</span>}
                      {canApprove && (
                        <button title="Edit closure date" onClick={(e)=>{ e.stopPropagation(); startClosureEdit(r); }}
                                style={{ background:"transparent", border:"none", padding:0, cursor:"pointer", display:"inline-flex", alignItems:"center" }}>
                          <Pencil size={11} color="#94a3b8"/>
                        </button>
                      )}
                    </span>
                  )}
                </Td>
                <Td>
                  {hasOffer ? (
                    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px", borderRadius:99, background:"#ecfdf5", border:"1px solid #a7f3d0", color:"#047857", fontSize:11, fontWeight:700 }}>
                      <Check size={11}/> Yes
                    </span>
                  ) : (
                    <span style={{ color:"#cbd5e1", fontSize:12 }}>—</span>
                  )}
                </Td>
                <Td style={{ color:"#374151", fontSize:11, fontFamily:"'DM Mono', monospace" }}
                    title={expectedJoiningDates.length > 1 ? `Earliest of ${expectedJoiningDates.length} candidates` : undefined}>
                  {earliestExpectedJoining || <span style={{ color:"#cbd5e1" }}>—</span>}
                </Td>
                <Td><StatusBadge status={r.status}/></Td>
                <Td>
                  <button style={{ background:"none", border:"none", cursor:"pointer", color:S.primary }}
                    onClick={e=>{e.stopPropagation();setReqFilter(r.id);onNav("pipeline");}}>
                    <ChevronRight size={14}/>
                  </button>
                </Td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Slide-out panel */}
      {selected && (
        <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex", justifyContent:"flex-end" }} onClick={()=>setSelected(null)}>
          <div style={{ width:380, background:"#fff", height:"100%", boxShadow:"-8px 0 40px rgba(0,0,0,0.12)", padding:28, overflowY:"auto", display:"flex", flexDirection:"column", gap:18 }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:11, color:"#94a3b8", fontWeight:600 }}>{selected.id}</div>
                <div style={{ fontSize:18, fontWeight:800, color:"#0f172a", marginTop:2 }}>{selected.city} · {selected.bdType} BD</div>
                <div style={{ marginTop:8, display:"flex", gap:6 }}><StatusBadge status={selected.status}/><BUBadge bu={selected.bu}/></div>
              </div>
              <button style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8" }} onClick={()=>setSelected(null)}><X size={18}/></button>
            </div>

            {/* Approval flow — dynamic per-phase display */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10 }}>Approval Flow</div>
              {/* Step 0: Raised */}
              <div style={{ display:"flex", gap:10, marginBottom:10 }}>
                <div style={{ width:20, height:20, borderRadius:"50%", background:"#d1fae5", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                  <Check size={10} color="#059669"/>
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:"#0f172a" }}>Requisition Raised</div>
                  <div style={{ fontSize:11, color:"#64748b" }}>{selected.raisedBy} · {selected.date}</div>
                </div>
              </div>
              {/* Req-approval: single-phase BU-based, any-one-of */}
              {(() => {
                const phase = (selected.approvalPhases || [])[0];
                const isApproved = ["Approved","Active","Filled"].includes(selected.status);
                const isPending = selected.status === "Pending Approval";
                return (
                  <div style={{ marginBottom:12 }}>
                    <div style={{ display:"flex", gap:10, marginBottom:6 }}>
                      <div style={{ width:20, height:20, borderRadius:"50%", background: isApproved ? "#d1fae5" : isPending ? "#fef3c7" : "#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                        {isApproved ? <Check size={10} color="#059669"/> : <Clock size={10} color={isPending ? "#f59e0b" : "#94a3b8"}/>}
                      </div>
                      <div style={{ fontSize:12, fontWeight:600, color:"#0f172a" }}>Req Approval</div>
                    </div>
                    {phase && phase.approvers.length > 0
                      ? phase.approvers.map(a => (
                        <div key={a.userId} style={{ marginLeft:30, display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                          {a.approvedAt
                            ? <Check size={10} color="#059669"/>
                            : <Clock size={10} color="#94a3b8"/>}
                          <span style={{ fontSize:11, color: a.approvedAt ? "#059669" : "#64748b" }}>
                            {a.userName}{a.approvedAt ? ` — approved ${a.approvedAt.slice(0,10)}` : " — awaiting"}
                          </span>
                        </div>
                      ))
                      : <div style={{ marginLeft:30, fontSize:11, color:"#94a3b8", fontStyle:"italic" }}>Auto-assigned based on BU</div>
                    }
                  </div>
                );
              })()}
              {/* Step final: HR Active */}
              <div style={{ display:"flex", gap:10, marginBottom:10 }}>
                <div style={{ width:20, height:20, borderRadius:"50%", background:["Active","Filled"].includes(selected.status)?"#d1fae5":"#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                  {["Active","Filled"].includes(selected.status) ? <Check size={10} color="#059669"/> : <Clock size={10} color="#94a3b8"/>}
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:"#0f172a" }}>HR Notified & Active</div>
                  <div style={{ fontSize:11, color:"#64748b" }}>{["Active","Filled"].includes(selected.status)?"Notified":"Pending"}</div>
                </div>
              </div>
            </div>

            {/* Details grid */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, borderTop:"1px solid #f1f5f9", paddingTop:16 }}>
              {[
                { l:"Hospital", v:selected.hospital||"—" },
                { l:"Area / Zone", v:selected.area||"—" },
                { l:"Hire Type", v:selected.hireType },
                { l:"Replacing", v:selected.replacementFor||"—" },
              ].map(({ l, v }) => (
                <div key={l} style={{ background:"#f8fafc", borderRadius:9, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, color:"#94a3b8", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>{l}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#0f172a", marginTop:3 }}>{v}</div>
                </div>
              ))}
            </div>

            {selected.notes && (
              <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:9, padding:"10px 12px", fontSize:12, color:"#92400e" }}>
                <strong>Note:</strong> {selected.notes}
              </div>
            )}

            {/* Linked candidates */}
            <div style={{ borderTop:"1px solid #f1f5f9", paddingTop:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10 }}>Linked Candidates ({CANDIDATES.filter(c=>c.reqId===selected.id).length})</div>
              {CANDIDATES.filter(c=>c.reqId===selected.id).length===0
                ? <div style={{ fontSize:12, color:"#94a3b8" }}>No candidates sourced yet</div>
                : CANDIDATES.filter(c=>c.reqId===selected.id).map(c=>(
                  <div key={c.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #f8fafc" }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color:"#0f172a" }}>{c.name}</div>
                      <div style={{ fontSize:11, color:"#64748b" }}>{formatAssignees(c.assignedTas)} · {c.sourced}</div>
                    </div>
                    <StageBadge stage={c.stage}/>
                  </div>
                ))
              }
            </div>

            {actionError && (
              <div style={{ marginTop:12, background:"#fef2f2", border:"1px solid #fecaca", borderRadius:9, padding:"10px 12px", fontSize:11, color:"#991b1b" }}>
                {actionError}
              </div>
            )}

            <div style={{ marginTop:"auto", display:"flex", flexDirection:"column", gap:8 }}>
              {(() => {
                if (selected.status !== "Pending Approval" || !me) return null;
                const phase = (selected.approvalPhases || [])[0];
                const isAdmin = me.role === "admin";
                const myEntry = phase?.approvers.find(a => a.userId === me.id);
                if (!isAdmin && (!myEntry || myEntry.approvedAt)) return null;
                return (
                  <button
                    onClick={approveSelected}
                    style={{ width:"100%", padding:"10px", borderRadius:9, border:"none", background:"#059669", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif" }}
                  >
                    ✓ Approve Requisition
                  </button>
                );
              })()}
              <button style={{ width:"100%", padding:"10px", borderRadius:9, border:`1px solid ${S.primary}`, background:"transparent", color:S.primary, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif" }}
                onClick={()=>{setReqFilter(selected.id);onNav("pipeline");setSelected(null);}}>
                View Candidates →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── PIPELINE ──────────────────────────────────────────────── */
function Pipeline({ bu, reqFilter, setReqFilter, navIntent, clearNavIntent }) {
  const { requisitions: REQUISITIONS, candidates: CANDIDATES, users, me } = useData();
  const [view, setView] = useState("kanban");
  const [selectedC, setSelectedC] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // PR-L: Filter-by-owner dropdown. Now includes TAs + admins (was TA-only
  // in PR-J.5 — relaxed because Akhlaque is admin and still owns candidates).
  // Self pinned at top for any signed-in user who is in the assignable pool;
  // approvers (not in the pool) see ["All", everyone alphabetical] only.
  const assignableUsers = useMemo(
    () => (users || [])
      .filter(u => u.role === 'ta' || u.role === 'admin')
      .sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );
  // PR-L: TAs see [self pinned at top, "All", others alphabetical] so they
  // can quickly find/return to their own pipeline. Admins/approvers default
  // to "All" and don't get the self-pin (admins are in the list, but pinning
  // them would visually suggest the dropdown is "their" view, which it isn't).
  const ownerOptions = useMemo(() => {
    if (me?.role === 'ta') {
      const others = assignableUsers.filter(u => u.name !== me.name);
      return [
        { value: me.name, label: me.name },
        { value: 'all', label: 'All' },
        ...others.map(u => ({ value: u.name, label: u.name })),
      ];
    }
    return [
      { value: 'all', label: 'All' },
      ...assignableUsers.map(u => ({ value: u.name, label: u.name })),
    ];
  }, [assignableUsers, me]);

  const [ownerFilter, setOwnerFilter] = useState('all');
  const ownerInit = useRef(false);
  useEffect(() => {
    if (me && !ownerInit.current) {
      ownerInit.current = true;
      // PR-L: TAs default to themselves; admins/approvers default to "All"
      // (consistent with PR-J.5). The dropdown still pins the signed-in user
      // to the top for any TA/admin so they can quickly drill into their own.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOwnerFilter(me.role === 'ta' ? me.name : 'all');
    }
  }, [me]);

  // Search → candidate: open the CandidateModal for that person. (AppShell
  // already set reqFilter when the intent fired so the column is filtered.)
  // Same external-trigger sync pattern as Dashboard (see comment there).
  useEffect(() => {
    if (navIntent?.type === 'candidate') {
      const cand = CANDIDATES.find(c => c.id === navIntent.candidateId);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (cand) setSelectedC(cand);
      clearNavIntent();
    }
  }, [navIntent, CANDIDATES, clearNavIntent]);

  const cands = useMemo(() => CANDIDATES.filter(c =>
    (bu==="all"||c.bu===bu) &&
    (reqFilter==="all"||c.reqId===reqFilter) &&
    (ownerFilter==="all" || (c.assignedTas || []).some(t => t.name === ownerFilter))
  ), [CANDIDATES, bu, reqFilter, ownerFilter]);

  const sel = {
    fontSize:12, border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 10px",
    background:"#fff", cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", color:"#374151", outline:"none",
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, height:"100%" }}>
      {/* Controls */}
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <select value={reqFilter} onChange={e=>setReqFilter(e.target.value)} style={sel}>
          <option value="all">All Requisitions</option>
          {REQUISITIONS.filter(r=>bu==="all"||r.bu===bu).map(r=>(
            <option key={r.id} value={r.id}>{r.id} · {r.city} {r.bdType} BD</option>
          ))}
        </select>
        <div style={{ display:"flex", background:"#f1f5f9", borderRadius:9, padding:3, gap:1 }}>
          {["kanban","table"].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{ padding:"5px 12px", borderRadius:7, border:"none", cursor:"pointer", background:view===v?"#fff":"transparent", boxShadow:view===v?"0 1px 3px rgba(0,0,0,0.1)":"none", color:view===v?S.primary:"#64748b", fontSize:12, fontWeight:600, fontFamily:"'Plus Jakarta Sans', sans-serif", textTransform:"capitalize" }}>{v}</button>
          ))}
        </div>
        <select
          aria-label="Filter by owner"
          value={ownerFilter}
          onChange={e => setOwnerFilter(e.target.value)}
          style={sel}
        >
          {ownerOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button onClick={()=>setShowAdd(true)} style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:9, border:"none", cursor:"pointer", background:S.primary, color:"#fff", fontSize:12, fontWeight:600, fontFamily:"'Plus Jakarta Sans', sans-serif" }}>
          <Plus size={13}/> Add Candidate
        </button>
        <button onClick={()=>setShowImport(true)} style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:9, border:`1px solid ${S.primary}`, cursor:"pointer", background:"#fff", color:S.primary, fontSize:12, fontWeight:600, fontFamily:"'Plus Jakarta Sans', sans-serif" }}>
          <FileText size={13}/> Import from Excel
        </button>
      </div>
      {showImport && <ImportCandidatesModal onClose={()=>setShowImport(false)}/>}
      {showAdd && <NewCandidateModal onClose={()=>setShowAdd(false)} defaultReqId={reqFilter !== "all" ? reqFilter : null} defaultBu={bu !== "all" ? bu : null}/>}

      {view==="kanban" ? (
        <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:12, flex:1 }}>
          {STAGES.map(stage=>{
            const cards = cands.filter(c=>c.stage===stage);
            const col = STAGE_CLS[stage];
            return (
              <div key={stage} style={{ flexShrink:0, width:170, display:"flex", flexDirection:"column" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8, padding:"0 2px" }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"#374151" }}>{stage}</span>
                  <span style={{ fontSize:10, fontWeight:700, background:`${col}20`, color:col, borderRadius:99, padding:"1px 7px" }}>{cards.length}</span>
                </div>
                <div style={{ flex:1, background:"#f8fafc", borderRadius:12, padding:8, display:"flex", flexDirection:"column", gap:8, minHeight:120 }}>
                  {cards.map(c=>(
                    <div key={c.id} onClick={()=>setSelectedC(c)} style={{ background:"#fff", borderRadius:9, padding:"10px 11px", boxShadow:"0 1px 3px rgba(0,0,0,0.06)", cursor:"pointer", border:"1px solid #f1f5f9", transition:"box-shadow 0.15s" }}
                      onMouseEnter={e=>e.currentTarget.style.boxShadow="0 3px 10px rgba(0,0,0,0.1)"}
                      onMouseLeave={e=>e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.06)"}>
                      <div style={{ fontSize:12, fontWeight:700, color:"#0f172a", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.name}</div>
                      <div style={{ fontSize:11, color:"#64748b", marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.company}</div>
                      <div style={{ display:"flex", alignItems:"center", gap:3, marginTop:6 }}>
                        <MapPin size={9} color="#94a3b8"/>
                        <span style={{ fontSize:10, color:"#94a3b8" }}>{c.city}</span>
                      </div>
                      {c.notice && <div style={{ fontSize:10, color:S.primary, marginTop:3 }}>NP: {c.notice}</div>}
                      <div style={{ fontSize:10, color:"#94a3b8", marginTop:3 }}>TA: {formatAssignees(c.assignedTas)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", overflow:"hidden", flex:1 }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead style={{ background:"#f8fafc", borderBottom:"1px solid #e2e8f0" }}>
              {/* R1/R2 result columns removed in PR C — that detail now lives
                  on the Interviews page (or the candidate side panel's
                  Interviews tab). The Stage column still conveys most of the
                  same info ("R1 Complete" implies R1 happened, etc.). */}
              <tr>{["Name","City","Company","Curr CTC","Exp CTC","Notice","TA","Stage",""].map(h=><Th key={h}>{h}</Th>)}</tr>
            </thead>
            <tbody>
              {cands.map(c=>(
                <tr key={c.id} style={{ cursor:"pointer" }}
                  onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                  onClick={()=>setSelectedC(c)}>
                  <Td style={{ fontWeight:600, color:"#0f172a" }}>{c.name}</Td>
                  <Td style={{ color:"#374151" }}>{c.city}</Td>
                  <Td style={{ color:"#64748b" }}>{c.company}</Td>
                  <Td style={{ color:"#64748b", fontFamily:"'DM Mono', monospace" }}>{fmt(c.currentCTC)}</Td>
                  <Td style={{ color:"#64748b", fontFamily:"'DM Mono', monospace" }}>{fmt(c.expectedCTC)}</Td>
                  <Td style={{ color:"#64748b" }}>{c.notice||"—"}</Td>
                  <Td style={{ color:"#64748b" }}>{formatAssignees(c.assignedTas)}</Td>
                  <Td><StageBadge stage={c.stage}/></Td>
                  <Td><ChevronRight size={13} color="#94a3b8"/></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selectedC && <CandidateModal c={selectedC} onClose={()=>setSelectedC(null)}/>}
    </div>
  );
}

/* ─── CANDIDATE MODAL ───────────────────────────────────────── */
function CandidateModal({ c: cProp, onClose }) {
  const {
    me,
    users,
    requisitions: REQUISITIONS,
    candidates: CANDIDATES,
    recordInterviewResult,
    cancelInterview,
    offerCandidate,
    recordJoin,
    updateCandidate,
    startTraining,
    activateCandidate,
  } = useData();
  // PR-L: TAs + admins available as assignment targets (empty until users load).
  const taOptions = useMemo(
    () => (users || [])
      .filter(u => u.role === 'ta' || u.role === 'admin')
      .sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );
  // PR D RBAC: cancel is approver/admin only on the backend. Hide the button
  // for TAs so they don't get a confusing 403 — they should re-schedule via
  // the schedule modal (which overwrites the existing row) instead.
  const canCancel = me?.role === 'admin' || me?.role === 'approver';
  // PR-E (C1): re-tag req is admin/approver only on the backend implicitly
  // (PATCH is currently open to authenticated, but the FK + RBAC guard on
  // requisitions makes mis-tagging recoverable). Show the dropdown to all
  // authenticated users — server is authoritative.
  const canRetag = !!me;
  // Always read the freshest candidate from context so the modal updates
  // after schedule/record-result actions.
  const c = CANDIDATES.find((x) => x.id === cProp.id) || cProp;
  const [tab, setTab] = useState("overview");
  const req = REQUISITIONS.find(r=>r.id===c.reqId);
  const [interviewList, setInterviewList] = useState([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  // PR-L: multi-TA assignment via checkbox list. Pencil → checkboxes → Save.
  // Any TA or admin can change assignments (drops PR-J.5 ownership rule).
  // Approvers cannot — pencil hidden for them (backend would return 403).
  // PR-L also drops the PR-J.5 confirmation modal — multi-assign makes the
  // "you can't get this candidate back" warning meaningless.
  const canReassign = me?.role === 'ta' || me?.role === 'admin';
  const [reassignEditing, setReassignEditing] = useState(false);
  // Currently selected user IDs while editing — initialised on each open.
  const [reassignSelected, setReassignSelected] = useState([]);
  const [reassignSaving, setReassignSaving] = useState(false);
  const [reassignError, setReassignError] = useState(null);
  const startReassign = () => {
    setReassignSelected((c.assignedTas || []).map(t => t.id));
    setReassignError(null);
    setReassignEditing(true);
  };
  const cancelReassign = () => { setReassignEditing(false); setReassignError(null); };
  const toggleReassignUser = (userId) => {
    setReassignSelected(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId],
    );
  };
  const doReassign = async () => {
    if (reassignSelected.length === 0) {
      setReassignError('At least one TA must be assigned');
      return;
    }
    setReassignSaving(true);
    setReassignError(null);
    try {
      await updateCandidate(c.id, { taIds: reassignSelected });
      setReassignEditing(false);
    } catch (err) {
      setReassignError(err.message || 'Reassignment failed');
    } finally {
      setReassignSaving(false);
    }
  };

  const inp = {
    width:"100%", marginTop:4, fontSize:12, border:"1px solid #e2e8f0", borderRadius:8,
    padding:"8px 10px", outline:"none", fontFamily:"'Plus Jakarta Sans', sans-serif", color:"#374151",
  };

  // Load interview records for this candidate. Source of truth for what was
  // scheduled / recorded — replaces the deprecated candidate.r1Date/r2Date
  // cache fields that this modal used to read directly.
  const refreshInterviews = async () => {
    try {
      const rows = await api.listInterviews({ candidateId: c.id, includeCancelled: true });
      setInterviewList(rows);
    } catch { /* non-critical for display */ }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refreshInterviews(); }, [c.id]);

  // Documents
  const [documents, setDocuments] = useState([]);
  const [docBusy, setDocBusy] = useState(null); // doc type currently being uploaded
  const refreshDocuments = async () => {
    try {
      const rows = await api.listDocuments(c.id);
      setDocuments(rows);
    } catch { /* non-critical */ }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refreshDocuments(); }, [c.id]);

  const handleDocUpload = async (canonicalType, file) => {
    if (!file) return;
    setActionError(null);
    try {
      setDocBusy(canonicalType);
      await api.uploadDocument(c.id, file, canonicalType);
      await refreshDocuments();
    } catch (err) {
      setActionError(err.message || "Upload failed");
    } finally {
      setDocBusy(null);
    }
  };

  const handleDocDelete = async (docId) => {
    setActionError(null);
    try {
      await api.deleteDocument(docId);
      await refreshDocuments();
    } catch (err) {
      setActionError(err.message || "Delete failed");
    }
  };

  // Active (non-cancelled) interviews per round. Source of truth = interviews
  // table, not the deprecated r1_*/r2_* cache fields on candidates.
  const r1Interview = interviewList.find(i => i.round === 1 && !i.cancelledAt);
  const r2Interview = interviewList.find(i => i.round === 2 && !i.cancelledAt);

  const recordResult = async (interview, result) => {
    setActionError(null);
    try {
      setActionBusy(true);
      await recordInterviewResult(interview.id, result, c.id);
      await refreshInterviews();
    } catch (err) {
      setActionError(err.message || "Failed to record result");
    } finally {
      setActionBusy(false);
    }
  };

  const cancelScheduled = async (interview) => {
    if (!confirm(`Cancel ${interview.round === 1 ? 'R1' : 'R2'} interview for ${c.name}?`)) return;
    const reason = window.prompt('Reason (optional):') || '';
    setActionError(null);
    try {
      setActionBusy(true);
      await cancelInterview(interview.id, c.id, reason);
      await refreshInterviews();
    } catch (err) {
      setActionError(err.message || 'Failed to cancel');
    } finally {
      setActionBusy(false);
    }
  };

  // Offer / join action state
  const [offerDate, setOfferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [joinDate, setJoinDate] = useState(() => new Date().toISOString().slice(0, 10));

  const extendOffer = async () => {
    setActionError(null);
    try {
      setActionBusy(true);
      await offerCandidate(c.id, offerDate);
    } catch (err) {
      setActionError(err.message || "Failed to extend offer");
    } finally {
      setActionBusy(false);
    }
  };

  const confirmJoin = async () => {
    setActionError(null);
    try {
      setActionBusy(true);
      await recordJoin(c.id, joinDate);
    } catch (err) {
      setActionError(err.message || "Failed to record join");
    } finally {
      setActionBusy(false);
    }
  };

  // PR-E (C3): start-training and activate transitions.
  const beginTraining = async () => {
    setActionError(null);
    try {
      setActionBusy(true);
      await startTraining(c.id);
    } catch (err) {
      setActionError(err.message || "Failed to start training");
    } finally {
      setActionBusy(false);
    }
  };
  const goActive = async () => {
    setActionError(null);
    try {
      setActionBusy(true);
      await activateCandidate(c.id);
    } catch (err) {
      setActionError(err.message || "Failed to mark active");
    } finally {
      setActionBusy(false);
    }
  };

  const canOffer = c.stage === "R1 Complete" || c.stage === "R2 Complete";
  const canJoin = c.stage === "Offered";
  const canStartTraining = c.stage === "Joined";
  const canActivate = c.stage === "Training" || c.stage === "Joined";

  // PR-E (C2): Expected Joining Date — populatable from Offered onward.
  const canSetExpectedJoining = ['Offered', 'Joined', 'Training', 'Active'].includes(c.stage);
  const [expectedJoiningEdit, setExpectedJoiningEdit] = useState(c.expectedJoiningDate || '');
  // Sync local input when candidate is reloaded externally.
  useEffect(() => { setExpectedJoiningEdit(c.expectedJoiningDate || ''); }, [c.expectedJoiningDate]);
  const saveExpectedJoining = async () => {
    setActionError(null);
    try {
      setActionBusy(true);
      await updateCandidate(c.id, { expectedJoiningDate: expectedJoiningEdit || null });
    } catch (err) {
      setActionError(err.message || "Failed to save expected joining date");
    } finally {
      setActionBusy(false);
    }
  };

  // PR-E (C1): re-tag candidate to a different requisition. Filter the
  // dropdown to non-Filled reqs in the same BU as the candidate so we don't
  // pollute it with stale options.
  const retagOptions = REQUISITIONS.filter(
    r => r.bu === c.bu && r.status !== 'Filled',
  );
  const retagReq = async (newReqId) => {
    if (!newReqId || newReqId === c.reqId) return;
    setActionError(null);
    try {
      setActionBusy(true);
      await updateCandidate(c.id, { reqId: newReqId });
    } catch (err) {
      setActionError(err.message || "Failed to re-tag requisition");
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:60, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:18, width:620, maxHeight:"88vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.18)" }} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding:"22px 24px 16px", borderBottom:"1px solid #f1f5f9" }}>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:20, fontWeight:800, color:"#0f172a" }}>{c.name}</div>
              <div style={{ fontSize:13, color:"#64748b", marginTop:2 }}>{c.currentRole} · {c.company}</div>
              <div style={{ display:"flex", gap:6, marginTop:8, alignItems:"center" }}>
                <StageBadge stage={c.stage}/>
                <BUBadge bu={c.bu}/>
                {/* PR-E / C1 — re-tag req via dropdown. Falls back to a static
                    label when retagging isn't allowed (no logged-in user). */}
                {canRetag ? (
                  <select value={c.reqId}
                          onChange={(e)=>retagReq(e.target.value)}
                          disabled={actionBusy}
                          style={{ fontSize:11, color:"#475569", border:"1px solid #e2e8f0", borderRadius:6, padding:"2px 6px", background:"#fff", cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif" }}
                          title="Re-tag candidate to a different requisition">
                    {/* Always include the current req even if it's Filled and would be
                        filtered out, so the dropdown matches reality. */}
                    {!retagOptions.some(r => r.id === c.reqId) && req && (
                      <option value={c.reqId}>{req.id} · {req.hospital||req.city}</option>
                    )}
                    {retagOptions.map(r => (
                      <option key={r.id} value={r.id}>{r.id} · {r.hospital||r.city}</option>
                    ))}
                  </select>
                ) : (
                  req && <span style={{ fontSize:11, color:"#94a3b8", padding:"2px 0" }}>{req.id}</span>
                )}
              </div>
            </div>
            <button style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8" }} onClick={onClose}><X size={20}/></button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginTop:14 }}>
            {[
              { icon:Phone, l:"Phone", v:c.phone },
              { icon:Mail, l:"Email", v:c.email||"—" },
              { icon:MapPin, l:"City", v:c.city },
              { icon:Clock, l:"Notice Period", v:c.notice||"—" },
            ].map(({ icon:Icon, l, v }) => (
              <div key={l} style={{ display:"flex", gap:6, alignItems:"flex-start" }}>
                <Icon size={12} color="#94a3b8" style={{ marginTop:2 }}/>
                <div>
                  <div style={{ fontSize:10, color:"#94a3b8", fontWeight:600 }}>{l}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:"#0f172a", marginTop:1 }}>{v}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:"1px solid #f1f5f9", padding:"0 24px" }}>
          {["overview","interviews","schedule","documents"].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              padding:"12px 14px", border:"none", borderBottom:`2px solid ${tab===t?S.primary:"transparent"}`,
              background:"transparent", fontSize:12, fontWeight:600, color:tab===t?S.primary:"#94a3b8",
              cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", textTransform:"capitalize",
              transition:"color 0.15s",
            }}>{t}</button>
          ))}
        </div>

        <div style={{ padding:24 }}>
          {tab==="overview" && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[
                  { l:"Current CTC", v:fmt(c.currentCTC) },
                  { l:"Expected CTC", v:fmt(c.expectedCTC) },
                ].map(({ l, v }) => (
                  <div key={l} style={{ background:"#f8fafc", borderRadius:9, padding:"10px 12px" }}>
                    <div style={{ fontSize:10, color:"#94a3b8", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>{l}</div>
                    <div style={{ fontSize:14, fontWeight:700, color:"#0f172a", marginTop:3, fontFamily:"'DM Mono', monospace" }}>{v}</div>
                  </div>
                ))}
                {/* PR-L: TA Assigned is editable for any TA or admin. Multi-select
                    via checkboxes; at least one TA must remain. */}
                <div style={{ background:"#f8fafc", borderRadius:9, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, color:"#94a3b8", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>TA Assigned</div>
                  {!reassignEditing ? (
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:"#0f172a", fontFamily:"'DM Mono', monospace" }}>{formatAssignees(c.assignedTas)}</div>
                      {canReassign && (
                        <button
                          onClick={startReassign}
                          title="Edit TA assignment"
                          style={{ padding:2, background:"transparent", border:"none", cursor:"pointer", color:"#64748b" }}
                        >
                          <Pencil size={12}/>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ marginTop:6, display:"flex", flexDirection:"column", gap:6 }}>
                      <div role="group" aria-label="Reassign TAs" style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:160, overflowY:"auto", padding:"4px 6px", background:"#fff", border:"1px solid #e2e8f0", borderRadius:6 }}>
                        {taOptions.map(t => (
                          <label key={t.email} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#374151", cursor:"pointer" }}>
                            <input
                              type="checkbox"
                              checked={reassignSelected.includes(t.id)}
                              onChange={() => toggleReassignUser(t.id)}
                              disabled={reassignSaving}
                            />
                            <span>{t.name}{t.role === 'admin' ? ' (admin)' : ''}</span>
                          </label>
                        ))}
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <button
                          onClick={doReassign}
                          disabled={reassignSaving || reassignSelected.length === 0}
                          style={{ padding:"4px 10px", fontSize:11, fontWeight:600, background:S.primary, color:"#fff", border:"none", borderRadius:6, cursor:"pointer", opacity: (reassignSaving || reassignSelected.length === 0) ? 0.5 : 1 }}
                        >Save</button>
                        <button
                          onClick={cancelReassign}
                          disabled={reassignSaving}
                          style={{ padding:"4px 8px", fontSize:11, background:"#fff", color:"#64748b", border:"1px solid #e2e8f0", borderRadius:6, cursor:"pointer" }}
                        >Cancel</button>
                      </div>
                    </div>
                  )}
                  {reassignError && (
                    <div style={{ marginTop:6, fontSize:11, color:"#dc2626" }}>{reassignError}</div>
                  )}
                </div>
                {[
                  { l:"Sourced Date", v:c.sourced },
                  { l:"Offer Date", v:c.offerDate||"—" },
                  { l:"Joining Date", v:c.joinDate||"—" },
                ].map(({ l, v }) => (
                  <div key={l} style={{ background:"#f8fafc", borderRadius:9, padding:"10px 12px" }}>
                    <div style={{ fontSize:10, color:"#94a3b8", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>{l}</div>
                    <div style={{ fontSize:14, fontWeight:700, color:"#0f172a", marginTop:3, fontFamily:"'DM Mono', monospace" }}>{v}</div>
                  </div>
                ))}
              </div>
              {req && (
                <div style={{ background:`${S.primary}0d`, border:`1px solid ${S.primary}30`, borderRadius:10, padding:"12px 14px" }}>
                  <div style={{ fontSize:11, fontWeight:700, color:S.primary, marginBottom:4 }}>Requisition · {req.id}</div>
                  <div style={{ fontSize:13, color:"#374151" }}>{req.city} · {req.hospital||"Hospital TBD"} · {req.bdType} BD</div>
                  {req.notes && <div style={{ fontSize:11, color:"#64748b", marginTop:4 }}>{req.notes}</div>}
                </div>
              )}

              {/* Pipeline actions — offered / joined transitions */}
              {canOffer && (
                <div style={{ border:"1px solid #fed7aa", background:"#fffbeb", borderRadius:10, padding:"12px 14px", display:"flex", alignItems:"flex-end", gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#92400e", marginBottom:4 }}>Extend Offer</div>
                    <label style={{ fontSize:11, color:"#78350f" }}>Offer date</label>
                    <input type="date" value={offerDate} onChange={e=>setOfferDate(e.target.value)} style={{ ...inp, marginTop:4 }}/>
                  </div>
                  <button
                    onClick={extendOffer}
                    disabled={actionBusy}
                    style={{ padding:"9px 16px", borderRadius:9, border:"none", background:"#d97706", color:"#fff", fontSize:12, fontWeight:700, cursor:actionBusy?"not-allowed":"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", opacity:actionBusy?0.6:1 }}
                  >Extend Offer</button>
                </div>
              )}
              {canJoin && (
                <div style={{ border:"1px solid #a7f3d0", background:"#ecfdf5", borderRadius:10, padding:"12px 14px", display:"flex", alignItems:"flex-end", gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#065f46", marginBottom:4 }}>Record Join</div>
                    <label style={{ fontSize:11, color:"#047857" }}>Joining date</label>
                    <input type="date" value={joinDate} onChange={e=>setJoinDate(e.target.value)} style={{ ...inp, marginTop:4 }}/>
                  </div>
                  <button
                    onClick={confirmJoin}
                    disabled={actionBusy}
                    style={{ padding:"9px 16px", borderRadius:9, border:"none", background:"#059669", color:"#fff", fontSize:12, fontWeight:700, cursor:actionBusy?"not-allowed":"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", opacity:actionBusy?0.6:1 }}
                  >Record Join</button>
                </div>
              )}
              {/* PR-E (C3) — Joined/Training transitions. Two buttons in one
                  card so the next step is always one click away. */}
              {(canStartTraining || canActivate) && (
                <div style={{ border:"1px solid #bfdbfe", background:"#eff6ff", borderRadius:10, padding:"12px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:"#1e40af", marginBottom:2 }}>Onboarding</div>
                    <div style={{ fontSize:11, color:"#1e3a8a" }}>
                      {c.stage === 'Joined' && 'Move to Training when onboarding starts, or skip directly to Active.'}
                      {c.stage === 'Training' && 'Mark Active once the BD is fully ramped on the job.'}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:6 }}>
                    {canStartTraining && (
                      <button onClick={beginTraining} disabled={actionBusy}
                              style={{ padding:"9px 14px", borderRadius:9, border:"none", background:"#2563eb", color:"#fff", fontSize:12, fontWeight:700, cursor:actionBusy?"not-allowed":"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", opacity:actionBusy?0.6:1 }}>
                        Start Training
                      </button>
                    )}
                    {canActivate && (
                      <button onClick={goActive} disabled={actionBusy}
                              style={{ padding:"9px 14px", borderRadius:9, border:"none", background:"#047857", color:"#fff", fontSize:12, fontWeight:700, cursor:actionBusy?"not-allowed":"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", opacity:actionBusy?0.6:1 }}>
                        Mark Active
                      </button>
                    )}
                  </div>
                </div>
              )}
              {/* PR-E (C2) — Expected Joining Date. Editable from Offered onward. */}
              {canSetExpectedJoining && (
                <div style={{ border:"1px solid #e2e8f0", background:"#f8fafc", borderRadius:10, padding:"12px 14px", display:"flex", alignItems:"flex-end", gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:4 }}>Expected Joining Date</div>
                    <label style={{ fontSize:11, color:"#64748b" }}>TA fills this in once the offer goes out. Drives the Requisitions tab "Expected Joining" column.</label>
                    <input type="date" value={expectedJoiningEdit} onChange={e=>setExpectedJoiningEdit(e.target.value)} style={{ ...inp, marginTop:4 }}/>
                  </div>
                  <button onClick={saveExpectedJoining} disabled={actionBusy || expectedJoiningEdit === (c.expectedJoiningDate || '')}
                          style={{ padding:"9px 16px", borderRadius:9, border:"none", background:"#0f766e", color:"#fff", fontSize:12, fontWeight:700, cursor:(actionBusy || expectedJoiningEdit === (c.expectedJoiningDate || ''))?"not-allowed":"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", opacity:(actionBusy || expectedJoiningEdit === (c.expectedJoiningDate || ''))?0.6:1 }}>
                    Save
                  </button>
                </div>
              )}
              {actionError && (
                <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:9, padding:"10px 12px", fontSize:11, color:"#991b1b" }}>
                  {actionError}
                </div>
              )}
            </div>
          )}

          {tab==="interviews" && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {[
                { roundLabel:"Round 1", interview:r1Interview },
                { roundLabel:"Round 2", interview:r2Interview },
              ].map(({ roundLabel, interview }) => {
                const result = interview?.result;
                const by = interview?.interviewerName;
                const date = interview?.scheduledDate;
                const resultColor = result === 'Select' ? '#059669'
                  : result === 'Reject' ? '#dc2626'
                  : result === 'No-show' ? '#92400e' : '#94a3b8';
                const resultBg = result === 'Select' ? '#d1fae5'
                  : result === 'Reject' ? '#fee2e2'
                  : result === 'No-show' ? '#fef3c7' : '#f1f5f9';
                return (
                  <div key={roundLabel} style={{ border:"1px solid #e2e8f0", borderRadius:12, padding:16 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>{roundLabel}</div>
                      {result && <span style={{ fontSize:12, fontWeight:700, color:resultColor, background:resultBg, padding:"3px 10px", borderRadius:99 }}>{result}</span>}
                      {!result && interview && <span style={{ fontSize:11, color:"#94a3b8" }}>Pending result</span>}
                      {!interview && <span style={{ fontSize:11, color:"#cbd5e1" }}>Not scheduled</span>}
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                      <div style={{ background:"#f8fafc", borderRadius:8, padding:"9px 11px" }}>
                        <div style={{ fontSize:10, color:"#94a3b8", fontWeight:600 }}>INTERVIEWER</div>
                        <div style={{ fontSize:13, fontWeight:600, color:"#0f172a", marginTop:2 }}>{by||"—"}</div>
                      </div>
                      <div style={{ background:"#f8fafc", borderRadius:8, padding:"9px 11px" }}>
                        <div style={{ fontSize:10, color:"#94a3b8", fontWeight:600 }}>DATE</div>
                        <div style={{ fontSize:13, fontWeight:600, color:"#0f172a", marginTop:2, fontFamily:"'DM Mono', monospace" }}>{date||"—"}</div>
                      </div>
                    </div>
                    {interview && !result && (
                      <div style={{ display:"flex", gap:6, marginTop:12 }}>
                        <button
                          onClick={()=>recordResult(interview, "Select")}
                          disabled={actionBusy}
                          style={{ flex:1, padding:"8px", borderRadius:8, border:"none", background:"#059669", color:"#fff", fontSize:12, fontWeight:700, cursor:actionBusy?"not-allowed":"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", opacity:actionBusy?0.6:1 }}
                        >✓ Select</button>
                        <button
                          onClick={()=>recordResult(interview, "Reject")}
                          disabled={actionBusy}
                          style={{ flex:1, padding:"8px", borderRadius:8, border:"none", background:"#dc2626", color:"#fff", fontSize:12, fontWeight:700, cursor:actionBusy?"not-allowed":"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", opacity:actionBusy?0.6:1 }}
                        >✗ Reject</button>
                        <button
                          onClick={()=>recordResult(interview, "No-show")}
                          disabled={actionBusy}
                          style={{ flex:1, padding:"8px", borderRadius:8, border:"none", background:"#d97706", color:"#fff", fontSize:12, fontWeight:700, cursor:actionBusy?"not-allowed":"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", opacity:actionBusy?0.6:1 }}
                        >No-show</button>
                        {canCancel && (
                          <button
                            onClick={()=>cancelScheduled(interview)}
                            disabled={actionBusy}
                            title="Cancel this interview (reverts candidate stage)"
                            style={{ padding:"8px 10px", borderRadius:8, border:"1px solid #e2e8f0", background:"#fff", color:"#64748b", fontSize:12, fontWeight:600, cursor:actionBusy?"not-allowed":"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", opacity:actionBusy?0.6:1 }}
                          >Cancel</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {actionError && (
                <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:9, padding:"10px 12px", fontSize:11, color:"#991b1b" }}>
                  {actionError}
                </div>
              )}
            </div>
          )}

          {tab==="schedule" && (
            <div style={{ display:"flex", flexDirection:"column", gap:14, alignItems:"flex-start" }}>
              <div style={{ fontSize:12, color:"#64748b" }}>
                Open the schedule modal to book or reschedule an interview for {c.name}. The system picks the right round based on their current pipeline stage.
              </div>
              <button
                onClick={()=>setShowScheduleModal(true)}
                style={{ padding:"10px 18px", borderRadius:9, border:"none", background:S.primary, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif" }}
              >
                + Schedule Interview
              </button>
            </div>
          )}

          {tab==="documents" && (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <div style={{ fontSize:12, color:"#64748b", marginBottom:4 }}>
                Documents are stored on the server (local disk in dev; AWS S3 in production). Max 10 MB per file.
              </div>
              {[
                { canonical:"Resume",             label:"Resume / CV" },
                { canonical:"Motivation Letter",  label:"Motivation Letter" },
                { canonical:"Offer Letter",       label:"Offer Letter" },
                { canonical:"ID Proof",           label:"ID Proof (Aadhaar)" },
                { canonical:"Relieving Letter",   label:"Previous Org Relieving Letter" },
                { canonical:"Appointment Letter", label:"Appointment Letter" },
              ].map(({ canonical, label }) => {
                const existing = documents.find(d => d.docType === canonical);
                const busy = docBusy === canonical;
                const inputId = `doc-${canonical.replace(/\s+/g,"-")}`;
                return (
                  <div key={canonical} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 14px", border:"1px solid #e2e8f0", borderRadius:10, gap:12 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                      <FileText size={14} color={existing?"#059669":"#94a3b8"}/>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:"#374151" }}>{label}</div>
                        {existing && (
                          <div style={{ fontSize:10, color:"#64748b", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:260 }}>
                            {existing.filename} · {(existing.sizeBytes/1024).toFixed(1)} KB
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                      {existing && (
                        <>
                          <a href={api.documentDownloadUrl(existing.id)} style={{ fontSize:11, fontWeight:600, color:S.primary, textDecoration:"none", border:`1px solid ${S.primary}40`, borderRadius:7, padding:"4px 10px" }}>Download</a>
                          <button onClick={()=>handleDocDelete(existing.id)} disabled={busy} style={{ fontSize:11, fontWeight:600, color:"#dc2626", background:"transparent", border:"1px solid #fecaca", borderRadius:7, padding:"4px 10px", cursor:busy?"not-allowed":"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif" }}>Remove</button>
                        </>
                      )}
                      <input id={inputId} type="file" style={{ display:"none" }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleDocUpload(canonical, f); e.target.value = ""; }}/>
                      <label htmlFor={inputId} style={{ fontSize:11, fontWeight:600, color:"#fff", background:busy?"#94a3b8":S.primary, borderRadius:7, padding:"5px 11px", cursor:busy?"not-allowed":"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", opacity:busy?0.7:1 }}>
                        {busy ? "Uploading…" : existing ? "Replace" : "Upload"}
                      </label>
                    </div>
                  </div>
                );
              })}
              {actionError && (
                <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:9, padding:"10px 12px", fontSize:11, color:"#991b1b" }}>{actionError}</div>
              )}
            </div>
          )}
        </div>
      </div>
      {showScheduleModal && (
        <ScheduleInterviewModal
          candidateId={c.id}
          onClose={() => setShowScheduleModal(false)}
          onSaved={() => { refreshInterviews(); setTab('interviews'); }}
        />
      )}
      {/* PR-L: PR-J.5's confirmation modal removed — multi-assign means
          "you can't take this candidate back" no longer applies. */}
    </div>
  );
}

/* ─── NEW REQ MODAL ─────────────────────────────────────────── */
function NewReqModal({ onClose }) {
  const { createRequisition } = useData();
  const [form, setForm] = useState({ bu:"CPM", hireType:"New", city:"", bdType:"Focus", hospital:"", area:"", replacementFor:"", notes:"" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  // Per-field validation errors keyed by form-field name. Populated only on
  // submit-click; cleared per-field as the user types in each (see set()).
  const [errors, setErrors] = useState({});

  // Setting a field clears its error so the red border / error text disappear
  // immediately when the user starts fixing it. The error re-fires on the next
  // submit click if the field is still invalid.
  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => (e[k] ? { ...e, [k]: undefined } : e));
  };

  // Pure validator — returns an object of { field: 'message' } for every
  // invalid required field. Empty object means the form is OK to submit.
  const validate = () => {
    const e = {};
    if (!form.city) e.city = 'City is required';
    if (form.bdType === 'Focus' && !form.hospital.trim()) e.hospital = 'Hospital Name is required for Focus BD';
    if (form.hireType === 'Replacement' && !form.replacementFor.trim()) e.replacementFor = 'Replacing BD Name is required';
    return e;
  };

  const submit = async () => {
    setSubmitError(null);
    const fieldErrors = validate();
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return; // bail before network

    try {
      setSubmitting(true);
      // raisedBy is set server-side from the authenticated user (mock auth header).
      await createRequisition({
        city: form.city,
        hospital: form.hospital.trim() || "—",
        area: form.area.trim() || null,
        bdType: form.bdType,
        bu: form.bu,
        hireType: form.hireType,
        replacementFor: form.hireType === "Replacement" ? form.replacementFor.trim() : null,
        notes: form.notes.trim() || null,
      });
      onClose();
    } catch (err) {
      // Server / network failures stay in the bottom red box — they're not
      // attached to a specific field, so showing them inline doesn't apply.
      setSubmitError(err.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const inp = { width:"100%", marginTop:4, fontSize:12, border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 10px", outline:"none", fontFamily:"'Plus Jakarta Sans', sans-serif", color:"#374151" };
  // Border switches to red when this field has a validation error. Everything
  // else stays the same as `inp` so the layout doesn't shift.
  const inputStyle = (k) => ({ ...inp, border: errors[k] ? '1px solid #dc2626' : '1px solid #e2e8f0' });
  const ErrorText = ({ k }) => errors[k]
    ? <div style={{ fontSize: 10, color: '#dc2626', marginTop: 4 }}>{errors[k]}</div>
    : null;

  return (
    <div style={{ position:"fixed", inset:0, zIndex:70, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:18, width:520, boxShadow:"0 20px 60px rgba(0,0,0,0.18)", overflow:"hidden" }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:"22px 24px 18px", borderBottom:"1px solid #f1f5f9", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:17, fontWeight:800, color:"#0f172a" }}>New Hiring Requisition</div>
          <button style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8" }} onClick={onClose}><X size={18}/></button>
        </div>
        <div style={{ padding:24, maxHeight:"65vh", overflowY:"auto", display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Business Unit *</label>
              <select value={form.bu} onChange={e=>set("bu",e.target.value)} style={inp}>
                <option value="CPM">CPM – Lending</option>
                <option value="IGIV">IGIV – Crowdfunding</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Hire Type *</label>
              <select value={form.hireType} onChange={e=>set("hireType",e.target.value)} style={inp}>
                <option value="New">New Hire</option>
                <option value="Replacement">Replacement</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>City *</label>
              <select value={form.city} onChange={e=>set("city",e.target.value)} style={inputStyle("city")}>
                <option value="">Select city…</option>
                {["Ahmedabad","Bangalore","Bhubaneswar","Chennai","Delhi","Hyderabad","Indore","Kochi","Kolkata","Mumbai","Pune"].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <ErrorText k="city"/>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>BD Type *</label>
              <select value={form.bdType} onChange={e=>set("bdType",e.target.value)} style={inp}>
                <option value="Focus">Focus BD (single hospital)</option>
                <option value="Floater">Floater BD (multi-hospital)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>{form.bdType==="Focus"?"Hospital Name *":"Hospital Name"}</label>
              <input value={form.hospital} onChange={e=>set("hospital",e.target.value)} placeholder="e.g. Apollo Greams Road" style={inputStyle("hospital")}/>
              <ErrorText k="hospital"/>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>{form.bdType==="Floater"?"Areas to Cover":"Area / Zone"}</label>
              <input value={form.area} onChange={e=>set("area",e.target.value)} placeholder="e.g. Andheri West" style={inp}/>
            </div>
            {form.hireType==="Replacement" && (
              <div style={{ gridColumn:"1/-1" }}>
                <label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Replacing BD Name *</label>
                <input value={form.replacementFor} onChange={e=>set("replacementFor",e.target.value)} placeholder="Full name of the BD being replaced" style={inputStyle("replacementFor")}/>
                <ErrorText k="replacementFor"/>
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Additional Requirements</label>
            <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={3} placeholder="e.g. Female candidate preferred, must have lending background…" style={{ ...inp, resize:"none" }}/>
          </div>
          <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:9, padding:"10px 12px", fontSize:11, color:"#1e40af", display:"flex", gap:6, alignItems:"flex-start" }}>
            <AlertCircle size={13} style={{ flexShrink:0, marginTop:1 }}/>
            Req-approval will be auto-routed to the appropriate approvers based on the selected Business Unit.
          </div>
          {submitError && (
            <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:9, padding:"10px 12px", fontSize:11, color:"#991b1b" }}>
              {submitError}
            </div>
          )}
        </div>
        <div style={{ padding:"16px 24px", borderTop:"1px solid #f1f5f9", display:"flex", justifyContent:"flex-end", gap:10 }}>
          <button onClick={onClose} disabled={submitting} style={{ padding:"9px 16px", borderRadius:9, border:"1px solid #e2e8f0", background:"#fff", fontSize:12, fontWeight:600, cursor:submitting?"not-allowed":"pointer", color:"#64748b", fontFamily:"'Plus Jakarta Sans', sans-serif", opacity:submitting?0.6:1 }}>Cancel</button>
          <button onClick={submit} disabled={submitting} style={{ padding:"9px 18px", borderRadius:9, border:"none", background:S.primary, color:"#fff", fontSize:12, fontWeight:600, cursor:submitting?"not-allowed":"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", opacity:submitting?0.7:1 }}>{submitting?"Submitting…":"Submit for Approval"}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── NEW CANDIDATE MODAL ──────────────────────────────────── */
// Manual one-at-a-time candidate add. Excel import stays for bulk migration.
// defaultReqId / defaultBu pre-fill from the Pipeline filters when set, so the
// common "open req detail → add a candidate to it" flow has zero friction.
function NewCandidateModal({ onClose, defaultReqId = null, defaultBu = null, application = null }) {
  const { requisitions: REQUISITIONS, createCandidate, acceptApplication, me, users } = useData();
  // PR-L: assignable users = TAs + admins. Sorted by first name. Multi-select.
  const taOptions = useMemo(
    () => (users || [])
      .filter(u => u.role === 'ta' || u.role === 'admin')
      .sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );
  // Default selection: signed-in user pre-checked if they're TA or admin.
  const initialTaIds = me && (me.role === 'ta' || me.role === 'admin') ? [me.id] : [];
  const [form, setForm] = useState({
    reqId: defaultReqId || '',
    name: application?.parsedName || application?.senderName || '',
    phone: application?.parsedPhone || '',
    email: application?.parsedEmail || application?.senderEmail || '',
    city: '',
    currentRole: '',
    company: '',
    currentCTC: '',
    expectedCTC: '',
    notice: '',
    bu: defaultBu || '',
    taIds: initialTaIds,
  });
  const toggleTaId = (id) => setForm(f => ({
    ...f,
    taIds: f.taIds.includes(id) ? f.taIds.filter(x => x !== id) : [...f.taIds, id],
  }));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Only show requisitions that can accept candidates (Approved or Active —
  // not Pending Approval or Filled).
  const eligibleReqs = useMemo(
    () => REQUISITIONS.filter((r) => r.status === 'Approved' || r.status === 'Active'),
    [REQUISITIONS],
  );

  // When the user picks a requisition, auto-fill BU and city from it. The user
  // can still override before submit if needed (rare, but possible).
  const onReqChange = (reqId) => {
    const req = REQUISITIONS.find((r) => r.id === reqId);
    setForm((f) => ({
      ...f,
      reqId,
      bu: req?.bu || f.bu,
      city: req?.city || f.city,
    }));
  };

  const submit = async () => {
    setSubmitError(null);
    if (!form.reqId) { setSubmitError('Requisition is required'); return; }
    if (!form.name.trim()) { setSubmitError('Name is required'); return; }
    if (!form.phone.trim() || form.phone.trim().length < 7) { setSubmitError('Phone number looks too short'); return; }
    if (!form.city) { setSubmitError('City is required'); return; }
    if (!form.currentRole.trim()) { setSubmitError('Current role is required'); return; }
    if (!form.company.trim()) { setSubmitError('Current company is required'); return; }
    if (!form.bu) { setSubmitError('Business Unit is required'); return; }
    if (!form.taIds || form.taIds.length === 0) { setSubmitError('At least one TA must be assigned'); return; }

    // Optional numbers: empty -> null, otherwise parse. Backend rejects 0/negative.
    const toIntOrNull = (v) => {
      const s = String(v).replace(/[,\s]/g, '');
      if (!s) return null;
      const n = Number(s);
      return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    };

    try {
      setSubmitting(true);
      const payload = {
        reqId: form.reqId,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        city: form.city,
        currentRole: form.currentRole.trim(),
        company: form.company.trim(),
        currentCTC: toIntOrNull(form.currentCTC),
        expectedCTC: toIntOrNull(form.expectedCTC),
        notice: form.notice.trim() || null,
        taIds: form.taIds,
        bu: form.bu,
      };
      if (application) {
        await acceptApplication(application.id, payload);
      } else {
        await createCandidate(payload);
      }
      onClose();
    } catch (err) {
      setSubmitError(err.message || 'Failed to create candidate');
    } finally {
      setSubmitting(false);
    }
  };

  const inp = { width:"100%", marginTop:4, fontSize:12, border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 10px", outline:"none", fontFamily:"'Plus Jakarta Sans', sans-serif", color:"#374151" };
  const lbl = { fontSize:11, fontWeight:600, color:"#374151" };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:70, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:18, width:560, boxShadow:"0 20px 60px rgba(0,0,0,0.18)", overflow:"hidden" }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:"22px 24px 18px", borderBottom:"1px solid #f1f5f9", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:17, fontWeight:800, color:"#0f172a" }}>{application ? "Accept Application" : "Add Candidate"}</div>
          <button style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8" }} onClick={onClose}><X size={18}/></button>
        </div>
        <div style={{ padding:24, maxHeight:"68vh", overflowY:"auto", display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label style={lbl}>Requisition *</label>
            <select value={form.reqId} onChange={e=>onReqChange(e.target.value)} style={inp}>
              <option value="">Select requisition…</option>
              {eligibleReqs.map(r => (
                <option key={r.id} value={r.id}>{r.id} · {r.city} · {r.hospital} · {r.bdType} BD ({r.bu})</option>
              ))}
            </select>
            {eligibleReqs.length === 0 && (
              <div style={{ marginTop:6, fontSize:11, color:"#92400e" }}>
                No approved requisitions available. Approve one in the Requisitions section first.
              </div>
            )}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <label style={lbl}>Full Name *</label>
              <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Priya Sharma" style={inp}/>
            </div>
            <div>
              <label style={lbl}>Phone *</label>
              <input value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="e.g. 9876543210" style={inp}/>
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={lbl}>Email</label>
              <input value={form.email} onChange={e=>set("email",e.target.value)} placeholder="optional" type="email" style={inp}/>
            </div>
            <div>
              <label style={lbl}>City *</label>
              <select value={form.city} onChange={e=>set("city",e.target.value)} style={inp}>
                <option value="">Select city…</option>
                {["Ahmedabad","Bangalore","Bhubaneswar","Chennai","Delhi","Hyderabad","Indore","Kochi","Kolkata","Mumbai","Pune"].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Business Unit *</label>
              <select value={form.bu} onChange={e=>set("bu",e.target.value)} style={inp}>
                <option value="">Select BU…</option>
                <option value="CPM">CPM – Lending</option>
                <option value="IGIV">IGIV – Crowdfunding</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Current Role *</label>
              <input value={form.currentRole} onChange={e=>set("currentRole",e.target.value)} placeholder="e.g. BDA" style={inp}/>
            </div>
            <div>
              <label style={lbl}>Current Company *</label>
              <input value={form.company} onChange={e=>set("company",e.target.value)} placeholder="e.g. Pristyn Care" style={inp}/>
            </div>
            <div>
              <label style={lbl}>Current CTC (₹)</label>
              <input value={form.currentCTC} onChange={e=>set("currentCTC",e.target.value)} placeholder="e.g. 300000" style={inp}/>
            </div>
            <div>
              <label style={lbl}>Expected CTC (₹)</label>
              <input value={form.expectedCTC} onChange={e=>set("expectedCTC",e.target.value)} placeholder="e.g. 400000" style={inp}/>
            </div>
            <div>
              <label style={lbl}>Notice Period</label>
              <input value={form.notice} onChange={e=>set("notice",e.target.value)} placeholder="e.g. 30 days" style={inp}/>
            </div>
            <div>
              <label style={lbl}>Assigned to (TA) *</label>
              <div role="group" aria-label="Assigned to TAs" style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:160, overflowY:"auto", padding:"8px 10px", background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, marginTop:4 }}>
                {taOptions.length === 0 && (
                  <div style={{ fontSize:12, color:"#94a3b8", padding:"4px 0" }}>Loading users…</div>
                )}
                {taOptions.map(t => (
                  <label key={t.email} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:"#374151", cursor:"pointer" }}>
                    <input
                      type="checkbox"
                      checked={form.taIds.includes(t.id)}
                      onChange={() => toggleTaId(t.id)}
                    />
                    <span>{t.name}{t.role === 'admin' ? ' (admin)' : ''}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {submitError && (
            <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:9, padding:"10px 12px", fontSize:11, color:"#991b1b" }}>
              {submitError}
            </div>
          )}
        </div>
        <div style={{ padding:"16px 24px", borderTop:"1px solid #f1f5f9", display:"flex", justifyContent:"flex-end", gap:10 }}>
          <button onClick={onClose} disabled={submitting} style={{ padding:"9px 16px", borderRadius:9, border:"1px solid #e2e8f0", background:"#fff", fontSize:12, fontWeight:600, cursor:submitting?"not-allowed":"pointer", color:"#64748b", fontFamily:"'Plus Jakarta Sans', sans-serif", opacity:submitting?0.6:1 }}>Cancel</button>
          <button onClick={submit} disabled={submitting || eligibleReqs.length === 0} style={{ padding:"9px 18px", borderRadius:9, border:"none", background:S.primary, color:"#fff", fontSize:12, fontWeight:600, cursor:(submitting || eligibleReqs.length === 0)?"not-allowed":"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", opacity:(submitting || eligibleReqs.length === 0)?0.7:1 }}>{submitting ? (application ? "Accepting…" : "Adding…") : (application ? "Accept & Add" : "Add Candidate")}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── IMPORT CANDIDATES MODAL ──────────────────────────────── */
function ImportCandidatesModal({ onClose }) {
  const { refresh } = useData();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [commitResult, setCommitResult] = useState(null);

  const onFile = async (f) => {
    setError(null);
    setPreview(null);
    setCommitResult(null);
    setFile(f);
    if (!f) return;
    try {
      setBusy(true);
      const result = await api.importCandidates(f, { dryRun: true });
      setPreview(result);
    } catch (err) {
      setError(err.message || "Failed to parse file");
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!file) return;
    setError(null);
    try {
      setBusy(true);
      const result = await api.importCandidates(file, { dryRun: false });
      setCommitResult(result);
      await refresh(); // reload all candidates into context
    } catch (err) {
      setError(err.message || "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:70, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:18, width:720, maxHeight:"88vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.18)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:"22px 24px 18px", borderBottom:"1px solid #f1f5f9", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:"#0f172a" }}>Import Candidates</div>
            <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>Upload an Excel (.xlsx) or CSV file. We preview first — nothing is saved until you click Commit.</div>
          </div>
          <button style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8" }} onClick={onClose}><X size={18}/></button>
        </div>

        <div style={{ padding:24, display:"flex", flexDirection:"column", gap:16 }}>
          {/* File picker */}
          {!commitResult && (
            <div>
              <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#374151", marginBottom:6 }}>Select file</label>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={e=>onFile(e.target.files?.[0])}
                style={{ fontSize:12, padding:"8px 10px", border:"1px dashed #cbd5e1", borderRadius:9, width:"100%", background:"#f8fafc", cursor:"pointer" }}/>
              <div style={{ fontSize:11, color:"#94a3b8", marginTop:8 }}>
                Expected columns (case-insensitive, flexible names): Name, Phone, Email, City, Current Role, Company, Current CTC, Expected CTC, Notice, Req ID, BU. TA is optional — defaults to your name when omitted.
              </div>
            </div>
          )}

          {busy && <div style={{ fontSize:12, color:"#64748b" }}>Working…</div>}
          {error && <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:9, padding:"10px 12px", fontSize:11, color:"#991b1b" }}>{error}</div>}

          {/* Preview (dry-run) */}
          {preview && !commitResult && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                <StatCard label="Total Rows" value={preview.totalRows} color="#0f172a" />
                <StatCard label="Valid" value={preview.validCount} color="#059669" />
                <StatCard label="Invalid" value={preview.invalidCount} color={preview.invalidCount>0?"#dc2626":"#94a3b8"} />
              </div>

              {preview.valid.length > 0 && (
                <div style={{ border:"1px solid #d1fae5", borderRadius:10, overflow:"hidden" }}>
                  <div style={{ background:"#ecfdf5", padding:"8px 12px", fontSize:11, fontWeight:700, color:"#065f46" }}>Valid rows ({preview.valid.length})</div>
                  <div style={{ maxHeight:200, overflowY:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                      <thead style={{ background:"#f8fafc" }}><tr><Th>Row</Th><Th>Name</Th><Th>Req</Th><Th>City</Th><Th>Company</Th></tr></thead>
                      <tbody>
                        {preview.valid.map(v => (
                          <tr key={v.rowIndex}><Td>{v.rowIndex}</Td><Td>{v.input.name}</Td><Td>{v.input.reqId}</Td><Td>{v.input.city}</Td><Td>{v.input.company}</Td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {preview.invalid.length > 0 && (
                <div style={{ border:"1px solid #fecaca", borderRadius:10, overflow:"hidden" }}>
                  <div style={{ background:"#fef2f2", padding:"8px 12px", fontSize:11, fontWeight:700, color:"#991b1b" }}>Invalid rows ({preview.invalid.length}) — these will be skipped</div>
                  <div style={{ maxHeight:200, overflowY:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                      <thead style={{ background:"#f8fafc" }}><tr><Th>Row</Th><Th>Issue(s)</Th></tr></thead>
                      <tbody>
                        {preview.invalid.map(i => (
                          <tr key={i.rowIndex}><Td>{i.rowIndex}</Td><Td style={{ color:"#991b1b" }}>{i.errors.join("; ")}</Td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Commit result */}
          {commitResult && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ background:"#ecfdf5", border:"1px solid #a7f3d0", borderRadius:10, padding:"12px 14px", fontSize:13, color:"#065f46", fontWeight:700 }}>
                ✓ Imported {commitResult.createdCount} candidates. {commitResult.invalidCount > 0 && `Skipped ${commitResult.invalidCount} invalid rows.`}
              </div>
              {commitResult.insertFailures && commitResult.insertFailures.length > 0 && (
                <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10, padding:"10px 12px", fontSize:11, color:"#991b1b" }}>
                  {commitResult.insertFailures.length} row(s) passed validation but failed to insert. Check the server logs.
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding:"16px 24px", borderTop:"1px solid #f1f5f9", display:"flex", justifyContent:"flex-end", gap:10 }}>
          <button onClick={onClose} disabled={busy} style={{ padding:"9px 16px", borderRadius:9, border:"1px solid #e2e8f0", background:"#fff", fontSize:12, fontWeight:600, cursor:busy?"not-allowed":"pointer", color:"#64748b", fontFamily:"'Plus Jakarta Sans', sans-serif" }}>
            {commitResult ? "Close" : "Cancel"}
          </button>
          {preview && !commitResult && preview.validCount > 0 && (
            <button onClick={commit} disabled={busy} style={{ padding:"9px 18px", borderRadius:9, border:"none", background:S.primary, color:"#fff", fontSize:12, fontWeight:600, cursor:busy?"not-allowed":"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", opacity:busy?0.7:1 }}>
              {busy ? "Committing…" : `Commit Import (${preview.validCount})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── INTERVIEWS PAGE ──────────────────────────────────────── */
// Fully rewritten in PR B. Source of truth: the `interviews` table (via
// api.listInterviews). The old version read denormalized r1Date/r2Date fields
// off candidates; those cache fields are dropped in PR C.
function Interviews({ bu }) {
  const {
    me,
    requisitions: REQUISITIONS,
    candidates: CANDIDATES,
    interviewers,
    cancelInterview,
    recordInterviewResult,
  } = useData();
  // PR D RBAC: same gating as the candidate side panel — TAs can't cancel.
  const canCancel = me?.role === 'admin' || me?.role === 'approver';

  // Filter state
  const [roundF, setRoundF] = useState('all');         // 'all' | 1 | 2
  const [outcomeF, setOutcomeF] = useState('all');     // 'all' | 'Scheduled' | 'Select' | 'Reject' | 'No-show'
  const [interviewerF, setInterviewerF] = useState('all');
  const [cityF, setCityF] = useState('all');           // PR-F (I2): city filter, applied client-side
  const [dateRangeF, setDateRangeF] = useState('all'); // 'all' | 'today' | 'week' | 'month' | 'custom'
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [includeCancelled, setIncludeCancelled] = useState(false);

  // Computed date range for the filter (sent to backend)
  const { dateFrom, dateTo } = useMemo(() => {
    const today = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    if (dateRangeF === 'today') return { dateFrom: iso(today), dateTo: iso(today) };
    if (dateRangeF === 'week') {
      const start = new Date(today); start.setDate(today.getDate() - today.getDay());
      const end = new Date(start); end.setDate(start.getDate() + 6);
      return { dateFrom: iso(start), dateTo: iso(end) };
    }
    if (dateRangeF === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { dateFrom: iso(start), dateTo: iso(end) };
    }
    if (dateRangeF === 'custom') return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
    return { dateFrom: undefined, dateTo: undefined };
  }, [dateRangeF, customFrom, customTo]);

  // Fetch interviews from the backend with the active filters.
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const refresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.listInterviews({
        round: roundF !== 'all' ? roundF : undefined,
        result: outcomeF !== 'all' ? outcomeF : undefined,
        interviewerName: interviewerF !== 'all' ? interviewerF : undefined,
        dateFrom,
        dateTo,
        includeCancelled,
      });
      setRows(data);
    } catch (err) {
      setLoadError(err.message || 'Failed to load interviews');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ },
    [roundF, outcomeF, interviewerF, dateFrom, dateTo, includeCancelled]);

  // Join with candidates client-side for name/req/city/company display.
  // Also apply the BU + city filters client-side (server doesn't know about them).
  const enrichedRows = useMemo(() => {
    return rows
      .map(iv => {
        const cand = CANDIDATES.find(c => c.id === iv.candidateId);
        const req = cand ? REQUISITIONS.find(r => r.id === cand.reqId) : null;
        return { iv, cand, req };
      })
      .filter(({ cand }) => bu === 'all' || (cand && cand.bu === bu))
      .filter(({ cand }) => cityF === 'all' || (cand && cand.city === cityF));
  }, [rows, CANDIDATES, REQUISITIONS, bu, cityF]);

  // PR-F (I3): summary panel inputs — derived from the same filter scope
  // (BU + city + date range) so the numbers always reconcile with the table
  // beneath. Sahil's framing: "interview activity in a city is correlated
  // to open requisitions there", so the panel surfaces both side-by-side.
  const summary = useMemo(() => {
    const inScopeCandidates = CANDIDATES.filter(c =>
      (bu === 'all' || c.bu === bu) && (cityF === 'all' || c.city === cityF),
    );
    const inScopeReqs = REQUISITIONS.filter(r =>
      (bu === 'all' || r.bu === bu)
      && (cityF === 'all' || r.city === cityF)
      && r.status !== 'Filled',
    );
    // R1 / R2 counts are over the active (non-cancelled) interviews in the
    // current view — which already respect date range, BU, and city.
    const r1 = enrichedRows.filter(({ iv }) => iv.round === 1 && !iv.cancelledAt).length;
    const r2 = enrichedRows.filter(({ iv }) => iv.round === 2 && !iv.cancelledAt).length;
    // Offered / Joined: scope by date range when one is set (using offerDate /
    // joinDate on the candidate). Otherwise count current-stage candidates.
    const inDateRange = (d) => {
      if (!d) return false;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    };
    const dateScoped = !!(dateFrom || dateTo);
    const offered = dateScoped
      ? inScopeCandidates.filter(c => inDateRange(c.offerDate)).length
      : inScopeCandidates.filter(c => ['Offered', 'Joined', 'Training', 'Active'].includes(c.stage)).length;
    const joined = dateScoped
      ? inScopeCandidates.filter(c => inDateRange(c.joinDate)).length
      : inScopeCandidates.filter(c => ['Joined', 'Training', 'Active'].includes(c.stage)).length;
    return { openReqs: inScopeReqs.length, r1, r2, offered, joined, dateScoped };
  }, [CANDIDATES, REQUISITIONS, enrichedRows, bu, cityF, dateFrom, dateTo]);

  // City dropdown — derive from candidate.city, scoped to the current BU so
  // we don't list cities that have no candidates in the visible BU.
  const cityOptions = useMemo(() => {
    const set = new Set();
    for (const c of CANDIDATES) {
      if ((bu === 'all' || c.bu === bu) && c.city) set.add(c.city);
    }
    return [...set].sort();
  }, [CANDIDATES, bu]);

  // KPIs derived from the currently-filtered list (so they always match the table)
  const kpis = useMemo(() => {
    const k = { upcoming: 0, selected: 0, rejected: 0, noShow: 0 };
    for (const { iv } of enrichedRows) {
      if (iv.cancelledAt) continue;
      if (!iv.result) k.upcoming += 1;
      else if (iv.result === 'Select') k.selected += 1;
      else if (iv.result === 'Reject') k.rejected += 1;
      else if (iv.result === 'No-show') k.noShow += 1;
    }
    return k;
  }, [enrichedRows]);

  // Modal state
  const [showSchedule, setShowSchedule] = useState(false);
  const [editing, setEditing] = useState(null); // { candidateId, interviewId } | null
  const [selectedC, setSelectedC] = useState(null);

  const onScheduleClick = () => { setEditing(null); setShowSchedule(true); };
  const onEdit = (iv) => { setEditing({ candidateId: iv.candidateId, interviewId: iv.id }); setShowSchedule(true); };

  const onMarkOutcome = async (iv, result) => {
    try {
      await recordInterviewResult(iv.id, result, iv.candidateId);
      await refresh();
    } catch (err) {
      alert(err.message || 'Failed to record outcome');
    }
  };

  const onCancel = async (iv, cand) => {
    if (!confirm(`Cancel ${iv.round === 1 ? 'R1' : 'R2'} interview for ${cand?.name || iv.candidateId}?`)) return;
    const reason = window.prompt('Reason (optional):') || '';
    try {
      await cancelInterview(iv.id, iv.candidateId, reason);
      await refresh();
    } catch (err) {
      alert(err.message || 'Failed to cancel');
    }
  };

  const sel = {
    fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px',
    background: '#fff', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#374151', outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* PR-F (I3): Filters bar moved to the top of the page so the dynamic
          summary panel below always reflects what the user is asking for. */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={cityF} onChange={e => setCityF(e.target.value)} style={sel}>
          <option value="all">All Cities</option>
          {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={roundF} onChange={e => setRoundF(e.target.value === 'all' ? 'all' : Number(e.target.value))} style={sel}>
          <option value="all">All Rounds</option>
          <option value={1}>R1 only</option>
          <option value={2}>R2 only</option>
        </select>
        <select value={outcomeF} onChange={e => setOutcomeF(e.target.value)} style={sel}>
          <option value="all">All Outcomes</option>
          <option value="Scheduled">Scheduled (no outcome yet)</option>
          <option value="Select">Selected</option>
          <option value="Reject">Rejected</option>
          <option value="No-show">No-show</option>
        </select>
        <select value={interviewerF} onChange={e => setInterviewerF(e.target.value)} style={sel}>
          <option value="all">All Interviewers</option>
          {interviewers.map(i => <option key={i.name} value={i.name}>{i.name}</option>)}
        </select>
        <select value={dateRangeF} onChange={e => setDateRangeF(e.target.value)} style={sel}>
          <option value="all">All Dates</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="custom">Custom range…</option>
        </select>
        {dateRangeF === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ ...sel, padding: '5px 8px' }} />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ ...sel, padding: '5px 8px' }} />
          </>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b', cursor: 'pointer' }}>
          <input type="checkbox" checked={includeCancelled} onChange={e => setIncludeCancelled(e.target.checked)} />
          Include cancelled
        </label>
        <button
          onClick={onScheduleClick}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', background: S.primary, color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          <Plus size={13} /> Schedule Interview
        </button>
      </div>

      {/* PR-F (I3): Summary panel — open reqs alongside interview activity in
          the current scope, so a TA lead can plan workload at a glance. */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
            Activity summary
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginLeft: 8 }}>
              {bu === 'all' ? 'All BUs' : bu}
              {cityF !== 'all' && ` · ${cityF}`}
              {summary.dateScoped && ` · ${dateFrom || '…'} → ${dateTo || '…'}`}
            </span>
          </span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            {summary.dateScoped ? 'Offered/Joined counts in date range' : 'Offered/Joined = current-stage counts'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
          <SummaryCell label="Open reqs"  value={summary.openReqs} sub={cityF === 'all' ? 'All cities' : cityF} color="#d97706"/>
          <SummaryCell label="R1"         value={summary.r1}        sub="In view" color="#2563eb"/>
          <SummaryCell label="R2"         value={summary.r2}        sub="In view" color="#7c3aed"/>
          <SummaryCell label="Offered"    value={summary.offered}   sub={summary.dateScoped ? 'In range' : 'Cumulative'} color="#0f766e"/>
          <SummaryCell label="Joined"     value={summary.joined}    sub={summary.dateScoped ? 'In range' : 'Cumulative'} color="#059669"/>
        </div>
      </div>

      {/* Interview-outcome KPIs — kept below the activity summary so the
          richer summary is the first thing a recruiter sees. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <KpiCard value={kpis.upcoming} label="Upcoming" sub="Interviews scheduled" color="#2563eb" />
        <KpiCard value={kpis.selected} label="Selected" sub="Passed" color="#059669" />
        <KpiCard value={kpis.rejected} label="Rejected" sub="Failed" color="#dc2626" />
        <KpiCard value={kpis.noShow} label="No-show" sub="Did not attend" color="#d97706" />
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading && <div style={{ padding: 24, fontSize: 13, color: '#64748b' }}>Loading interviews…</div>}
        {loadError && <div style={{ padding: 24, fontSize: 13, color: '#dc2626' }}>Error: {loadError}</div>}
        {!loading && !loadError && enrichedRows.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            No interviews match the current filters.
          </div>
        )}
        {!loading && !loadError && enrichedRows.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <Th>Date / Time</Th>
                <Th>Candidate</Th>
                <Th>Req</Th>
                <Th>Round</Th>
                <Th>Interviewer</Th>
                <Th>Mode</Th>
                <Th>Outcome</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {enrichedRows.map(({ iv, cand, req }) => {
                const isCancelled = !!iv.cancelledAt;
                const baseStyle = { opacity: isCancelled ? 0.45 : 1 };
                return (
                  <tr key={iv.id} style={baseStyle}>
                    <Td>
                      <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: '#374151' }}>
                        {iv.scheduledDate}{iv.scheduledTime ? ` · ${iv.scheduledTime}` : ''}
                      </div>
                    </Td>
                    <Td>
                      {cand ? (
                        <div
                          onClick={() => setSelectedC(cand)}
                          style={{ cursor: 'pointer', display: 'inline-block' }}
                          onMouseEnter={(e) => { e.currentTarget.firstChild.style.color = S.primary; }}
                          onMouseLeave={(e) => { e.currentTarget.firstChild.style.color = '#0f172a'; }}
                        >
                          <div style={{ fontWeight: 600, color: '#0f172a', transition: 'color 0.15s' }}>{cand.name}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>{cand.city || ''}{cand.company ? ` · ${cand.company}` : ''}</div>
                        </div>
                      ) : (
                        <>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{iv.candidateId}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}></div>
                        </>
                      )}
                    </Td>
                    <Td><span style={{ fontSize: 11, color: '#64748b', fontFamily: "'DM Mono', monospace" }}>{req?.id || cand?.reqId || '—'}</span></Td>
                    <Td><span style={{ fontSize: 11, fontWeight: 700, color: iv.round === 1 ? '#2563eb' : '#7c3aed' }}>R{iv.round}</span></Td>
                    <Td><span style={{ fontSize: 12 }}>{iv.interviewerName}</span></Td>
                    <Td><span style={{ fontSize: 11, color: '#64748b' }}>{iv.mode}</span></Td>
                    <Td>
                      {isCancelled ? (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 99 }}>Cancelled</span>
                      ) : iv.result ? (
                        <ResultBadge result={iv.result} />
                      ) : (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: 99 }}>Scheduled</span>
                      )}
                    </Td>
                    <Td>
                      {!isCancelled && (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          {!iv.result && (
                            <select
                              defaultValue=""
                              onChange={e => { const v = e.target.value; if (v) { onMarkOutcome(iv, v); e.target.value = ''; } }}
                              style={{ ...sel, fontSize: 11, padding: '4px 6px' }}
                              title="Mark outcome"
                            >
                              <option value="">Mark…</option>
                              <option value="Select">Select</option>
                              <option value="Reject">Reject</option>
                              <option value="No-show">No-show</option>
                            </select>
                          )}
                          {!iv.result && (
                            <button
                              onClick={() => onEdit(iv)}
                              title="Edit"
                              style={{ padding: '4px 8px', fontSize: 11, border: '1px solid #e2e8f0', background: '#fff', borderRadius: 6, cursor: 'pointer', color: '#64748b' }}
                            >Edit</button>
                          )}
                          {!iv.result && canCancel && (
                            <button
                              onClick={() => onCancel(iv, cand)}
                              title="Cancel (reverts candidate stage)"
                              style={{ padding: '4px 8px', fontSize: 11, border: '1px solid #fecaca', background: '#fff', borderRadius: 6, cursor: 'pointer', color: '#dc2626' }}
                            >Cancel</button>
                          )}
                        </div>
                      )}
                      {isCancelled && iv.cancelledReason && (
                        <span style={{ fontSize: 10, color: '#94a3b8' }} title={iv.cancelledReason}>
                          Reason: {iv.cancelledReason.length > 24 ? iv.cancelledReason.slice(0, 24) + '…' : iv.cancelledReason}
                        </span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showSchedule && (
        <ScheduleInterviewModal
          candidateId={editing?.candidateId || null}
          interviewId={editing?.interviewId || null}
          onClose={() => { setShowSchedule(false); setEditing(null); }}
          onSaved={() => refresh()}
        />
      )}
      {selectedC && <CandidateModal c={selectedC} onClose={() => setSelectedC(null)} />}
    </div>
  );
}

function KpiCard({ value, label, sub, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '20px 22px' }}>
      <div style={{ fontSize: 32, fontWeight: 800, color, fontFamily: "'DM Mono', monospace" }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// Compact summary cell used by the Interviews activity-summary panel (PR-F).
// Smaller than KpiCard so 5 fit comfortably across.
function SummaryCell({ label, value, sub, color }) {
  return (
    <div style={{ borderRadius: 10, background: '#f8fafc', padding: '10px 12px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function ResultBadge({ result }) {
  const map = {
    Select: { color: '#059669', bg: '#d1fae5' },
    Reject: { color: '#dc2626', bg: '#fee2e2' },
    'No-show': { color: '#92400e', bg: '#fef3c7' },
  };
  const m = map[result] || { color: '#64748b', bg: '#f1f5f9' };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: m.color, background: m.bg, padding: '2px 8px', borderRadius: 99 }}>{result}</span>
  );
}

/* ─── INBOX / APPLICATIONS ─────────────────────────────────── */
function InboxSection() {
  const { applications, markInboxSeen } = useData();
  const [accepting, setAccepting] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const markedRef = useRef(false);

  useEffect(() => {
    if (!markedRef.current) { markedRef.current = true; markInboxSeen(); }
  }, [markInboxSeen]);

  const th = { fontSize:11, fontWeight:700, color:"#64748b", textAlign:"left", padding:"10px 12px", borderBottom:"2px solid #e2e8f0" };
  const td = { fontSize:12, color:"#374151", padding:"10px 12px", borderBottom:"1px solid #f1f5f9" };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:"#0f172a" }}>Inbox</div>
          <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>Incoming applications from email</div>
        </div>
      </div>

      {applications.length === 0 ? (
        <div style={{ textAlign:"center", padding:60, color:"#94a3b8" }}>
          <Inbox size={40} style={{ marginBottom:12, opacity:0.4 }}/>
          <div style={{ fontSize:14, fontWeight:600 }}>No pending applications</div>
          <div style={{ fontSize:12, marginTop:4 }}>New applications from email will appear here.</div>
        </div>
      ) : (
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>
                <th style={th}>Sender</th>
                <th style={th}>Subject</th>
                <th style={th}>Received</th>
                <th style={th}>Parsed Name</th>
                <th style={th}>CV</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map(app => (
                <tr key={app.id}>
                  <td style={td}>
                    <div style={{ fontWeight:600 }}>{app.senderName || "—"}</div>
                    <div style={{ fontSize:11, color:"#94a3b8" }}>{app.senderEmail}</div>
                  </td>
                  <td style={td}>{app.subject || "—"}</td>
                  <td style={td}>{app.receivedAt ? new Date(app.receivedAt).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }) : "—"}</td>
                  <td style={td}>{app.parsedName || "—"}</td>
                  <td style={td}>
                    {app.cvStorageKey ? (
                      <a href={`/api/applications/${app.id}/cv`} target="_blank" rel="noopener noreferrer" style={{ color:S.primary, fontSize:11, fontWeight:600 }}>
                        <FileText size={13} style={{ verticalAlign:"middle", marginRight:3 }}/>View CV
                      </a>
                    ) : <span style={{ color:"#94a3b8", fontSize:11 }}>None</span>}
                  </td>
                  <td style={td}>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={() => setAccepting(app)} style={{ padding:"5px 12px", borderRadius:7, border:"none", background:S.primary, color:"#fff", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                        <Check size={12} style={{ verticalAlign:"middle", marginRight:3 }}/>Accept
                      </button>
                      <button onClick={() => setRejecting(app)} style={{ padding:"5px 12px", borderRadius:7, border:"1px solid #fca5a5", background:"#fff", color:"#dc2626", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                        <X size={12} style={{ verticalAlign:"middle", marginRight:3 }}/>Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {accepting && <NewCandidateModal onClose={() => setAccepting(null)} application={accepting}/>}
      {rejecting && <RejectApplicationModal application={rejecting} onClose={() => setRejecting(null)}/>}
    </div>
  );
}

function RejectApplicationModal({ application, onClose }) {
  const { rejectApplication } = useData();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    try {
      setBusy(true);
      setError(null);
      await rejectApplication(application.id, reason.trim() || undefined);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to reject");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:70, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:14, width:420, boxShadow:"0 20px 60px rgba(0,0,0,0.18)" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid #f1f5f9", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:15, fontWeight:800, color:"#0f172a" }}>Reject Application</div>
          <button style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8" }} onClick={onClose}><X size={16}/></button>
        </div>
        <div style={{ padding:20 }}>
          <div style={{ fontSize:12, color:"#64748b", marginBottom:8 }}>
            Rejecting application from <strong>{application.senderName || application.senderEmail}</strong>
          </div>
          <textarea
            value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Reason (optional)"
            rows={3}
            style={{ width:"100%", fontSize:12, border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 10px", outline:"none", fontFamily:"'Plus Jakarta Sans', sans-serif", color:"#374151", resize:"vertical" }}
          />
          {error && <div style={{ marginTop:8, fontSize:11, color:"#991b1b" }}>{error}</div>}
        </div>
        <div style={{ padding:"14px 20px", borderTop:"1px solid #f1f5f9", display:"flex", justifyContent:"flex-end", gap:10 }}>
          <button onClick={onClose} disabled={busy} style={{ padding:"8px 14px", borderRadius:8, border:"1px solid #e2e8f0", background:"#fff", fontSize:12, fontWeight:600, cursor:busy?"not-allowed":"pointer", color:"#64748b", fontFamily:"'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button onClick={submit} disabled={busy} style={{ padding:"8px 14px", borderRadius:8, border:"none", background:"#dc2626", color:"#fff", fontSize:12, fontWeight:600, cursor:busy?"not-allowed":"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", opacity:busy?0.7:1 }}>{busy ? "Rejecting…" : "Reject"}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── APP ───────────────────────────────────────────────────── */
function AppShell() {
  const [section, setSection] = useState("dashboard");
  const [bu, setBu] = useState("all");
  const [reqFilter, setReqFilter] = useState("all");
  const [showNewReq, setShowNewReq] = useState(false);
  // Search-driven side-effects: a single navigation-intent payload that
  // target sections consume + clear. Shapes:
  //   { type: 'candidate', candidateId, reqId }
  //   { type: 'city', city }
  //   { type: 'hospital', hospital }
  //   { type: 'req', reqId }
  const [navIntent, setNavIntent] = useState(null);
  const clearNavIntent = () => setNavIntent(null);
  const { me } = useData();

  // PR-J: TAs land on Candidates, not Dashboard. The redirect runs once on
  // first `me` load (ref guard) so subsequent TA navigation isn't overridden.
  const hasRedirectedTA = useRef(false);
  useEffect(() => {
    if (me?.role === 'ta' && !hasRedirectedTA.current) {
      hasRedirectedTA.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSection('pipeline');
    }
  }, [me]);

  // Search → set both the section AND the intent in one shot. The intent
  // fires immediately; target sections consume on mount/effect.
  const handleNavigate = (intent) => {
    setNavIntent(intent);
    if (intent.type === 'candidate') { setReqFilter(intent.reqId); setSection('pipeline'); }
    else if (intent.type === 'city') setSection('dashboard');
    else if (intent.type === 'hospital') setSection('requisitions');
    else if (intent.type === 'req') setSection('requisitions');
  };

  // If a non-admin lands on the admin-only section (e.g. role demotion
  // mid-session), treat the section as if it were 'dashboard'. The backend
  // also enforces this — frontend guard is UX-only.
  const effectiveSection = (section === "users" && me?.role !== "admin")
    ? "dashboard"
    : (section === "inbox" && me?.role === "approver") ? "dashboard" : section;

  return (
    <>
      <GlobalStyle/>
      <div style={{ display:"flex", height:"100vh", background:"#f8fafc", overflow:"hidden" }}>
        <Sidebar active={effectiveSection} onNav={setSection} role={me?.role}/>
        <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
          <Header bu={bu} setBu={setBu} onNavigate={handleNavigate}/>
          <main style={{ flex:1, overflowY:"auto", padding:24 }}>
            {effectiveSection==="dashboard"    && <Dashboard bu={bu} onNav={setSection} setReqFilter={setReqFilter} navIntent={navIntent} clearNavIntent={clearNavIntent}/>}
            {effectiveSection==="inbox"        && <InboxSection/>}
            {effectiveSection==="requisitions" && <Requisitions bu={bu} onNav={setSection} setReqFilter={setReqFilter} setShowNew={setShowNewReq} navIntent={navIntent} clearNavIntent={clearNavIntent}/>}
            {effectiveSection==="pipeline"     && <Pipeline bu={bu} reqFilter={reqFilter} setReqFilter={setReqFilter} navIntent={navIntent} clearNavIntent={clearNavIntent}/>}
            {effectiveSection==="interviews"   && <Interviews bu={bu}/>}
            {effectiveSection==="users"        && me?.role === "admin" && <UserManagement me={me}/>}
          </main>
        </div>
        {showNewReq && <NewReqModal onClose={()=>setShowNewReq(false)}/>}
      </div>
    </>
  );
}

/**
 * In Google mode, gate everything behind a sign-in screen until we have an
 * ID token. Once we have one, hand off to the normal DataProvider+AppShell —
 * /api/me will tell us if we're actually allowlisted (403 if not).
 *
 * In mock mode, this gate is a no-op — the dev switcher takes care of "auth".
 */
function AuthGate({ children }) {
  const [token, setTokenState] = useState(getIdToken());

  // Listen for auth:expired (dispatched by api.js on 401). Drops the user
  // back to the login screen instead of leaving a half-broken app.
  useEffect(() => {
    function onExpired() {
      setIdToken(null);
      setTokenState(null);
    }
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  if (AUTH_MODE !== "google") return children;
  if (token) return children;
  return <Login onAuthed={(_me) => setTokenState(getIdToken())} />;
}

export default function App() {
  return (
    <AuthGate>
      <DataProvider>
        <AppShell/>
      </DataProvider>
    </AuthGate>
  );
}
