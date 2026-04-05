import { useState, useMemo } from "react";
import {
  LayoutDashboard, ClipboardList, Users, BarChart3,
  Plus, Search, X, ChevronRight, Phone, Mail,
  MapPin, Clock, Check, FileText, AlertCircle
} from "lucide-react";

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
const REQUISITIONS = [
  { id:"REQ-001", city:"Bangalore", hospital:"Sakra & Kauvery", area:"Marathahalli & Whitefield", bdType:"Floater", bu:"CPM", hireType:"Replacement", replacementFor:"Poojashree", raisedBy:"Soundappan Gopal", date:"2026-03-26", status:"Approved", notes:"Lending background required" },
  { id:"REQ-002", city:"Chennai", hospital:"Apollo Greams Road", area:"Greams Road", bdType:"Focus", bu:"CPM", hireType:"Replacement", replacementFor:"Abdul Aziz", raisedBy:"Soundappan Gopal", date:"2026-03-26", status:"Active", notes:"Lending exp, Hindi & Tamil speaking" },
  { id:"REQ-003", city:"Delhi", hospital:"Amrita Fortis & Marengo Faridabad", area:"Faridabad", bdType:"Floater", bu:"IGIV", hireType:"Replacement", replacementFor:"Sonu Kumar", raisedBy:"Mahesh Anand", date:"2026-03-26", status:"Pending Approval", notes:null },
  { id:"REQ-004", city:"Mumbai", hospital:"Kokilaben Dhirubhai Ambani", area:"Andheri West", bdType:"Focus", bu:"CPM", hireType:"New", replacementFor:null, raisedBy:"Varun Vishwanath", date:"2026-03-28", status:"Pending Approval", notes:"Female candidate preferred" },
  { id:"REQ-005", city:"Hyderabad", hospital:"Yashoda Hospitals", area:"Secunderabad", bdType:"Focus", bu:"IGIV", hireType:"Replacement", replacementFor:"Ravi Kumar", raisedBy:"Khazim Syed", date:"2026-03-25", status:"Active", notes:null },
  { id:"REQ-006", city:"Pune", hospital:"Ruby Hall Clinic", area:"Camp", bdType:"Floater", bu:"CPM", hireType:"New", replacementFor:null, raisedBy:"Varun Vishwanath", date:"2026-03-20", status:"Filled", notes:null },
  { id:"REQ-007", city:"Kolkata", hospital:"AMRI Hospitals", area:"Salt Lake", bdType:"Focus", bu:"IGIV", hireType:"Replacement", replacementFor:"Ranit Mullick", raisedBy:"Mahesh Anand", date:"2026-03-15", status:"Active", notes:null },
  { id:"REQ-008", city:"Delhi", hospital:"Max Smart Super Specialty", area:"Saket", bdType:"Focus", bu:"CPM", hireType:"New", replacementFor:null, raisedBy:"Gourav Singh", date:"2026-04-01", status:"Pending Approval", notes:null },
];

const STAGES = ["Sourced","R1 Scheduled","R1 Complete","R2 Scheduled","R2 Complete","Offered","Joined"];

