import { useState, useMemo, useEffect, Fragment } from "react";
import {
  LayoutDashboard, ClipboardList, Users, BarChart3, CalendarCheck,
  Plus, Search, X, ChevronRight, ChevronDown, Phone, Mail,
  MapPin, Clock, Check, FileText, AlertCircle
} from "lucide-react";
import { DataProvider, useData } from "./DataContext.jsx";
import { api } from "./api.js";

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
  { id:"dashboard",    label:"Dashboard",   icon:LayoutDashboard },
  { id:"requisitions", label:"Requisitions", icon:ClipboardList },
  { id:"pipeline",     label:"Candidates",   icon:Users },
  { id:"headcount",    label:"Headcount",    icon:BarChart3 },
  { id:"interviews",  label:"Interviews",   icon:CalendarCheck },
];

function Sidebar({ active, onNav }) {
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
        {NAV.map(({ id, label, icon:Icon }) => {
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
        <div style={{ width:32, height:32, borderRadius:"50%", background:S.primary, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:12, fontWeight:700, flexShrink:0 }}>AK</div>
        <div>
          <div style={{ color:"#fff", fontSize:12, fontWeight:600 }}>Akhlaque Khan</div>
          <div style={{ color:"rgba(255,255,255,0.4)", fontSize:10 }}>TA Lead</div>
        </div>
      </div>
    </div>
  );
}

/* ─── HEADER ────────────────────────────────────────────────── */
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
        {/* Dev-mode user switcher — replaces with real OAuth session in production */}
        {me && (
          <div style={{ display:"flex", alignItems:"center", gap:8, paddingLeft:12, borderLeft:"1px solid #e2e8f0" }}>
            <span style={{ fontSize:10, fontWeight:700, color:roleBadge.text, background:roleBadge.bg, padding:"3px 8px", borderRadius:99, textTransform:"uppercase", letterSpacing:0.4 }}>
              {me.role}
            </span>
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
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── DASHBOARD ─────────────────────────────────────────────── */
function Dashboard({ bu, onNav, setReqFilter }) {
  const [expandedCity, setExpandedCity] = useState(null);
  const { requisitions: REQUISITIONS, candidates: CANDIDATES, headcount: HEADCOUNT } = useData();
  const reqs = useMemo(() => REQUISITIONS.filter(r => bu === "all" || r.bu === bu), [REQUISITIONS, bu]);
  const cands = useMemo(() => CANDIDATES.filter(c => bu === "all" || c.bu === bu), [CANDIDATES, bu]);
  const hc = useMemo(() => HEADCOUNT.filter(h => bu === "all" || h.bu === bu), [HEADCOUNT, bu]);

  const openPos = reqs.filter(r => r.status !== "Filled").length;
  const joined = cands.filter(c => c.stage === "Joined").length;
  const offered = cands.filter(c => ["Offered","Joined"].includes(c.stage)).length;

  const funnelData = STAGES.map(s => {
    const base = cands.filter(c => c.stage === s).length;
    const extra = { "Sourced":5,"R1 Scheduled":2,"Offered":1,"Joined":1 }[s] || 0;
    return { stage:s, count:base+extra };
  });
  const maxF = Math.max(...funnelData.map(f=>f.count), 1);

  const cities = [...new Set(hc.map(h=>h.city))];
  const cityRows = cities.map(city => {
    const rows = hc.filter(h=>h.city===city);
    return {
      city,
      aop: rows.reduce((s,r)=>s+r.aop,0),
      active: rows.reduce((s,r)=>s+r.active,0),
      open: reqs.filter(r=>r.city===city && r.status!=="Filled").length,
      candidates: cands.filter(c=>c.city===city).length,
    };
  });

  const pendingApprovals = reqs.filter(r=>r.status==="Pending Approval");

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* Stat row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
        <StatCard label="Open Positions"     value={openPos}         sub="Pending + Approved + Active" color={S.primary} />
        <StatCard label="Candidates in Pipe" value={cands.length}    sub="All pipeline stages"          color="#2563eb" />
        <StatCard label="Offers Extended"    value={offered}         sub="Offered or joined"            color="#d97706" />
        <StatCard label="Confirmed Joins"    value={joined}          sub="DOJ confirmed"                color="#059669" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:14 }}>
        {/* Funnel */}
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", padding:22 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#0f172a", marginBottom:18 }}>Hiring Funnel · Current Pipeline</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {funnelData.map(({ stage, count }) => (
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
            {cityRows.map(({ city, aop, active, open, candidates }) => {
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
                    <Td style={{ color:"#374151", fontFamily:"'DM Mono', monospace" }}>{aop}</Td>
                    <Td style={{ color:"#059669", fontWeight:600, fontFamily:"'DM Mono', monospace" }}>{active}</Td>
                    <Td>{open>0 ? <span style={{ color:"#d97706", fontWeight:700, fontFamily:"'DM Mono', monospace" }}>{open}</span> : <span style={{ color:"#cbd5e1" }}>0</span>}</Td>
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
        <button onClick={()=>setShowImport(true)} style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:9, border:"none", cursor:"pointer", background:S.primary, color:"#fff", fontSize:12, fontWeight:600, fontFamily:"'Plus Jakarta Sans', sans-serif" }}>
          <FileText size={13}/> Import from Excel
        </button>
      </div>
      {showImport && <ImportCandidatesModal onClose={()=>setShowImport(false)}/>}

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
    interviewers,
    scheduleInterview,
    recordInterviewResult,
    offerCandidate,
    recordJoin,
  } = useData();
  // Always read the freshest candidate from context so the modal updates
  // after schedule/record-result actions.
  const c = CANDIDATES.find((x) => x.id === cProp.id) || cProp;
  const [tab, setTab] = useState("overview");
  const req = REQUISITIONS.find(r=>r.id===c.reqId);
  const [interviewList, setInterviewList] = useState([]);
  const [actionError, setActionError] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const inp = {
    width:"100%", marginTop:4, fontSize:12, border:"1px solid #e2e8f0", borderRadius:8,
    padding:"8px 10px", outline:"none", fontFamily:"'Plus Jakarta Sans', sans-serif", color:"#374151",
  };

  // Load interview records for this candidate (so we know interview IDs for PATCH).
  const refreshInterviews = async () => {
    try {
      const rows = await api.listInterviews({ candidateId: c.id });
      setInterviewList(rows);
    } catch { /* non-critical for display */ }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refreshInterviews(); }, [c.id]);

  const r1Interview = interviewList.find(i => i.round === 1);
  const r2Interview = interviewList.find(i => i.round === 2);

  // Schedule tab form state (controlled)
  const [schedForm, setSchedForm] = useState({
    round: 1,
    mode: "Virtual",
    interviewerName: "",
    scheduledDate: "",
    scheduledTime: "",
    locationOrLink: "",
  });
  const setSF = (k, v) => setSchedForm(f => ({ ...f, [k]: v }));

  const submitSchedule = async () => {
    setActionError(null);
    if (!schedForm.interviewerName) { setActionError("Please pick an interviewer"); return; }
    if (!schedForm.scheduledDate) { setActionError("Please pick a date"); return; }
    try {
      setActionBusy(true);
      await scheduleInterview({
        candidateId: c.id,
        round: schedForm.round,
        interviewerName: schedForm.interviewerName,
        scheduledDate: schedForm.scheduledDate,
        scheduledTime: schedForm.scheduledTime || null,
        mode: schedForm.mode,
        locationOrLink: schedForm.locationOrLink || null,
      });
      await refreshInterviews();
      setTab("interviews");
    } catch (err) {
      setActionError(err.message || "Failed to schedule");
    } finally {
      setActionBusy(false);
    }
  };

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
                { round:"Round 1", interview:r1Interview, by:c.r1By, date:c.r1Date, result:c.r1Result },
                { round:"Round 2", interview:r2Interview, by:c.r2By, date:c.r2Date, result:c.r2Result },
              ].map(({ round, interview, by, date, result }) => (
                <div key={round} style={{ border:"1px solid #e2e8f0", borderRadius:12, padding:16 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>{round}</div>
                    {result && <span style={{ fontSize:12, fontWeight:700, color:result==="Select"?"#059669":"#dc2626", background:result==="Select"?"#d1fae5":"#fee2e2", padding:"3px 10px", borderRadius:99 }}>{result}</span>}
                    {!result && by && <span style={{ fontSize:11, color:"#94a3b8" }}>Pending result</span>}
                    {!by && <span style={{ fontSize:11, color:"#cbd5e1" }}>Not scheduled</span>}
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
                    <div style={{ display:"flex", gap:8, marginTop:12 }}>
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
                    </div>
                  )}
                </div>
              ))}
              {actionError && (
                <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:9, padding:"10px 12px", fontSize:11, color:"#991b1b" }}>
                  {actionError}
                </div>
              )}
            </div>
          )}

          {tab==="schedule" && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ fontSize:12, color:"#64748b" }}>
                Check interviewer availability in Google Calendar, then record the agreed slot here. The tool updates the candidate&apos;s stage automatically.
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Round</label>
                  <select value={schedForm.round} onChange={e=>setSF("round", Number(e.target.value))} style={inp}>
                    <option value={1}>Round 1</option>
                    <option value={2}>Round 2</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Mode</label>
                  <select value={schedForm.mode} onChange={e=>setSF("mode", e.target.value)} style={inp}>
                    <option value="Virtual">Virtual</option>
                    <option value="In-Person">In-Person (F2F)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Interviewer</label>
                  <select value={schedForm.interviewerName} onChange={e=>setSF("interviewerName", e.target.value)} style={inp}>
                    <option value="">Select interviewer…</option>
                    {interviewers.filter(i => i.round === schedForm.round).map(i=>(
                      <option key={i.name} value={i.name}>{i.name}{i.city?` · ${i.city}`:""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Date</label>
                  <input type="date" value={schedForm.scheduledDate} onChange={e=>setSF("scheduledDate", e.target.value)} style={inp}/>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Time Slot</label>
                  <input type="time" value={schedForm.scheduledTime} onChange={e=>setSF("scheduledTime", e.target.value)} style={inp}/>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Location / Link</label>
                  <input type="text" value={schedForm.locationOrLink} onChange={e=>setSF("locationOrLink", e.target.value)} placeholder="Google Meet link or address" style={inp}/>
                </div>
              </div>
              {actionError && (
                <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:9, padding:"10px 12px", fontSize:11, color:"#991b1b" }}>
                  {actionError}
                </div>
              )}
              <button
                onClick={submitSchedule}
                disabled={actionBusy}
                style={{ width:"100%", padding:"10px", borderRadius:9, border:"none", cursor:actionBusy?"not-allowed":"pointer", background:S.primary, color:"#fff", fontSize:13, fontWeight:600, fontFamily:"'Plus Jakarta Sans', sans-serif", marginTop:4, opacity:actionBusy?0.7:1 }}
              >
                {actionBusy?"Saving…":"Save Interview Schedule"}
              </button>
            </div>
          )}

          {tab==="documents" && (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <div style={{ fontSize:12, color:"#64748b", marginBottom:4 }}>Documents are stored in Google Drive. Upload to link them here.</div>
              {["Resume / CV","Motivation Letter","Offer Letter","ID Proof (Aadhaar)","Previous Org Relieving Letter","Appointment Letter"].map(doc=>(
                <div key={doc} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 14px", border:"1px solid #e2e8f0", borderRadius:10 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <FileText size={14} color="#94a3b8"/>
                    <span style={{ fontSize:12, fontWeight:500, color:"#374151" }}>{doc}</span>
                  </div>
                  <button style={{ fontSize:11, fontWeight:600, color:S.primary, background:"transparent", border:`1px solid ${S.primary}40`, borderRadius:7, padding:"4px 10px", cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif" }}>
                    Upload to Drive
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
                Expected columns (case-insensitive, flexible names): Name, Phone, Email, City, Current Role, Company, Current CTC, Expected CTC, Notice, Req ID, BU, TA.
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

/* ─── INTERVIEW SCHEDULES ──────────────────────────────────── */
function Interviews({ bu }) {
  const { requisitions: REQUISITIONS, candidates: CANDIDATES } = useData();
  const events = useMemo(() => {
    const list = [];
    CANDIDATES.filter(c => bu === "all" || c.bu === bu).forEach(c => {
      const req = REQUISITIONS.find(r => r.id === c.reqId);
      const reqLabel = req ? `${req.id} · ${req.hospital || req.city}` : c.reqId;
      if (c.r1Date) list.push({
        date:c.r1Date, round:"R1", name:c.name, city:c.city, company:c.company,
        interviewer:c.r1By, result:c.r1Result, reqLabel, bu:c.bu,
        stage: c.r1Result ? "complete" : "scheduled",
      });
      if (c.r2Date) list.push({
        date:c.r2Date, round:"R2", name:c.name, city:c.city, company:c.company,
        interviewer:c.r2By, result:c.r2Result, reqLabel, bu:c.bu,
        stage: c.r2Result ? "complete" : "scheduled",
      });
    });
    list.sort((a, b) => b.date.localeCompare(a.date));
    return list;
  }, [REQUISITIONS, CANDIDATES, bu]);

  const scheduled = events.filter(e => e.stage === "scheduled");
  const completed = events.filter(e => e.stage === "complete");

  const renderEvent = (e, i) => (
    <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"12px 0", borderBottom:"1px solid #f8fafc" }}>
      <div style={{
        width:36, height:36, borderRadius:10, flexShrink:0,
        background: e.stage === "scheduled" ? "#eff6ff" : e.result === "Select" ? "#d1fae5" : "#fee2e2",
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        {e.stage === "scheduled" ? <CalendarCheck size={15} color="#2563eb" /> : <Check size={15} color={e.result === "Select" ? "#059669" : "#dc2626"} />}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>{e.round} — {e.name}</span>
          {e.result && (
            <span style={{ fontSize:10, fontWeight:700, color:e.result === "Select" ? "#059669" : "#dc2626", background:e.result === "Select" ? "#d1fae5" : "#fee2e2", padding:"1px 7px", borderRadius:99 }}>{e.result}</span>
          )}
        </div>
        <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>{e.company} · {e.city} · {e.reqLabel}</div>
        <div style={{ display:"flex", gap:12, marginTop:4 }}>
          <span style={{ fontSize:11, color:"#374151" }}>Interviewer: <strong>{e.interviewer || "TBD"}</strong></span>
          <span style={{ fontSize:11, color:"#94a3b8", fontFamily:"'DM Mono', monospace" }}>{e.date}</span>
        </div>
      </div>
      <BUBadge bu={e.bu} />
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", padding:"20px 22px" }}>
          <div style={{ fontSize:32, fontWeight:800, color:"#2563eb", fontFamily:"'DM Mono', monospace" }}>{scheduled.length}</div>
          <div style={{ fontSize:13, fontWeight:600, color:"#374151", marginTop:4 }}>Upcoming</div>
          <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>Interviews scheduled</div>
        </div>
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", padding:"20px 22px" }}>
          <div style={{ fontSize:32, fontWeight:800, color:"#059669", fontFamily:"'DM Mono', monospace" }}>{completed.filter(e=>e.result==="Select").length}</div>
          <div style={{ fontSize:13, fontWeight:600, color:"#374151", marginTop:4 }}>Selected</div>
          <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>Passed interviews</div>
        </div>
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", padding:"20px 22px" }}>
          <div style={{ fontSize:32, fontWeight:800, color:"#374151", fontFamily:"'DM Mono', monospace" }}>{completed.length}</div>
          <div style={{ fontSize:13, fontWeight:600, color:"#374151", marginTop:4 }}>Completed</div>
          <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>Total interviews done</div>
        </div>
      </div>

      {/* Upcoming */}
      {scheduled.length > 0 && (
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", overflow:"hidden" }}>
          <div style={{ padding:"16px 20px", borderBottom:"1px solid #f1f5f9" }}>
            <span style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>Upcoming Interviews</span>
            <span style={{ marginLeft:8, fontSize:10, fontWeight:700, background:"#eff6ff", color:"#2563eb", padding:"2px 8px", borderRadius:99 }}>{scheduled.length}</span>
          </div>
          <div style={{ padding:"4px 20px" }}>{scheduled.map(renderEvent)}</div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", overflow:"hidden" }}>
          <div style={{ padding:"16px 20px", borderBottom:"1px solid #f1f5f9" }}>
            <span style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>Completed Interviews</span>
            <span style={{ marginLeft:8, fontSize:10, fontWeight:700, background:"#f1f5f9", color:"#64748b", padding:"2px 8px", borderRadius:99 }}>{completed.length}</span>
          </div>
          <div style={{ padding:"4px 20px" }}>{completed.map(renderEvent)}</div>
        </div>
      )}
    </div>
  );
}

/* ─── APP ───────────────────────────────────────────────────── */
function AppShell() {
  const [section, setSection] = useState("dashboard");
  const [bu, setBu] = useState("all");
  const [reqFilter, setReqFilter] = useState("all");
  const [showNewReq, setShowNewReq] = useState(false);

  return (
    <>
      <GlobalStyle/>
      <div style={{ display:"flex", height:"100vh", background:"#f8fafc", overflow:"hidden" }}>
        <Sidebar active={section} onNav={setSection}/>
        <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
          <Header bu={bu} setBu={setBu}/>
          <main style={{ flex:1, overflowY:"auto", padding:24 }}>
            {section==="dashboard"    && <Dashboard bu={bu} onNav={setSection} setReqFilter={setReqFilter}/>}
            {section==="requisitions" && <Requisitions bu={bu} onNav={setSection} setReqFilter={setReqFilter} setShowNew={setShowNewReq}/>}
            {section==="pipeline"     && <Pipeline bu={bu} reqFilter={reqFilter} setReqFilter={setReqFilter}/>}
            {section==="headcount"    && <Headcount bu={bu}/>}
            {section==="interviews"  && <Interviews bu={bu}/>}
          </main>
        </div>
        {showNewReq && <NewReqModal onClose={()=>setShowNewReq(false)}/>}
      </div>
    </>
  );
}

export default function App() {
  return (
    <DataProvider>
      <AppShell/>
    </DataProvider>
  );
}
