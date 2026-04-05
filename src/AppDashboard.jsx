import { useState, useMemo } from "react";
import {
  Plus, Search, X, ChevronDown, ChevronRight, Phone, Mail,
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
const S = { primary: "#0d9488", primaryDark: "#0f766e" };

const STAGE_CLS = {
  "Sourced":"#64748b", "R1 Scheduled":"#2563eb", "R1 Complete":"#0891b2",
  "R2 Scheduled":"#7c3aed", "R2 Complete":"#6d28d9", "Offered":"#d97706", "Joined":"#059669",
};
const STATUS_CLS = {
  "Pending Approval": { bg:"#fef3c7", color:"#92400e", dot:"#f59e0b" },
  "Approved":         { bg:"#dbeafe", color:"#1e40af", dot:"#3b82f6" },
  "Active":           { bg:"#d1fae5", color:"#065f46", dot:"#10b981" },
  "Filled":           { bg:"#f1f5f9", color:"#64748b", dot:"#94a3b8" },
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
  return <span style={{ background:`${c}18`, color:c, padding:"2px 8px", borderRadius:99, fontSize:11, fontWeight:600 }}>{stage}</span>;
}
function BUBadge({ bu }) {
  return <span style={{ background: bu === "CPM" ? "#dbeafe" : "#ede9fe", color: bu === "CPM" ? "#1e40af" : "#5b21b6", padding:"2px 8px", borderRadius:99, fontSize:11, fontWeight:600 }}>{bu === "CPM" ? "CPM · Lending" : "IGIV · Crowdfunding"}</span>;
}
function Th({ children }) {
  return <th style={{ padding:"9px 10px", textAlign:"left", fontSize:11, fontWeight:600, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.03em", whiteSpace:"nowrap" }}>{children}</th>;
}
function Td({ children, style }) {
  return <td style={{ padding:"10px 10px", fontSize:13, borderBottom:"1px solid #f1f5f9", verticalAlign:"middle", ...style }}>{children}</td>;
}

/* ─── COLLAPSIBLE PANEL ────────────────────────────────────── */
function Panel({ title, defaultOpen = true, count, action, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", overflow:"hidden" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding:"14px 20px", display:"flex", alignItems:"center", cursor:"pointer",
          borderBottom: open ? "1px solid #f1f5f9" : "none", userSelect:"none",
        }}
      >
        {open ? <ChevronDown size={14} color="#94a3b8" /> : <ChevronRight size={14} color="#94a3b8" />}
        <span style={{ fontSize:13, fontWeight:700, color:"#0f172a", marginLeft:8 }}>{title}</span>
        {count != null && (
          <span style={{ fontSize:10, fontWeight:700, background:"#f1f5f9", color:"#64748b", borderRadius:99, padding:"2px 8px", marginLeft:8 }}>{count}</span>
        )}
        {action && (
          <div style={{ marginLeft:"auto" }} onClick={e => e.stopPropagation()}>
            {action}
          </div>
        )}
        {!action && <div style={{ marginLeft:"auto", fontSize:10, color:"#94a3b8", fontWeight:500 }}>{open ? "collapse" : "expand"}</div>}
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}

/* ─── HEADER ───────────────────────────────────────────────── */
function Header({ bu, setBu }) {
  return (
    <div style={{ height:56, background:"#fff", borderBottom:"1px solid #e2e8f0", display:"flex", alignItems:"center", padding:"0 24px", gap:16, flexShrink:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <img src="https://carepalmoney.com/assets/img/carepal-logo.png" alt="CarePal" style={{ height:22, objectFit:"contain" }}
          onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="block"; }} />
        <div style={{ display:"none", fontWeight:800, fontSize:14, color:"#0f172a" }}>CarePal</div>
        <span style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:"0.08em", textTransform:"uppercase" }}>HR Admin</span>
      </div>
      <div style={{ width:1, height:28, background:"#e2e8f0" }} />
      <div style={{ display:"flex", background:"#f1f5f9", borderRadius:8, padding:2, gap:1 }}>
        {[["all","All Units"],["CPM","CPM · Lending"],["IGIV","IGIV · Crowdfunding"]].map(([v, l]) => (
          <button key={v} onClick={() => setBu(v)} style={{
            padding:"5px 12px", borderRadius:7, border:"none", cursor:"pointer",
            background: bu === v ? "#fff" : "transparent",
            boxShadow: bu === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            color: bu === v ? S.primary : "#64748b",
            fontSize:11, fontWeight:600, fontFamily:"'Plus Jakarta Sans', sans-serif",
          }}>{l}</button>
        ))}
      </div>
      <div style={{ position:"relative", marginLeft:"auto" }}>
        <Search size={12} style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)", color:"#94a3b8" }} />
        <input placeholder="Search…" style={{ paddingLeft:28, paddingRight:10, paddingTop:6, paddingBottom:6, fontSize:11, border:"1px solid #e2e8f0", borderRadius:7, width:200, outline:"none", fontFamily:"'Plus Jakarta Sans', sans-serif", color:"#374151" }} />
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ width:30, height:30, borderRadius:"50%", background:S.primary, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:11, fontWeight:700 }}>AK</div>
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:"#0f172a" }}>Akhlaque Khan</div>
          <div style={{ fontSize:9, color:"#94a3b8" }}>TA Lead</div>
        </div>
      </div>
    </div>
  );
}