const CANDIDATES = [
  { id:"C-001", reqId:"REQ-002", name:"Sakthivel A", phone:"9790454372", email:null, city:"Chennai", currentRole:"City Head", company:"Fibe", currentCTC:null, expectedCTC:null, notice:"Immediate", ta:"Payal", sourced:"2025-12-01", stage:"R2 Complete", r1By:"Lazer Rajan", r1Date:"2025-12-03", r1Result:"Select", r2By:"Soundappan Gopal", r2Date:"2025-12-10", r2Result:"Select", offerDate:null, joinDate:null, bu:"CPM" },
  { id:"C-002", reqId:"REQ-002", name:"Ravikumar K M", phone:"6361106732", email:"ravikumarkm6918@gmail.com", city:"Bangalore", currentRole:"Operation Manager", company:"Even Healthcare", currentCTC:75000, expectedCTC:93000, notice:"7 Days", ta:"Shubham", sourced:"2025-11-05", stage:"Joined", r1By:"Gaurav Sharma", r1Date:"2025-11-06", r1Result:"Select", r2By:"Ankita Kumari", r2Date:"2025-11-12", r2Result:"Select", offerDate:"2025-11-14", joinDate:"2025-11-17", bu:"IGIV" },
  { id:"C-003", reqId:"REQ-001", name:"Priya Sharma", phone:"9845012345", email:"priya.sharma@gmail.com", city:"Bangalore", currentRole:"BDA", company:"Pristyn Care", currentCTC:32000, expectedCTC:40000, notice:"30 Days", ta:"Namita", sourced:"2026-03-28", stage:"R1 Scheduled", r1By:"Himanshu Jaiswal", r1Date:"2026-04-08", r1Result:null, r2By:null, r2Date:null, r2Result:null, offerDate:null, joinDate:null, bu:"CPM" },
  { id:"C-004", reqId:"REQ-001", name:"Rahul Menon", phone:"8867234561", email:"rahul.menon@gmail.com", city:"Bangalore", currentRole:"Sales Executive", company:"Bajaj Finserv", currentCTC:28000, expectedCTC:35000, notice:"15 Days", ta:"Namita", sourced:"2026-03-29", stage:"Sourced", r1By:null, r1Date:null, r1Result:null, r2By:null, r2Date:null, r2Result:null, offerDate:null, joinDate:null, bu:"CPM" },
  { id:"C-005", reqId:"REQ-005", name:"Lalith Singh", phone:"8121632868", email:"rlalithkumarsingh@gmail.com", city:"Hyderabad", currentRole:"Territory Manager", company:"Oscar Healthcare", currentCTC:30000, expectedCTC:35000, notice:"7 Days", ta:"Aasiya", sourced:"2025-10-25", stage:"R1 Scheduled", r1By:"Khazim Syed", r1Date:"2026-04-06", r1Result:null, r2By:null, r2Date:null, r2Result:null, offerDate:null, joinDate:null, bu:"IGIV" },
  { id:"C-006", reqId:"REQ-003", name:"Vishal Kurali", phone:"9823456701", email:null, city:"Delhi", currentRole:"BDA", company:"Red.Health", currentCTC:25000, expectedCTC:32000, notice:"Immediate", ta:"Riddhi", sourced:"2026-03-30", stage:"Sourced", r1By:null, r1Date:null, r1Result:null, r2By:null, r2Date:null, r2Result:null, offerDate:null, joinDate:null, bu:"IGIV" },
  { id:"C-007", reqId:"REQ-007", name:"Arjun Mullick", phone:"9876543210", email:"arjun.mullick@gmail.com", city:"Kolkata", currentRole:"Sales Manager", company:"Ketto", currentCTC:45000, expectedCTC:55000, notice:"30 Days", ta:"Vedika", sourced:"2026-03-22", stage:"Offered", r1By:"Bhavesh N", r1Date:"2026-03-25", r1Result:"Select", r2By:"Ankita Kumari", r2Date:"2026-03-28", r2Result:"Select", offerDate:"2026-04-01", joinDate:null, bu:"IGIV" },
  { id:"C-008", reqId:"REQ-005", name:"Tarkeshhwar R", phone:"8309300285", email:null, city:"Hyderabad", currentRole:"BDA", company:"Byjus", currentCTC:null, expectedCTC:null, notice:null, ta:"Namita", sourced:"2025-08-16", stage:"R2 Scheduled", r1By:"Khazim Syed", r1Date:"2025-08-20", r1Result:"Select", r2By:"Bhavesh N", r2Date:"2026-04-07", r2Result:null, offerDate:null, joinDate:null, bu:"IGIV" },
  { id:"C-009", reqId:"REQ-008", name:"Simran Gaur", phone:"8920989190", email:"simrangaur6999@gmail.com", city:"Delhi", currentRole:"Sr BDA", company:"Batra Hospital", currentCTC:32000, expectedCTC:40000, notice:"15 Days", ta:"Namita", sourced:"2026-04-02", stage:"Sourced", r1By:null, r1Date:null, r1Result:null, r2By:null, r2Date:null, r2Result:null, offerDate:null, joinDate:null, bu:"CPM" },
];

