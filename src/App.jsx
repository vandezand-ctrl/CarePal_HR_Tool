import { useState, useMemo, useEffect, Fragment } from "react";
import {
  LayoutDashboard, ClipboardList, Users, BarChart3, CalendarCheck,
  Plus, Search, X, ChevronRight, ChevronDown, Phone, Mail,
  MapPin, Clock, Check, FileText, AlertCircle, Shield
} from "lucide-react";
import { DataProvider, useData } from "./DataContext.jsx";
import { api, AUTH_MODE, setIdToken, getIdToken } from "./api.js";
import Login from "./Login.jsx";
import UserManagement from "./UserManagement.jsx";
import ScheduleInterviewModal from "./ScheduleInterviewModal.jsx";
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

const STAGES = ["Sourced","R1 Scheduled","R1 Complete","R2 Scheduled","R2 Complete","Offered","Joined"];

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
  { id:"requisitions", label:"Requisitions", icon:ClipboardList },
  { id:"pipeline",     label:"Candidates",   icon:Users },
  { id:"headcount",    label:"Headcount",    icon:BarChart3 },
  { id:"interviews",   label:"Interviews",   icon:CalendarCheck },
  // adminOnly entries are filtered out in the Sidebar render based on req.user.role.
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

function Sidebar({ active, onNav, role }) {
  const items = NAV.filter(n => !n.adminOnly || role === 'admin');
  // Use the actual signed-in user instead of the hardcoded "Akhlaque Khan" placeholder.
  const { me } = useData();
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
              {label}
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

function Header({ bu, setBu }) {
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
        <div style={{ position:"relative" }}>
          <Search size={13} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#94a3b8" }} />
          <input placeholder="Search candidates, cities…" style={{ paddingLeft:30, paddingRight:12, paddingTop:7, paddingBottom:7, fontSize:12, border:"1px solid #e2e8f0", borderRadius:8, width:220, outline:"none", fontFamily:"'Plus Jakarta Sans', sans-serif", color:"#374151" }} />
        </div>
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
function Dashboard({ bu, onNav, setReqFilter }) {
  const [expandedCity, setExpandedCity] = useState(null);
  const { requisitions: REQUISITIONS, candidates: CANDIDATES } = useData();

  // Server-side aggregation — one request, authoritative numbers.
  const [dash, setDash] = useState(null);
  const [dashError, setDashError] = useState(null);
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
  }, [bu, REQUISITIONS, CANDIDATES]);

  if (dashError) return <div style={{ padding:24, color:"#dc2626", fontSize:13 }}>Dashboard error: {dashError}</div>;
  if (!dash) return <div style={{ padding:24, color:"#64748b", fontSize:13 }}>Loading dashboard…</div>;

  const { totals, funnel, pendingApprovals, cityBreakdown: cityRows } = dash;
  const maxF = Math.max(...funnel.map(f => f.count), 1);
  // reqs used by the expandable city rows (lookup by city for hospital detail)
  const reqs = REQUISITIONS.filter(r => bu === "all" || r.bu === bu);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* Stat row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
        <StatCard label="Open Positions"     value={totals.openPositions}    sub="Pending + Approved + Active" color={S.primary} />
        <StatCard label="Candidates in Pipe" value={totals.candidatesInPipe} sub="Not yet offered"             color="#2563eb" />
        <StatCard label="Offers Extended"    value={totals.offersExtended}   sub="Offered or joined"           color="#d97706" />
        <StatCard label="Confirmed Joins"    value={totals.confirmedJoins}   sub="DOJ confirmed"               color="#059669" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:14 }}>
        {/* Funnel */}
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", padding:22 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#0f172a", marginBottom:18 }}>Hiring Funnel · Current Pipeline</div>
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

        {/* Pending approvals */}
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
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div style={{ fontSize:12, fontWeight:600, color:"#1e293b" }}>{r.city} · {r.bdType} BD</div>
                    <BUBadge bu={r.bu} />
                  </div>
                  <div style={{ fontSize:11, color:"#64748b", marginTop:3 }}>{r.hospital || "Hospital TBD"}</div>
                  <div style={{ fontSize:11, color:"#92400e", marginTop:4 }}>{r.hireType} hire · {r.raisedBy}</div>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* City table */}
      <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", overflow:"hidden" }}>
        <div style={{ padding:"16px 20px", borderBottom:"1px solid #f1f5f9" }}>
          <span style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>City Summary</span>
        </div>
        <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:440 }}>
          <thead style={{ background:"#f8fafc" }}>
            <tr>{["City","Target HC","Active HC","Open","In Pipeline"].map(h=><Th key={h}>{h}</Th>)}</tr>
          </thead>
          <tbody>
            {cityRows.map(({ city, aopTotal, activeTotal, openReqs, candidates }) => {
              const isExpanded = expandedCity === city;
              const cityReqs = reqs.filter(r=>r.city===city && r.status!=="Filled");
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
                    <Td style={{ color:"#374151", fontFamily:"'DM Mono', monospace" }}>{aopTotal}</Td>
                    <Td style={{ color:"#059669", fontWeight:600, fontFamily:"'DM Mono', monospace" }}>{activeTotal}</Td>
                    <Td>{openReqs>0 ? <span style={{ color:"#d97706", fontWeight:700, fontFamily:"'DM Mono', monospace" }}>{openReqs}</span> : <span style={{ color:"#cbd5e1" }}>0</span>}</Td>
                    <Td style={{ color:"#64748b", fontFamily:"'DM Mono', monospace" }}>{candidates}</Td>
                  </tr>
                  {isExpanded && cityReqs.length > 0 && cityReqs.map(r=>(
                    <tr key={r.id} style={{ background:"#fafafa" }}>
                      <Td style={{ paddingLeft:36, color:"#64748b", fontSize:12 }}>{r.hospital||r.area||"—"}</Td>
                      <Td style={{ fontSize:11, color:"#94a3b8" }}>{r.bdType} BD</Td>
                      <Td style={{ fontSize:11, color:"#94a3b8" }}><BUBadge bu={r.bu}/></Td>
                      <Td style={{ fontSize:11, color:"#94a3b8" }}>{r.hireType}</Td>
                      <Td><StatusBadge status={r.status}/></Td>
                    </tr>
                  ))}
                  {isExpanded && cityReqs.length === 0 && (
                    <tr style={{ background:"#fafafa" }}>
                      <Td style={{ paddingLeft:36, color:"#94a3b8", fontSize:12 }} colSpan="5">No open requisitions</Td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

/* ─── REQUISITIONS ──────────────────────────────────────────── */
function Requisitions({ bu, onNav, setReqFilter, setShowNew }) {
  const { requisitions: REQUISITIONS, candidates: CANDIDATES, loading, error, me, updateRequisition } = useData();
  const canApprove = me && (me.role === 'approver' || me.role === 'admin');
  const [statusF, setStatusF] = useState("all");
  const [cityF, setCityF] = useState("all");
  const [hospitalF, setHospitalF] = useState("all");
  const [selected, setSelected] = useState(null);
  const [actionError, setActionError] = useState(null);

  const approveSelected = async () => {
    if (!selected) return;
    setActionError(null);
    try {
      const updated = await updateRequisition(selected.id, { status: 'Approved' });
      setSelected(updated); // refresh the slide-out panel
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
        {canApprove && (
        <button onClick={()=>setShowNew(true)} style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:9, border:"none", cursor:"pointer", background:S.primary, color:"#fff", fontSize:12, fontWeight:600, fontFamily:"'Plus Jakarta Sans', sans-serif" }}>
          <Plus size={13}/> New Requisition
        </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead style={{ background:"#f8fafc", borderBottom:"1px solid #e2e8f0" }}>
            <tr>{["ID","City","Hospital / Area","BD Type","BU","Hire Type","Replacing","Raised By","Date","Status",""].map(h=><Th key={h}>{h}</Th>)}</tr>
          </thead>
          <tbody>
            {reqs.map(r=>(
              <tr key={r.id} style={{ cursor:"pointer" }}
                onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                onClick={()=>setSelected(r)}>
                <Td style={{ color:S.primary, fontWeight:700, fontSize:12 }}>{r.id}</Td>
                <Td style={{ fontWeight:600, color:"#0f172a" }}>{r.city}</Td>
                <Td style={{ color:"#64748b", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={`${r.hospital||""} · ${r.area||""}`}>{r.hospital||"—"}</Td>
                <Td style={{ color:"#374151" }}>{r.bdType}</Td>
                <Td><BUBadge bu={r.bu}/></Td>
                <Td style={{ color:"#374151" }}>{r.hireType}</Td>
                <Td style={{ color:"#64748b" }}>{r.replacementFor||"—"}</Td>
                <Td style={{ color:"#64748b", fontSize:11 }}>{r.raisedBy}</Td>
                <Td style={{ color:"#94a3b8", fontSize:11, fontFamily:"'DM Mono', monospace" }}>{r.date}</Td>
                <Td><StatusBadge status={r.status}/></Td>
                <Td>
                  <button style={{ background:"none", border:"none", cursor:"pointer", color:S.primary }}
                    onClick={e=>{e.stopPropagation();setReqFilter(r.id);onNav("pipeline");}}>
                    <ChevronRight size={14}/>
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
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

            {/* Approval flow */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10 }}>Approval Flow</div>
              {[
                { label:"Requisition Raised", by:selected.raisedBy, date:selected.date, done:true },
                { label:"Manager Approval", by:selected.status==="Pending Approval"?"Awaiting...":"Approved", done:selected.status!=="Pending Approval" },
                { label:"HR Notified & Active", by:["Active","Filled"].includes(selected.status)?"Notified":"Pending", done:["Active","Filled"].includes(selected.status) },
              ].map(({ label, by, date, done }) => (
                <div key={label} style={{ display:"flex", gap:10, marginBottom:10 }}>
                  <div style={{ width:20, height:20, borderRadius:"50%", background:done?"#d1fae5":"#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                    {done ? <Check size={10} color="#059669"/> : <Clock size={10} color="#94a3b8"/>}
                  </div>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:"#0f172a" }}>{label}</div>
                    <div style={{ fontSize:11, color:"#64748b" }}>{by}{date?` · ${date}`:""}</div>
                  </div>
                </div>
              ))}
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
                      <div style={{ fontSize:11, color:"#64748b" }}>{c.ta} · {c.sourced}</div>
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
              {canApprove && selected.status === "Pending Approval" && (
                <button
                  onClick={approveSelected}
                  style={{ width:"100%", padding:"10px", borderRadius:9, border:"none", background:"#059669", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif" }}
                >
                  ✓ Approve Requisition
                </button>
              )}
              <button style={{ width:"100%", padding:"10px", borderRadius:9, border:`1px solid ${S.primary}`, background:"transparent", color:S.primary, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif" }}
                onClick={()=>{setReqFilter(selected.id);onNav("pipeline");setSelected(null);}}>
                View Full Pipeline →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── PIPELINE ──────────────────────────────────────────────── */
function Pipeline({ bu, reqFilter, setReqFilter }) {
  const { requisitions: REQUISITIONS, candidates: CANDIDATES } = useData();
  const [view, setView] = useState("kanban");
  const [selectedC, setSelectedC] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const cands = useMemo(() => CANDIDATES.filter(c =>
    (bu==="all"||c.bu===bu) && (reqFilter==="all"||c.reqId===reqFilter)
  ), [CANDIDATES, bu, reqFilter]);

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
                      <div style={{ fontSize:10, color:"#94a3b8", marginTop:3 }}>TA: {c.ta}</div>
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
              <tr>{["Name","City","Company","Curr CTC","Exp CTC","Notice","TA","Stage","R1","R2",""].map(h=><Th key={h}>{h}</Th>)}</tr>
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
                  <Td style={{ color:"#64748b" }}>{c.ta}</Td>
                  <Td><StageBadge stage={c.stage}/></Td>
                  <Td>{c.r1Result ? <span style={{ fontSize:11, fontWeight:600, color:c.r1Result==="Select"?"#059669":"#dc2626" }}>{c.r1Result}</span> : <span style={{ color:"#cbd5e1" }}>—</span>}</Td>
                  <Td>{c.r2Result ? <span style={{ fontSize:11, fontWeight:600, color:c.r2Result==="Select"?"#059669":"#dc2626" }}>{c.r2Result}</span> : <span style={{ color:"#cbd5e1" }}>—</span>}</Td>
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
    requisitions: REQUISITIONS,
    candidates: CANDIDATES,
    recordInterviewResult,
    cancelInterview,
    offerCandidate,
    recordJoin,
  } = useData();
  // Always read the freshest candidate from context so the modal updates
  // after schedule/record-result actions.
  const c = CANDIDATES.find((x) => x.id === cProp.id) || cProp;
  const [tab, setTab] = useState("overview");
  const req = REQUISITIONS.find(r=>r.id===c.reqId);
  const [interviewList, setInterviewList] = useState([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

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

  const canOffer = c.stage === "R1 Complete" || c.stage === "R2 Complete";
  const canJoin = c.stage === "Offered";

  return (
    <div style={{ position:"fixed", inset:0, zIndex:60, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:18, width:620, maxHeight:"88vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.18)" }} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding:"22px 24px 16px", borderBottom:"1px solid #f1f5f9" }}>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:20, fontWeight:800, color:"#0f172a" }}>{c.name}</div>
              <div style={{ fontSize:13, color:"#64748b", marginTop:2 }}>{c.currentRole} · {c.company}</div>
              <div style={{ display:"flex", gap:6, marginTop:8 }}>
                <StageBadge stage={c.stage}/>
                <BUBadge bu={c.bu}/>
                {req && <span style={{ fontSize:11, color:"#94a3b8", padding:"2px 0" }}>{req.id}</span>}
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
                  { l:"TA Assigned", v:c.ta },
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
                        <button
                          onClick={()=>cancelScheduled(interview)}
                          disabled={actionBusy}
                          title="Cancel this interview (reverts candidate stage)"
                          style={{ padding:"8px 10px", borderRadius:8, border:"1px solid #e2e8f0", background:"#fff", color:"#64748b", fontSize:12, fontWeight:600, cursor:actionBusy?"not-allowed":"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", opacity:actionBusy?0.6:1 }}
                        >Cancel</button>
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
    </div>
  );
}

/* ─── HEADCOUNT ─────────────────────────────────────────────── */
function Headcount({ bu }) {
  const { headcount: HEADCOUNT } = useData();
  const rows = useMemo(() => {
    const filtered = HEADCOUNT.filter(h=>bu==="all"||h.bu===bu);
    if (bu!=="all") return filtered.map(h=>({ ...h, deficit:h.aop-h.active }));
    const cities = [...new Set(filtered.map(h=>h.city))];
    return cities.map(city=>{
      const cr = filtered.filter(h=>h.city===city);
      const aop=cr.reduce((s,r)=>s+r.aop,0), active=cr.reduce((s,r)=>s+r.active,0);
      const notice=cr.reduce((s,r)=>s+r.notice,0), pip=cr.reduce((s,r)=>s+r.pip,0);
      const training=cr.reduce((s,r)=>s+r.training,0), offered=cr.reduce((s,r)=>s+r.offered,0);
      return { city, bu:"all", aop, active, notice, pip, training, offered, deficit:aop-active };
    });
  }, [HEADCOUNT, bu]);

  const tot = { aop:0,active:0,notice:0,pip:0,training:0,offered:0,deficit:0 };
  rows.forEach(r=>{ tot.aop+=r.aop;tot.active+=r.active;tot.notice+=r.notice;tot.pip+=r.pip;tot.training+=r.training;tot.offered+=r.offered;tot.deficit+=r.deficit; });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
        <StatCard label="Target Headcount" value={tot.aop}               sub="Approved positions total"  color="#0f172a" />
        <StatCard label="Active Headcount" value={tot.active}            sub="Deployed & productive"  color="#059669" />
        <StatCard label="At Risk (Notice+PIP)" value={tot.notice+tot.pip} sub="Potential vacancies"   color="#d97706" />
        <StatCard label="Net Deficit"      value={tot.deficit}           sub="Roles to be filled"     color={tot.deficit>0?"#dc2626":"#059669"} />
      </div>

      <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", overflow:"hidden" }}>
        <div style={{ padding:"16px 20px", borderBottom:"1px solid #f1f5f9", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>Headcount by City {bu!=="all"?`· ${bu}`:""}</span>
          <span style={{ fontSize:11, color:"#94a3b8" }}>Deficit = Target HC − Active</span>
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead style={{ background:"#f8fafc", borderBottom:"1px solid #e2e8f0" }}>
            <tr>{["City","BU","Target HC","Active","On Notice","PIP","In Training","Offered","Deficit"].map(h=><Th key={h}>{h}</Th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i} onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <Td style={{ fontWeight:600, color:"#0f172a" }}>{r.city}</Td>
                <Td>{r.bu==="all"?<span style={{ color:"#94a3b8",fontSize:11 }}>All</span>:<BUBadge bu={r.bu}/>}</Td>
                <Td style={{ fontFamily:"'DM Mono', monospace", color:"#374151" }}>{r.aop}</Td>
                <Td style={{ fontFamily:"'DM Mono', monospace", color:"#059669", fontWeight:700 }}>{r.active}</Td>
                <Td style={{ fontFamily:"'DM Mono', monospace", color:r.notice>0?"#d97706":"#94a3b8" }}>{r.notice}</Td>
                <Td style={{ fontFamily:"'DM Mono', monospace", color:r.pip>0?"#dc2626":"#94a3b8" }}>{r.pip}</Td>
                <Td style={{ fontFamily:"'DM Mono', monospace", color:r.training>0?"#2563eb":"#94a3b8" }}>{r.training}</Td>
                <Td style={{ fontFamily:"'DM Mono', monospace", color:"#64748b" }}>{r.offered}</Td>
                <Td><span style={{ fontFamily:"'DM Mono', monospace", fontWeight:800, color:r.deficit>0?"#dc2626":r.deficit<0?"#059669":"#94a3b8" }}>{r.deficit>0?`+${r.deficit}`:r.deficit}</span></Td>
              </tr>
            ))}
          </tbody>
          <tfoot style={{ borderTop:"2px solid #e2e8f0", background:"#f8fafc" }}>
            <tr>
              <Td style={{ fontWeight:800, color:"#0f172a" }} colSpan="2">Total</Td>
              <Td style={{ fontFamily:"'DM Mono', monospace", fontWeight:700, color:"#374151" }}>{tot.aop}</Td>
              <Td style={{ fontFamily:"'DM Mono', monospace", fontWeight:700, color:"#059669" }}>{tot.active}</Td>
              <Td style={{ fontFamily:"'DM Mono', monospace", fontWeight:700, color:"#d97706" }}>{tot.notice}</Td>
              <Td style={{ fontFamily:"'DM Mono', monospace", fontWeight:700, color:"#dc2626" }}>{tot.pip}</Td>
              <Td style={{ fontFamily:"'DM Mono', monospace", fontWeight:700, color:"#2563eb" }}>{tot.training}</Td>
              <Td style={{ fontFamily:"'DM Mono', monospace", fontWeight:700, color:"#374151" }}>{tot.offered}</Td>
              <Td><span style={{ fontFamily:"'DM Mono', monospace", fontWeight:800, color:tot.deficit>0?"#dc2626":"#059669" }}>{tot.deficit>0?`+${tot.deficit}`:tot.deficit}</span></Td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ─── NEW REQ MODAL ─────────────────────────────────────────── */
function NewReqModal({ onClose }) {
  const { createRequisition } = useData();
  const [form, setForm] = useState({ bu:"CPM", hireType:"New", city:"", bdType:"Focus", hospital:"", area:"", replacementFor:"", notes:"" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const submit = async () => {
    setSubmitError(null);
    // Simple client-side validation
    if (!form.city) { setSubmitError("City is required"); return; }
    if (form.bdType === "Focus" && !form.hospital.trim()) { setSubmitError("Hospital name is required for Focus BD"); return; }
    if (form.hireType === "Replacement" && !form.replacementFor.trim()) { setSubmitError("Replacing BD name is required"); return; }

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
      setSubmitError(err.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };
  const inp = { width:"100%", marginTop:4, fontSize:12, border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 10px", outline:"none", fontFamily:"'Plus Jakarta Sans', sans-serif", color:"#374151" };

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
              <select value={form.city} onChange={e=>set("city",e.target.value)} style={inp}>
                <option value="">Select city…</option>
                {["Ahmedabad","Bangalore","Bhubaneswar","Chennai","Delhi","Hyderabad","Indore","Kochi","Kolkata","Mumbai","Pune"].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
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
              <input value={form.hospital} onChange={e=>set("hospital",e.target.value)} placeholder="e.g. Apollo Greams Road" style={inp}/>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>{form.bdType==="Floater"?"Areas to Cover":"Area / Zone"}</label>
              <input value={form.area} onChange={e=>set("area",e.target.value)} placeholder="e.g. Andheri West" style={inp}/>
            </div>
            {form.hireType==="Replacement" && (
              <div style={{ gridColumn:"1/-1" }}>
                <label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Replacing BD Name *</label>
                <input value={form.replacementFor} onChange={e=>set("replacementFor",e.target.value)} placeholder="Full name of the BD being replaced" style={inp}/>
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Additional Requirements</label>
            <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={3} placeholder="e.g. Female candidate preferred, must have lending background…" style={{ ...inp, resize:"none" }}/>
          </div>
          <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:9, padding:"10px 12px", fontSize:11, color:"#92400e", display:"flex", gap:6, alignItems:"flex-start" }}>
            <AlertCircle size={13} style={{ flexShrink:0, marginTop:1 }}/>
            This requisition will be routed to the appropriate manager for approval before it becomes active.
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
function NewCandidateModal({ onClose, defaultReqId = null, defaultBu = null }) {
  const { requisitions: REQUISITIONS, createCandidate, me } = useData();
  const ROLE_TA = 'ta';
  const [form, setForm] = useState({
    reqId: defaultReqId || '',
    name: '',
    phone: '',
    email: '',
    city: '',
    currentRole: '',
    company: '',
    currentCTC: '',
    expectedCTC: '',
    notice: '',
    bu: defaultBu || '',
    ta: me?.role === ROLE_TA ? (me.name || '') : '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Only show requisitions that can accept candidates (Approved or Active —
  // not Pending Approval or Filled). Pending Approval would be premature;
  // Filled means the position is done.
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
    if (!form.ta.trim()) { setSubmitError('TA recruiter name is required'); return; }

    // Optional numbers: empty -> null, otherwise parse. Backend rejects 0/negative.
    const toIntOrNull = (v) => {
      const s = String(v).replace(/[,\s]/g, '');
      if (!s) return null;
      const n = Number(s);
      return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    };

    try {
      setSubmitting(true);
      await createCandidate({
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
        ta: form.ta.trim(),
        bu: form.bu,
      });
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
          <div style={{ fontSize:17, fontWeight:800, color:"#0f172a" }}>Add Candidate</div>
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
              <input value={form.ta} onChange={e=>set("ta",e.target.value)} placeholder="e.g. Akhlaque" style={inp}/>
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
          <button onClick={submit} disabled={submitting || eligibleReqs.length === 0} style={{ padding:"9px 18px", borderRadius:9, border:"none", background:S.primary, color:"#fff", fontSize:12, fontWeight:600, cursor:(submitting || eligibleReqs.length === 0)?"not-allowed":"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", opacity:(submitting || eligibleReqs.length === 0)?0.7:1 }}>{submitting?"Adding…":"Add Candidate"}</button>
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
    requisitions: REQUISITIONS,
    candidates: CANDIDATES,
    interviewers,
    cancelInterview,
    recordInterviewResult,
  } = useData();

  // Filter state
  const [roundF, setRoundF] = useState('all');         // 'all' | 1 | 2
  const [outcomeF, setOutcomeF] = useState('all');     // 'all' | 'Scheduled' | 'Select' | 'Reject' | 'No-show'
  const [interviewerF, setInterviewerF] = useState('all');
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
  // Also apply the BU filter from the global header (server doesn't know about it).
  const enrichedRows = useMemo(() => {
    return rows
      .map(iv => {
        const cand = CANDIDATES.find(c => c.id === iv.candidateId);
        const req = cand ? REQUISITIONS.find(r => r.id === cand.reqId) : null;
        return { iv, cand, req };
      })
      .filter(({ cand }) => bu === 'all' || (cand && cand.bu === bu));
  }, [rows, CANDIDATES, REQUISITIONS, bu]);

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
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <KpiCard value={kpis.upcoming} label="Upcoming" sub="Interviews scheduled" color="#2563eb" />
        <KpiCard value={kpis.selected} label="Selected" sub="Passed" color="#059669" />
        <KpiCard value={kpis.rejected} label="Rejected" sub="Failed" color="#dc2626" />
        <KpiCard value={kpis.noShow} label="No-show" sub="Did not attend" color="#d97706" />
      </div>

      {/* Filters bar + Schedule button */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
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
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{cand?.name || iv.candidateId}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{cand?.city || ''}{cand?.company ? ` · ${cand.company}` : ''}</div>
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
                          {!iv.result && (
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

/* ─── APP ───────────────────────────────────────────────────── */
function AppShell() {
  const [section, setSection] = useState("dashboard");
  const [bu, setBu] = useState("all");
  const [reqFilter, setReqFilter] = useState("all");
  const [showNewReq, setShowNewReq] = useState(false);
  const { me } = useData();

  // If a non-admin lands on the admin-only section (e.g. role demotion
  // mid-session), treat the section as if it were 'dashboard'. The backend
  // also enforces this — frontend guard is UX-only.
  const effectiveSection = (section === "users" && me?.role !== "admin")
    ? "dashboard"
    : section;

  return (
    <>
      <GlobalStyle/>
      <div style={{ display:"flex", height:"100vh", background:"#f8fafc", overflow:"hidden" }}>
        <Sidebar active={effectiveSection} onNav={setSection} role={me?.role}/>
        <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
          <Header bu={bu} setBu={setBu}/>
          <main style={{ flex:1, overflowY:"auto", padding:24 }}>
            {effectiveSection==="dashboard"    && <Dashboard bu={bu} onNav={setSection} setReqFilter={setReqFilter}/>}
            {effectiveSection==="requisitions" && <Requisitions bu={bu} onNav={setSection} setReqFilter={setReqFilter} setShowNew={setShowNewReq}/>}
            {effectiveSection==="pipeline"     && <Pipeline bu={bu} reqFilter={reqFilter} setReqFilter={setReqFilter}/>}
            {effectiveSection==="headcount"    && <Headcount bu={bu}/>}
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