/* ─── REQUISITION ROW (expandable) ─────────────────────────── */
function RequisitionRow({ req, candidates, expanded, onToggle, onSelectCandidate }) {
  return (
    <div style={{ borderBottom:"1px solid #f1f5f9" }}>
      {/* Row header */}
      <div
        onClick={onToggle}
        style={{
          display:"flex", alignItems:"center", padding:"12px 20px", cursor:"pointer",
          background: expanded ? "#f8fafc" : "transparent",
          transition:"background 0.1s",
        }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = "#fafafa"; }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = "transparent"; }}
      >
        {expanded ? <ChevronDown size={12} color="#94a3b8" /> : <ChevronRight size={12} color="#94a3b8" />}
        <span style={{ fontSize:12, fontWeight:700, color:S.primary, marginLeft:8, width:65, flexShrink:0 }}>{req.id}</span>
        <span style={{ fontSize:12, fontWeight:600, color:"#0f172a", width:90, flexShrink:0 }}>{req.city}</span>
        <span style={{ fontSize:12, color:"#64748b", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{req.hospital || "—"}</span>
        <span style={{ fontSize:11, color:"#374151", width:70, flexShrink:0 }}>{req.bdType} BD</span>
        <span style={{ width:110, flexShrink:0 }}><BUBadge bu={req.bu} /></span>
        <span style={{ fontSize:11, color:"#374151", width:80, flexShrink:0 }}>{req.hireType}</span>
        <span style={{ width:110, flexShrink:0 }}><StatusBadge status={req.status} /></span>
        <span style={{ fontSize:10, fontWeight:700, background: candidates.length > 0 ? `${S.primary}15` : "#f1f5f9", color: candidates.length > 0 ? S.primary : "#94a3b8", borderRadius:99, padding:"2px 8px" }}>
          {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Expanded: candidate list */}
      {expanded && (
        <div style={{ padding:"0 20px 14px 44px" }}>
          {candidates.length === 0 ? (
            <div style={{ fontSize:12, color:"#94a3b8", padding:"8px 0" }}>No candidates sourced yet</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:4 }}>
              {candidates.map(c => (
                <div
                  key={c.id}
                  onClick={() => onSelectCandidate(c)}
                  style={{
                    display:"flex", alignItems:"center", padding:"10px 14px",
                    background:"#fff", border:"1px solid #e2e8f0", borderRadius:10,
                    cursor:"pointer", gap:12, transition:"box-shadow 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
                >
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:"#0f172a" }}>{c.name}</div>
                    <div style={{ fontSize:11, color:"#64748b", marginTop:1 }}>{c.currentRole} · {c.company}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <MapPin size={10} color="#94a3b8" />
                    <span style={{ fontSize:11, color:"#94a3b8" }}>{c.city}</span>
                  </div>
                  {c.notice && <span style={{ fontSize:10, color:S.primary, fontWeight:600 }}>NP: {c.notice}</span>}
                  <span style={{ fontSize:10, color:"#94a3b8" }}>TA: {c.ta}</span>
                  <StageBadge stage={c.stage} />
                  <ChevronRight size={12} color="#94a3b8" />
                </div>
              ))}
            </div>
          )}
          {req.notes && (
            <div style={{ marginTop:8, background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8, padding:"8px 12px", fontSize:11, color:"#92400e" }}>
              <strong>Note:</strong> {req.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── CANDIDATE PANEL (right slide-out) ────────────────────── */
function CandidatePanel({ c, onClose }) {
  const [tab, setTab] = useState("overview");
  const req = REQUISITIONS.find(r => r.id === c.reqId);
  const inp = { width:"100%", marginTop:4, fontSize:12, border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 10px", outline:"none", fontFamily:"'Plus Jakarta Sans', sans-serif", color:"#374151" };

  return (
    <div style={{ position:"fixed", top:0, right:0, bottom:0, width:420, zIndex:50, background:"#fff", boxShadow:"-8px 0 40px rgba(0,0,0,0.12)", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid #f1f5f9", flexShrink:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:"#0f172a" }}>{c.name}</div>
            <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>{c.currentRole} · {c.company}</div>
            <div style={{ display:"flex", gap:6, marginTop:8 }}>
              <StageBadge stage={c.stage} />
              <BUBadge bu={c.bu} />
              {req && <span style={{ fontSize:11, color:"#94a3b8", padding:"2px 0" }}>{req.id}</span>}
            </div>
          </div>
          <button style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8" }} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginTop:12 }}>
          {[
            { icon:Phone, l:"Phone", v:c.phone },
            { icon:Mail, l:"Email", v:c.email || "—" },
            { icon:MapPin, l:"City", v:c.city },
            { icon:Clock, l:"Notice", v:c.notice || "—" },
          ].map(({ icon:Icon, l, v }) => (
            <div key={l} style={{ display:"flex", gap:6, alignItems:"flex-start" }}>
              <Icon size={11} color="#94a3b8" style={{ marginTop:2 }} />
              <div>
                <div style={{ fontSize:9, color:"#94a3b8", fontWeight:600 }}>{l}</div>
                <div style={{ fontSize:11, fontWeight:600, color:"#0f172a", marginTop:1 }}>{v}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", borderBottom:"1px solid #f1f5f9", padding:"0 20px", flexShrink:0 }}>
        {["overview","interviews","schedule","documents"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:"10px 12px", border:"none", borderBottom:`2px solid ${tab === t ? S.primary : "transparent"}`,
            background:"transparent", fontSize:11, fontWeight:600, color:tab === t ? S.primary : "#94a3b8",
            cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", textTransform:"capitalize",
          }}>{t}</button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:20 }}>
        {tab === "overview" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[
                { l:"Current CTC", v:fmt(c.currentCTC) }, { l:"Expected CTC", v:fmt(c.expectedCTC) },
                { l:"TA Assigned", v:c.ta }, { l:"Sourced Date", v:c.sourced },
                { l:"Offer Date", v:c.offerDate || "—" }, { l:"Joining Date", v:c.joinDate || "—" },
              ].map(({ l, v }) => (
                <div key={l} style={{ background:"#f8fafc", borderRadius:8, padding:"8px 10px" }}>
                  <div style={{ fontSize:9, color:"#94a3b8", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>{l}</div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#0f172a", marginTop:2, fontFamily:"'DM Mono', monospace" }}>{v}</div>
                </div>
              ))}
            </div>
            {req && (
              <div style={{ background:`${S.primary}0d`, border:`1px solid ${S.primary}30`, borderRadius:9, padding:"10px 12px" }}>
                <div style={{ fontSize:10, fontWeight:700, color:S.primary, marginBottom:3 }}>Requisition · {req.id}</div>
                <div style={{ fontSize:12, color:"#374151" }}>{req.city} · {req.hospital || "Hospital TBD"} · {req.bdType} BD</div>
                {req.notes && <div style={{ fontSize:11, color:"#64748b", marginTop:3 }}>{req.notes}</div>}
              </div>
            )}
          </div>
        )}
        {tab === "interviews" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[{ round:"Round 1", by:c.r1By, date:c.r1Date, result:c.r1Result }, { round:"Round 2", by:c.r2By, date:c.r2Date, result:c.r2Result }].map(({ round, by, date, result }) => (
              <div key={round} style={{ border:"1px solid #e2e8f0", borderRadius:10, padding:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#0f172a" }}>{round}</div>
                  {result ? <span style={{ fontSize:11, fontWeight:700, color:result === "Select" ? "#059669" : "#dc2626", background:result === "Select" ? "#d1fae5" : "#fee2e2", padding:"2px 8px", borderRadius:99 }}>{result}</span> : <span style={{ fontSize:10, color:"#94a3b8" }}>Pending</span>}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <div style={{ background:"#f8fafc", borderRadius:7, padding:"7px 10px" }}>
                    <div style={{ fontSize:9, color:"#94a3b8", fontWeight:600 }}>INTERVIEWER</div>
                    <div style={{ fontSize:12, fontWeight:600, color:"#0f172a", marginTop:2 }}>{by || "—"}</div>
                  </div>
                  <div style={{ background:"#f8fafc", borderRadius:7, padding:"7px 10px" }}>
                    <div style={{ fontSize:9, color:"#94a3b8", fontWeight:600 }}>DATE</div>
                    <div style={{ fontSize:12, fontWeight:600, color:"#0f172a", marginTop:2, fontFamily:"'DM Mono', monospace" }}>{date || "—"}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "schedule" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ fontSize:12, color:"#64748b" }}>Schedule or update an interview slot.</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {[{ l:"Round", opts:["Round 1","Round 2"] }, { l:"Mode", opts:["Virtual","In-Person (F2F)"] }].map(({ l, opts }) => (
                <div key={l}><label style={{ fontSize:10, fontWeight:600, color:"#374151" }}>{l}</label><select style={inp}>{opts.map(o => <option key={o}>{o}</option>)}</select></div>
              ))}
              <div><label style={{ fontSize:10, fontWeight:600, color:"#374151" }}>Interviewer</label><select style={inp}>{["Himanshu Jaiswal","Khazim Syed","Bhavesh N","Ankita Kumari","Soundappan Gopal","Lazer Rajan"].map(o => <option key={o}>{o}</option>)}</select></div>
              <div><label style={{ fontSize:10, fontWeight:600, color:"#374151" }}>Date</label><input type="date" style={inp} /></div>
              <div><label style={{ fontSize:10, fontWeight:600, color:"#374151" }}>Time</label><input type="time" style={inp} /></div>
            </div>
            <button style={{ width:"100%", padding:"9px", borderRadius:8, border:"none", cursor:"pointer", background:S.primary, color:"#fff", fontSize:12, fontWeight:600, fontFamily:"'Plus Jakarta Sans', sans-serif" }}>Save Interview Schedule</button>
          </div>
        )}
        {tab === "documents" && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ fontSize:12, color:"#64748b", marginBottom:4 }}>Upload documents to Google Drive.</div>
            {["Resume / CV","Motivation Letter","Offer Letter","ID Proof (Aadhaar)","Relieving Letter","Appointment Letter"].map(doc => (
              <div key={doc} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 12px", border:"1px solid #e2e8f0", borderRadius:9 }}>
                <div style={{ display:"flex", alignItems:"center", gap:7 }}><FileText size={13} color="#94a3b8" /><span style={{ fontSize:11, fontWeight:500, color:"#374151" }}>{doc}</span></div>
                <button style={{ fontSize:10, fontWeight:600, color:S.primary, background:"transparent", border:`1px solid ${S.primary}40`, borderRadius:6, padding:"3px 8px", cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif" }}>Upload</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── NEW REQ MODAL ─────────────────────────────────────────── */
function NewReqModal({ onClose }) {
  const [form, setForm] = useState({ bu:"CPM", hireType:"New", city:"", bdType:"Focus", hospital:"", area:"", replacementFor:"", notes:"" });
  const set = (k, v) => setForm(f => ({ ...f, [k]:v }));
  const inp = { width:"100%", marginTop:4, fontSize:12, border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 10px", outline:"none", fontFamily:"'Plus Jakarta Sans', sans-serif", color:"#374151" };
  return (
    <div style={{ position:"fixed", inset:0, zIndex:70, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:18, width:520, boxShadow:"0 20px 60px rgba(0,0,0,0.18)", overflow:"hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding:"22px 24px 18px", borderBottom:"1px solid #f1f5f9", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:17, fontWeight:800, color:"#0f172a" }}>New Hiring Requisition</div>
          <button style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8" }} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ padding:24, maxHeight:"65vh", overflowY:"auto", display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div><label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Business Unit *</label><select value={form.bu} onChange={e => set("bu",e.target.value)} style={inp}><option value="CPM">CPM – Lending</option><option value="IGIV">IGIV – Crowdfunding</option></select></div>
            <div><label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Hire Type *</label><select value={form.hireType} onChange={e => set("hireType",e.target.value)} style={inp}><option value="New">New Hire</option><option value="Replacement">Replacement</option></select></div>
            <div><label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>City *</label><select value={form.city} onChange={e => set("city",e.target.value)} style={inp}><option value="">Select city…</option>{["Ahmedabad","Bangalore","Bhubaneswar","Chennai","Delhi","Hyderabad","Indore","Kochi","Kolkata","Mumbai","Pune"].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>BD Type *</label><select value={form.bdType} onChange={e => set("bdType",e.target.value)} style={inp}><option value="Focus">Focus BD</option><option value="Floater">Floater BD</option></select></div>
            <div><label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Hospital</label><input value={form.hospital} onChange={e => set("hospital",e.target.value)} placeholder="e.g. Apollo Greams Road" style={inp} /></div>
            <div><label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Area / Zone</label><input value={form.area} onChange={e => set("area",e.target.value)} placeholder="e.g. Andheri West" style={inp} /></div>
            {form.hireType === "Replacement" && <div style={{ gridColumn:"1/-1" }}><label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Replacing BD Name *</label><input value={form.replacementFor} onChange={e => set("replacementFor",e.target.value)} placeholder="Full name" style={inp} /></div>}
          </div>
          <div><label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Additional Requirements</label><textarea value={form.notes} onChange={e => set("notes",e.target.value)} rows={3} placeholder="e.g. Female candidate preferred…" style={{ ...inp, resize:"none" }} /></div>
          <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:9, padding:"10px 12px", fontSize:11, color:"#92400e", display:"flex", gap:6, alignItems:"flex-start" }}>
            <AlertCircle size={13} style={{ flexShrink:0, marginTop:1 }} />
            This requisition will be routed to the appropriate manager for approval.
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
  const [bu, setBu] = useState("all");
  const [expandedReq, setExpandedReq] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showNewReq, setShowNewReq] = useState(false);

  const reqs = useMemo(() => REQUISITIONS.filter(r => bu === "all" || r.bu === bu), [bu]);
  const cands = useMemo(() => CANDIDATES.filter(c => bu === "all" || c.bu === bu), [bu]);
  const hcFiltered = useMemo(() => HEADCOUNT.filter(h => bu === "all" || h.bu === bu), [bu]);

  const openPos = reqs.filter(r => r.status !== "Filled").length;
  const joined = cands.filter(c => c.stage === "Joined").length;
  const offered = cands.filter(c => ["Offered","Joined"].includes(c.stage)).length;

  // Funnel
  const funnelData = STAGES.map(s => ({ stage:s, count:cands.filter(c => c.stage === s).length }));
  const maxF = Math.max(...funnelData.map(f => f.count), 1);

  // Headcount
  const hcRows = useMemo(() => {
    if (bu !== "all") return hcFiltered.map(h => ({ ...h, deficit:h.aop - h.active - h.offered }));
    const cities = [...new Set(hcFiltered.map(h => h.city))];
    return cities.map(city => {
      const cr = hcFiltered.filter(h => h.city === city);
      const aop = cr.reduce((s,r) => s+r.aop,0), active = cr.reduce((s,r) => s+r.active,0);
      const notice = cr.reduce((s,r) => s+r.notice,0), pip = cr.reduce((s,r) => s+r.pip,0);
      const offered = cr.reduce((s,r) => s+r.offered,0);
      return { city, aop, active, notice, pip, offered, deficit:aop-active-offered };
    });
  }, [bu, hcFiltered]);

  return (
    <>
      <GlobalStyle />
      <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"#f8fafc", overflow:"hidden" }}>
        <Header bu={bu} setBu={setBu} />
        <main style={{ flex:1, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", gap:16 }}>
          {/* Metrics strip — always visible */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
            {[
              { label:"Open Positions", value:openPos, sub:"Pending + Approved + Active", color:S.primary },
              { label:"Candidates in Pipe", value:cands.length, sub:"All pipeline stages", color:"#2563eb" },
              { label:"Offers Extended", value:offered, sub:"Offered or joined", color:"#d97706" },
              { label:"Confirmed Joins", value:joined, sub:"DOJ confirmed", color:"#059669" },
            ].map(({ label, value, sub, color }) => (
              <div key={label} style={{ background:"#fff", borderRadius:12, border:"1px solid #e2e8f0", padding:"16px 18px" }}>
                <div style={{ fontSize:28, fontWeight:800, color, fontFamily:"'DM Mono', monospace" }}>{value}</div>
                <div style={{ fontSize:12, fontWeight:600, color:"#374151", marginTop:3 }}>{label}</div>
                <div style={{ fontSize:10, color:"#94a3b8", marginTop:1 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Hiring Funnel */}
          <Panel title="Hiring Funnel" count={cands.length}>
            <div style={{ padding:"14px 20px 18px", display:"flex", flexDirection:"column", gap:8 }}>
              {funnelData.map(({ stage, count }) => (
                <div key={stage} style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:100, fontSize:11, color:"#64748b", textAlign:"right", flexShrink:0, fontWeight:500 }}>{stage}</div>
                  <div style={{ flex:1, background:"#f1f5f9", borderRadius:99, height:16, overflow:"hidden" }}>
                    <div style={{ height:16, borderRadius:99, background:`linear-gradient(90deg, ${S.primary}, #14b8a6)`, width:`${Math.max(5,(count/maxF)*100)}%`, transition:"width 0.3s" }} />
                  </div>
                  <div style={{ width:20, fontSize:12, fontWeight:700, color:"#374151", fontFamily:"'DM Mono', monospace" }}>{count}</div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Requisitions */}
          <Panel
            title="Requisitions"
            count={reqs.length}
            action={
              <button onClick={() => setShowNewReq(true)} style={{
                display:"flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius:7,
                border:"none", background:S.primary, cursor:"pointer",
                fontSize:11, fontWeight:600, color:"#fff", fontFamily:"'Plus Jakarta Sans', sans-serif",
              }}>
                <Plus size={11} /> New Requisition
              </button>
            }
          >
            {reqs.map(r => (
              <RequisitionRow
                key={r.id}
                req={r}
                candidates={cands.filter(c => c.reqId === r.id)}
                expanded={expandedReq === r.id}
                onToggle={() => setExpandedReq(expandedReq === r.id ? null : r.id)}
                onSelectCandidate={setSelectedCandidate}
              />
            ))}
          </Panel>

          {/* Headcount */}
          <Panel title="Headcount" defaultOpen={false} count={hcRows.length + " cities"}>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead style={{ background:"#f8fafc" }}>
                  <tr>{["City","Target","Active","Notice","PIP","Offered","Deficit"].map(h => <Th key={h}>{h}</Th>)}</tr>
                </thead>
                <tbody>
                  {hcRows.map((r, i) => (
                    <tr key={i}>
                      <Td style={{ fontWeight:600, color:"#0f172a" }}>{r.city}</Td>
                      <Td style={{ fontFamily:"'DM Mono', monospace" }}>{r.aop}</Td>
                      <Td style={{ fontFamily:"'DM Mono', monospace", color:"#059669", fontWeight:700 }}>{r.active}</Td>
                      <Td style={{ fontFamily:"'DM Mono', monospace", color:r.notice > 0 ? "#d97706" : "#94a3b8" }}>{r.notice}</Td>
                      <Td style={{ fontFamily:"'DM Mono', monospace", color:r.pip > 0 ? "#dc2626" : "#94a3b8" }}>{r.pip}</Td>
                      <Td style={{ fontFamily:"'DM Mono', monospace" }}>{r.offered}</Td>
                      <Td><span style={{ fontFamily:"'DM Mono', monospace", fontWeight:800, color:r.deficit > 0 ? "#dc2626" : "#059669" }}>{r.deficit > 0 ? `+${r.deficit}` : r.deficit}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </main>
      </div>

      {selectedCandidate && <CandidatePanel c={selectedCandidate} onClose={() => setSelectedCandidate(null)} />}
      {showNewReq && <NewReqModal onClose={() => setShowNewReq(false)} />}
    </>
  );
}