const HEADCOUNT = [
  { city:"Bangalore", bu:"CPM", aop:7,  active:3, notice:1, pip:0, training:0, offered:1 },
  { city:"Bangalore", bu:"IGIV", aop:5, active:3, notice:0, pip:0, training:1, offered:0 },
  { city:"Chennai",   bu:"CPM", aop:3,  active:2, notice:0, pip:0, training:0, offered:0 },
  { city:"Chennai",   bu:"IGIV", aop:3, active:2, notice:1, pip:0, training:0, offered:1 },
  { city:"Delhi",     bu:"CPM", aop:5,  active:3, notice:2, pip:1, training:0, offered:0 },
  { city:"Delhi",     bu:"IGIV", aop:7, active:4, notice:1, pip:0, training:0, offered:0 },
  { city:"Mumbai",    bu:"CPM", aop:5,  active:5, notice:0, pip:1, training:0, offered:0 },
  { city:"Mumbai",    bu:"IGIV", aop:7, active:9, notice:0, pip:0, training:0, offered:0 },
  { city:"Hyderabad", bu:"CPM", aop:5,  active:4, notice:1, pip:2, training:0, offered:0 },
  { city:"Hyderabad", bu:"IGIV", aop:5, active:3, notice:0, pip:0, training:0, offered:1 },
  { city:"Pune",      bu:"CPM", aop:5,  active:5, notice:0, pip:1, training:0, offered:1 },
  { city:"Kolkata",   bu:"IGIV", aop:4, active:3, notice:1, pip:0, training:0, offered:1 },
  { city:"Ahmedabad", bu:"CPM", aop:2,  active:1, notice:1, pip:0, training:0, offered:0 },
  { city:"Indore",    bu:"IGIV", aop:3, active:2, notice:0, pip:0, training:0, offered:0 },
];

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
      <div style={{ marginLeft:"auto", position:"relative" }}>
        <Search size={13} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#94a3b8" }} />
        <input placeholder="Search candidates, cities…" style={{ paddingLeft:30, paddingRight:12, paddingTop:7, paddingBottom:7, fontSize:12, border:"1px solid #e2e8f0", borderRadius:8, width:220, outline:"none", fontFamily:"'Plus Jakarta Sans', sans-serif", color:"#374151" }} />
      </div>
    </div>
  );
}

/* ─── DASHBOARD ─────────────────────────────────────────────── */
function Dashboard({ bu, onNav, setReqFilter }) {
  const reqs = useMemo(() => REQUISITIONS.filter(r => bu === "all" || r.bu === bu), [bu]);
  const cands = useMemo(() => CANDIDATES.filter(c => bu === "all" || c.bu === bu), [bu]);
  const hc = useMemo(() => HEADCOUNT.filter(h => bu === "all" || h.bu === bu), [bu]);

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
            {cityRows.map(({ city, aop, active, open, candidates }) => (
              <tr key={city} style={{ cursor:"pointer" }} onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <Td style={{ fontWeight:600, color:"#0f172a" }}>{city}</Td>
                <Td style={{ color:"#374151", fontFamily:"'DM Mono', monospace" }}>{aop}</Td>
                <Td style={{ color:"#059669", fontWeight:600, fontFamily:"'DM Mono', monospace" }}>{active}</Td>
                <Td>{open>0 ? <span style={{ color:"#d97706", fontWeight:700, fontFamily:"'DM Mono', monospace" }}>{open}</span> : <span style={{ color:"#cbd5e1" }}>0</span>}</Td>
                <Td style={{ color:"#64748b", fontFamily:"'DM Mono', monospace" }}>{candidates}</Td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

/* ─── REQUISITIONS ──────────────────────────────────────────── */
function Requisitions({ bu, onNav, setReqFilter, setShowNew }) {
  const [statusF, setStatusF] = useState("all");
  const [cityF, setCityF] = useState("all");
  const [selected, setSelected] = useState(null);

  const reqs = useMemo(() => REQUISITIONS.filter(r =>
    (bu==="all"||r.bu===bu) && (statusF==="all"||r.status===statusF) && (cityF==="all"||r.city===cityF)
  ), [bu, statusF, cityF]);

  const cities = [...new Set(REQUISITIONS.map(r=>r.city))].sort();

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
        <select value={cityF} onChange={e=>setCityF(e.target.value)} style={sel()}>
          <option value="all">All Cities</option>
          {cities.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={()=>setShowNew(true)} style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:9, border:"none", cursor:"pointer", background:S.primary, color:"#fff", fontSize:12, fontWeight:600, fontFamily:"'Plus Jakarta Sans', sans-serif" }}>
          <Plus size={13}/> New Requisition
        </button>
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

            <button style={{ marginTop:"auto", width:"100%", padding:"10px", borderRadius:9, border:`1px solid ${S.primary}`, background:"transparent", color:S.primary, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif" }}
              onClick={()=>{setReqFilter(selected.id);onNav("pipeline");setSelected(null);}}>
              View Full Pipeline →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── PIPELINE ──────────────────────────────────────────────── */
function Pipeline({ bu, reqFilter, setReqFilter }) {
  const [view, setView] = useState("kanban");
  const [selectedC, setSelectedC] = useState(null);

  const cands = useMemo(() => CANDIDATES.filter(c =>
    (bu==="all"||c.bu===bu) && (reqFilter==="all"||c.reqId===reqFilter)
  ), [bu, reqFilter]);

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
        <button style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:9, border:"none", cursor:"pointer", background:S.primary, color:"#fff", fontSize:12, fontWeight:600, fontFamily:"'Plus Jakarta Sans', sans-serif" }}>
          <Plus size={13}/> Add Candidate
        </button>
      </div>

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
function CandidateModal({ c, onClose }) {
  const [tab, setTab] = useState("overview");
  const req = REQUISITIONS.find(r=>r.id===c.reqId);

  const inp = {
    width:"100%", marginTop:4, fontSize:12, border:"1px solid #e2e8f0", borderRadius:8,
    padding:"8px 10px", outline:"none", fontFamily:"'Plus Jakarta Sans', sans-serif", color:"#374151",
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
            </div>
          )}

          {tab==="interviews" && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {[
                { round:"Round 1", by:c.r1By, date:c.r1Date, result:c.r1Result },
                { round:"Round 2", by:c.r2By, date:c.r2Date, result:c.r2Result },
              ].map(({ round, by, date, result }) => (
                <div key={round} style={{ border:"1px solid #e2e8f0", borderRadius:12, padding:16 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>{round}</div>
                    {result && <span style={{ fontSize:12, fontWeight:700, color:result==="Select"?"#059669":"#dc2626", background:result==="Select"?"#d1fae5":"#fee2e2", padding:"3px 10px", borderRadius:99 }}>{result}</span>}
                    {!result && <span style={{ fontSize:11, color:"#94a3b8" }}>Pending</span>}
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
                </div>
              ))}
            </div>
          )}

          {tab==="schedule" && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ fontSize:12, color:"#64748b" }}>Schedule or update an interview slot for this candidate.</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {[
                  { l:"Round", type:"select", opts:["Round 1","Round 2"] },
                  { l:"Mode", type:"select", opts:["Virtual","In-Person (F2F)"] },
                ].map(({ l, type, opts }) => (
                  <div key={l}>
                    <label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>{l}</label>
                    <select style={inp}>{opts.map(o=><option key={o}>{o}</option>)}</select>
                  </div>
                ))}
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Interviewer</label>
                  <select style={inp}>
                    {["Himanshu Jaiswal","Khazim Syed","Bhavesh N","Ankita Kumari","Soundappan Gopal","Lazer Rajan"].map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Date</label>
                  <input type="date" style={inp}/>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Time Slot</label>
                  <input type="time" style={inp}/>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Location / Link</label>
                  <input type="text" placeholder="Google Meet link or address" style={inp}/>
                </div>
              </div>
              <button style={{ width:"100%", padding:"10px", borderRadius:9, border:"none", cursor:"pointer", background:S.primary, color:"#fff", fontSize:13, fontWeight:600, fontFamily:"'Plus Jakarta Sans', sans-serif", marginTop:4 }}>
                Save Interview Schedule
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
  const rows = useMemo(() => {
    const filtered = HEADCOUNT.filter(h=>bu==="all"||h.bu===bu);
    if (bu!=="all") return filtered.map(h=>({ ...h, deficit:h.aop-h.active-h.offered }));
    const cities = [...new Set(filtered.map(h=>h.city))];
    return cities.map(city=>{
      const cr = filtered.filter(h=>h.city===city);
      const aop=cr.reduce((s,r)=>s+r.aop,0), active=cr.reduce((s,r)=>s+r.active,0);
      const notice=cr.reduce((s,r)=>s+r.notice,0), pip=cr.reduce((s,r)=>s+r.pip,0);
      const training=cr.reduce((s,r)=>s+r.training,0), offered=cr.reduce((s,r)=>s+r.offered,0);
      return { city, bu:"all", aop, active, notice, pip, training, offered, deficit:aop-active-offered };
    });
  }, [bu]);

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
          <span style={{ fontSize:11, color:"#94a3b8" }}>Deficit = Target HC − Active − Offered</span>
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
  const [form, setForm] = useState({ bu:"CPM", hireType:"New", city:"", bdType:"Focus", hospital:"", area:"", replacementFor:"", notes:"" });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
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
        </div>
        <div style={{ padding:"16px 24px", borderTop:"1px solid #f1f5f9", display:"flex", justifyContent:"flex-end", gap:10 }}>
          <button onClick={onClose} style={{ padding:"9px 16px", borderRadius:9, border:"1px solid #e2e8f0", background:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", color:"#64748b", fontFamily:"'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button style={{ padding:"9px 18px", borderRadius:9, border:"none", background:S.primary, color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif" }}>Submit for Approval</button>
        </div>
      </div>
    </div>
  );
}

/* ─── APP ───────────────────────────────────────────────────── */
export default function App() {
  const [section, setSection] = useState("dashboard");
  const [bu, setBu] = useState("all");
  const [reqFilter, setReqFilter] = useState("all");
  const [showNewReq, setShowNewReq] = useState(false);

  return (
    <>
      <GlobalStyle/>
      <div style={{ display:"flex", height:"100%", background:"#f8fafc", overflow:"hidden" }}>
        <Sidebar active={section} onNav={setSection}/>
        <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
          <Header bu={bu} setBu={setBu}/>
          <main style={{ flex:1, overflowY:"auto", padding:24 }}>
            {section==="dashboard"    && <Dashboard bu={bu} onNav={setSection} setReqFilter={setReqFilter}/>}
            {section==="requisitions" && <Requisitions bu={bu} onNav={setSection} setReqFilter={setReqFilter} setShowNew={setShowNewReq}/>}
            {section==="pipeline"     && <Pipeline bu={bu} reqFilter={reqFilter} setReqFilter={setReqFilter}/>}
            {section==="headcount"    && <Headcount bu={bu}/>}
          </main>
        </div>
        {showNewReq && <NewReqModal onClose={()=>setShowNewReq(false)}/>}
      </div>
    </>
  );
}
