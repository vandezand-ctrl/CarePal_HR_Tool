import { useState, useMemo } from "react";
import {
  Plus, Search, X, Phone, Mail, MapPin, Clock, Check,
  FileText, AlertCircle, ChevronRight, UserPlus, CalendarCheck,
  CheckCircle2, Gift, Briefcase, ClipboardList
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
const S = { primary: "#0d9488" };
const STATUS_CLS = {
  "Pending Approval": { bg:"#fef3c7", color:"#92400e", dot:"#f59e0b" },
  "Approved":         { bg:"#dbeafe", color:"#1e40af", dot:"#3b82f6" },
  "Active":           { bg:"#d1fae5", color:"#065f46", dot:"#10b981" },
  "Filled":           { bg:"#f1f5f9", color:"#64748b", dot:"#94a3b8" },
};
const STAGE_CLS = {
  "Sourced":"#64748b", "R1 Scheduled":"#2563eb", "R1 Complete":"#0891b2",
  "R2 Scheduled":"#7c3aed", "R2 Complete":"#6d28d9", "Offered":"#d97706", "Joined":"#059669",
};
const fmt = n => n != null ? `₹${(n/1000).toFixed(0)}k` : "—";

/* ─── ATOMS ─────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const s = STATUS_CLS[status] || STATUS_CLS["Filled"];
  return <span style={{ background:s.bg, color:s.color, display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px", borderRadius:99, fontSize:11, fontWeight:600 }}><span style={{ width:6, height:6, borderRadius:99, background:s.dot, display:"inline-block" }} />{status}</span>;
}
function StageBadge({ stage }) {
  const c = STAGE_CLS[stage] || "#94a3b8";
  return <span style={{ background:`${c}18`, color:c, padding:"2px 8px", borderRadius:99, fontSize:11, fontWeight:600 }}>{stage}</span>;
}
function BUBadge({ bu }) {
  return <span style={{ background: bu === "CPM" ? "#dbeafe" : "#ede9fe", color: bu === "CPM" ? "#1e40af" : "#5b21b6", padding:"2px 8px", borderRadius:99, fontSize:11, fontWeight:600 }}>{bu === "CPM" ? "CPM" : "IGIV"}</span>;
}

/* ─── EVENT TYPES ──────────────────────────────────────────── */
const EVENT_CONFIG = {
  req_raised:   { label:"Requisition Raised", color:"#f59e0b", bg:"#fffbeb", icon:ClipboardList, category:"requisitions" },
  sourced:      { label:"Candidate Sourced",  color:"#64748b", bg:"#f8fafc", icon:UserPlus,      category:"candidates" },
  r1_scheduled: { label:"R1 Scheduled",       color:"#2563eb", bg:"#eff6ff", icon:CalendarCheck,  category:"interviews" },
  r1_complete:  { label:"R1 Complete",        color:"#0891b2", bg:"#ecfeff", icon:CheckCircle2,   category:"interviews" },
  r2_scheduled: { label:"R2 Scheduled",       color:"#7c3aed", bg:"#f5f3ff", icon:CalendarCheck,  category:"interviews" },
  r2_complete:  { label:"R2 Complete",        color:"#6d28d9", bg:"#f5f3ff", icon:CheckCircle2,   category:"interviews" },
  offered:      { label:"Offer Extended",     color:"#d97706", bg:"#fffbeb", icon:Gift,           category:"offers" },
  joined:       { label:"Candidate Joined",   color:"#059669", bg:"#ecfdf5", icon:Briefcase,      category:"offers" },
};

function generateEvents(reqs, cands) {
  const events = [];
  reqs.forEach(r => {
    events.push({ type:"req_raised", date:r.date, city:r.city, bu:r.bu, req:r, candidate:null,
      title:`${r.id} raised — ${r.city} · ${r.bdType} BD`,
      detail:`${r.hireType} hire${r.replacementFor ? ` (replacing ${r.replacementFor})` : ""} · Raised by ${r.raisedBy}`,
    });
  });
  cands.forEach(c => {
    const req = reqs.find(r => r.id === c.reqId);
    const reqLabel = req ? `${req.id} · ${req.hospital || req.city}` : c.reqId;
    events.push({ type:"sourced", date:c.sourced, city:c.city, bu:c.bu, req, candidate:c,
      title:`${c.name} sourced`,
      detail:`${c.currentRole} · ${c.company} · TA: ${c.ta} · for ${reqLabel}`,
    });
    if (c.r1Date) events.push({ type:"r1_scheduled", date:c.r1Date, city:c.city, bu:c.bu, req, candidate:c,
      title:`R1 scheduled for ${c.name}`,
      detail:`Interviewer: ${c.r1By} · ${c.r1Date}`,
    });
    if (c.r1Result) events.push({ type:"r1_complete", date:c.r1Date, city:c.city, bu:c.bu, req, candidate:c,
      title:`R1 ${c.r1Result === "Select" ? "passed" : "rejected"} — ${c.name}`,
      detail:`Result: ${c.r1Result} · Interviewer: ${c.r1By}`,
    });
    if (c.r2Date) events.push({ type:"r2_scheduled", date:c.r2Date, city:c.city, bu:c.bu, req, candidate:c,
      title:`R2 scheduled for ${c.name}`,
      detail:`Interviewer: ${c.r2By} · ${c.r2Date}`,
    });
    if (c.r2Result) events.push({ type:"r2_complete", date:c.r2Date, city:c.city, bu:c.bu, req, candidate:c,
      title:`R2 ${c.r2Result === "Select" ? "passed" : "rejected"} — ${c.name}`,
      detail:`Result: ${c.r2Result} · Interviewer: ${c.r2By}`,
    });
    if (c.offerDate) events.push({ type:"offered", date:c.offerDate, city:c.city, bu:c.bu, req, candidate:c,
      title:`Offer extended to ${c.name}`,
      detail:`${c.currentRole} · ${c.company} · ${c.city}`,
    });
    if (c.joinDate) events.push({ type:"joined", date:c.joinDate, city:c.city, bu:c.bu, req, candidate:c,
      title:`${c.name} joined`,
      detail:`${c.currentRole} · ${c.company} · ${c.city}`,
    });
  });
  events.sort((a, b) => b.date.localeCompare(a.date));
  return events;
}

function formatDateHeader(dateStr) {
  const today = "2026-04-05"; // mock "today"
  const yesterday = "2026-04-04";
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"short", year:"numeric" });
}

/* ─── EVENT CARD ───────────────────────────────────────────── */
function EventCard({ event, onClick, isSelected }) {
  const config = EVENT_CONFIG[event.type];
  const Icon = config.icon;
  return (
    <div
      onClick={() => onClick(event)}
      style={{
        display:"flex", gap:14, padding:"14px 18px", cursor:"pointer",
        background: isSelected ? `${config.color}08` : "#fff",
        borderLeft: isSelected ? `3px solid ${config.color}` : "3px solid transparent",
        borderBottom:"1px solid #f8fafc",
        transition:"all 0.1s",
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#fafafa"; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "#fff"; }}
    >
      {/* Icon */}
      <div style={{
        width:34, height:34, borderRadius:10, background:config.bg,
        display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
      }}>
        <Icon size={15} color={config.color} />
      </div>
      {/* Content */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
          <span style={{ fontSize:12, fontWeight:700, color:"#0f172a" }}>{event.title}</span>
        </div>
        <div style={{ fontSize:11, color:"#64748b", lineHeight:1.4 }}>{event.detail}</div>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:6 }}>
          <BUBadge bu={event.bu} />
          <span style={{ fontSize:10, color:"#94a3b8" }}>{event.city}</span>
          <span style={{ fontSize:10, color:"#cbd5e1" }}>{event.date}</span>
        </div>
      </div>
      <ChevronRight size={14} color="#cbd5e1" style={{ alignSelf:"center", flexShrink:0 }} />
    </div>
  );
}

/* ─── DETAIL PANEL ─────────────────────────────────────────── */
function DetailPanel({ event, onClose }) {
  const [tab, setTab] = useState("overview");
  const c = event.candidate;
  const r = event.req;
  const inp = { width:"100%", marginTop:4, fontSize:12, border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 10px", outline:"none", fontFamily:"'Plus Jakarta Sans', sans-serif", color:"#374151" };

  // If it's a requisition event with no candidate, show req detail
  if (!c && r) {
    return (
      <div style={{ height:"100%", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"18px 20px", borderBottom:"1px solid #f1f5f9", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:11, color:"#94a3b8", fontWeight:600 }}>{r.id}</div>
              <div style={{ fontSize:18, fontWeight:800, color:"#0f172a", marginTop:2 }}>{r.city} · {r.bdType} BD</div>
              <div style={{ display:"flex", gap:6, marginTop:8 }}><StatusBadge status={r.status} /><BUBadge bu={r.bu} /></div>
            </div>
            <button style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8" }} onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", gap:12 }}>
          {/* Approval flow */}
          <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>Approval Flow</div>
          {[
            { label:"Requisition Raised", by:r.raisedBy, date:r.date, done:true },
            { label:"Manager Approval", by:r.status === "Pending Approval" ? "Awaiting..." : "Approved", done:r.status !== "Pending Approval" },
            { label:"HR Notified & Active", by:["Active","Filled"].includes(r.status) ? "Notified" : "Pending", done:["Active","Filled"].includes(r.status) },
          ].map(({ label, by, date, done }) => (
            <div key={label} style={{ display:"flex", gap:10, marginBottom:6 }}>
              <div style={{ width:20, height:20, borderRadius:"50%", background:done ? "#d1fae5" : "#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {done ? <Check size={10} color="#059669" /> : <Clock size={10} color="#94a3b8" />}
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:"#0f172a" }}>{label}</div>
                <div style={{ fontSize:11, color:"#64748b" }}>{by}{date ? ` · ${date}` : ""}</div>
              </div>
            </div>
          ))}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, borderTop:"1px solid #f1f5f9", paddingTop:14 }}>
            {[{ l:"Hospital", v:r.hospital || "—" }, { l:"Area", v:r.area || "—" }, { l:"Hire Type", v:r.hireType }, { l:"Replacing", v:r.replacementFor || "—" }].map(({ l, v }) => (
              <div key={l} style={{ background:"#f8fafc", borderRadius:8, padding:"8px 10px" }}>
                <div style={{ fontSize:9, color:"#94a3b8", fontWeight:600, textTransform:"uppercase" }}>{l}</div>
                <div style={{ fontSize:13, fontWeight:600, color:"#0f172a", marginTop:2 }}>{v}</div>
              </div>
            ))}
          </div>
          {r.notes && <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8, padding:"8px 12px", fontSize:11, color:"#92400e" }}><strong>Note:</strong> {r.notes}</div>}
          {/* Linked candidates */}
          <div style={{ borderTop:"1px solid #f1f5f9", paddingTop:14 }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>Linked Candidates</div>
            {CANDIDATES.filter(cc => cc.reqId === r.id).length === 0
              ? <div style={{ fontSize:12, color:"#94a3b8" }}>No candidates sourced yet</div>
              : CANDIDATES.filter(cc => cc.reqId === r.id).map(cc => (
                <div key={cc.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:"1px solid #f8fafc" }}>
                  <div><div style={{ fontSize:12, fontWeight:600, color:"#0f172a" }}>{cc.name}</div><div style={{ fontSize:11, color:"#64748b" }}>{cc.ta} · {cc.sourced}</div></div>
                  <StageBadge stage={cc.stage} />
                </div>
              ))
            }
          </div>
        </div>
      </div>
    );
  }

  // Candidate detail
  if (!c) return null;
  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid #f1f5f9", flexShrink:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:"#0f172a" }}>{c.name}</div>
            <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>{c.currentRole} · {c.company}</div>
            <div style={{ display:"flex", gap:6, marginTop:8 }}><StageBadge stage={c.stage} /><BUBadge bu={c.bu} />{r && <span style={{ fontSize:11, color:"#94a3b8", padding:"2px 0" }}>{r.id}</span>}</div>
          </div>
          <button style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8" }} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginTop:12 }}>
          {[{ icon:Phone, l:"Phone", v:c.phone }, { icon:Mail, l:"Email", v:c.email || "—" }, { icon:MapPin, l:"City", v:c.city }, { icon:Clock, l:"Notice", v:c.notice || "—" }].map(({ icon:Icon, l, v }) => (
            <div key={l} style={{ display:"flex", gap:6 }}><Icon size={11} color="#94a3b8" style={{ marginTop:2 }} /><div><div style={{ fontSize:9, color:"#94a3b8", fontWeight:600 }}>{l}</div><div style={{ fontSize:11, fontWeight:600, color:"#0f172a", marginTop:1 }}>{v}</div></div></div>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", borderBottom:"1px solid #f1f5f9", padding:"0 20px", flexShrink:0 }}>
        {["overview","interviews","schedule","documents"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding:"10px 12px", border:"none", borderBottom:`2px solid ${tab === t ? S.primary : "transparent"}`, background:"transparent", fontSize:11, fontWeight:600, color:tab === t ? S.primary : "#94a3b8", cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", textTransform:"capitalize" }}>{t}</button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:20 }}>
        {tab === "overview" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[{ l:"Current CTC", v:fmt(c.currentCTC) }, { l:"Expected CTC", v:fmt(c.expectedCTC) }, { l:"TA Assigned", v:c.ta }, { l:"Sourced", v:c.sourced }, { l:"Offer Date", v:c.offerDate || "—" }, { l:"Join Date", v:c.joinDate || "—" }].map(({ l, v }) => (
                <div key={l} style={{ background:"#f8fafc", borderRadius:8, padding:"8px 10px" }}><div style={{ fontSize:9, color:"#94a3b8", fontWeight:600, textTransform:"uppercase" }}>{l}</div><div style={{ fontSize:13, fontWeight:700, color:"#0f172a", marginTop:2, fontFamily:"'DM Mono', monospace" }}>{v}</div></div>
              ))}
            </div>
          </div>
        )}
        {tab === "interviews" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[{ round:"Round 1", by:c.r1By, date:c.r1Date, result:c.r1Result }, { round:"Round 2", by:c.r2By, date:c.r2Date, result:c.r2Result }].map(({ round, by, date, result }) => (
              <div key={round} style={{ border:"1px solid #e2e8f0", borderRadius:10, padding:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ fontSize:12, fontWeight:700 }}>{round}</div>
                  {result ? <span style={{ fontSize:11, fontWeight:700, color:result === "Select" ? "#059669" : "#dc2626", background:result === "Select" ? "#d1fae5" : "#fee2e2", padding:"2px 8px", borderRadius:99 }}>{result}</span> : <span style={{ fontSize:10, color:"#94a3b8" }}>Pending</span>}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <div style={{ background:"#f8fafc", borderRadius:7, padding:"7px 10px" }}><div style={{ fontSize:9, color:"#94a3b8", fontWeight:600 }}>INTERVIEWER</div><div style={{ fontSize:12, fontWeight:600, color:"#0f172a", marginTop:2 }}>{by || "—"}</div></div>
                  <div style={{ background:"#f8fafc", borderRadius:7, padding:"7px 10px" }}><div style={{ fontSize:9, color:"#94a3b8", fontWeight:600 }}>DATE</div><div style={{ fontSize:12, fontWeight:600, color:"#0f172a", marginTop:2, fontFamily:"'DM Mono', monospace" }}>{date || "—"}</div></div>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "schedule" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ fontSize:12, color:"#64748b" }}>Schedule an interview slot.</div>
            {[{ l:"Round", opts:["Round 1","Round 2"] }, { l:"Mode", opts:["Virtual","In-Person"] }].map(({ l, opts }) => (<div key={l}><label style={{ fontSize:10, fontWeight:600, color:"#374151" }}>{l}</label><select style={inp}>{opts.map(o => <option key={o}>{o}</option>)}</select></div>))}
            <div><label style={{ fontSize:10, fontWeight:600, color:"#374151" }}>Interviewer</label><select style={inp}>{["Himanshu Jaiswal","Khazim Syed","Bhavesh N","Ankita Kumari","Soundappan Gopal","Lazer Rajan"].map(o => <option key={o}>{o}</option>)}</select></div>
            <div><label style={{ fontSize:10, fontWeight:600, color:"#374151" }}>Date</label><input type="date" style={inp} /></div>
            <div><label style={{ fontSize:10, fontWeight:600, color:"#374151" }}>Time</label><input type="time" style={inp} /></div>
            <button style={{ width:"100%", padding:"9px", borderRadius:8, border:"none", background:S.primary, color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif" }}>Save</button>
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

/* ─── APP ───────────────────────────────────────────────────── */
export default function App() {
  const [bu, setBu] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState(null);

  const reqs = useMemo(() => REQUISITIONS.filter(r => bu === "all" || r.bu === bu), [bu]);
  const cands = useMemo(() => CANDIDATES.filter(c => bu === "all" || c.bu === bu), [bu]);

  const allEvents = useMemo(() => generateEvents(reqs, cands), [reqs, cands]);
  const filteredEvents = useMemo(() => allEvents.filter(e =>
    (cityFilter === "all" || e.city === cityFilter) &&
    (categoryFilter === "all" || EVENT_CONFIG[e.type].category === categoryFilter)
  ), [allEvents, cityFilter, categoryFilter]);

  // Group by date
  const grouped = useMemo(() => {
    const groups = [];
    let currentDate = null;
    filteredEvents.forEach(e => {
      if (e.date !== currentDate) {
        currentDate = e.date;
        groups.push({ date:e.date, label:formatDateHeader(e.date), events:[] });
      }
      groups[groups.length - 1].events.push(e);
    });
    return groups;
  }, [filteredEvents]);

  const cities = [...new Set(REQUISITIONS.map(r => r.city))].sort();

  const metrics = {
    open: reqs.filter(r => r.status !== "Filled").length,
    inPipe: cands.length,
    offers: cands.filter(c => ["Offered","Joined"].includes(c.stage)).length,
    joins: cands.filter(c => c.stage === "Joined").length,
  };

  const CATEGORIES = [
    { id:"all", label:"All Events" },
    { id:"requisitions", label:"Requisitions" },
    { id:"candidates", label:"Candidates" },
    { id:"interviews", label:"Interviews" },
    { id:"offers", label:"Offers & Joins" },
  ];

  return (
    <>
      <GlobalStyle />
      <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"#f8fafc", overflow:"hidden" }}>
        {/* Header */}
        <div style={{ height:56, background:"#fff", borderBottom:"1px solid #e2e8f0", display:"flex", alignItems:"center", padding:"0 20px", gap:16, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <img src="https://carepalmoney.com/assets/img/carepal-logo.png" alt="CarePal" style={{ height:22, objectFit:"contain" }}
              onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="block"; }} />
            <div style={{ display:"none", fontWeight:800, fontSize:14, color:"#0f172a" }}>CarePal</div>
            <span style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:"0.08em", textTransform:"uppercase" }}>HR</span>
          </div>
          <div style={{ width:1, height:28, background:"#e2e8f0" }} />
          <div style={{ display:"flex", background:"#f1f5f9", borderRadius:8, padding:2, gap:1 }}>
            {[["all","All"],["CPM","CPM"],["IGIV","IGIV"]].map(([v, l]) => (
              <button key={v} onClick={() => setBu(v)} style={{ padding:"4px 10px", borderRadius:6, border:"none", cursor:"pointer", background:bu === v ? "#fff" : "transparent", boxShadow:bu === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none", color:bu === v ? S.primary : "#64748b", fontSize:11, fontWeight:600, fontFamily:"'Plus Jakarta Sans', sans-serif" }}>{l}</button>
            ))}
          </div>
          <div style={{ position:"relative" }}>
            <Search size={12} style={{ position:"absolute", left:8, top:"50%", transform:"translateY(-50%)", color:"#94a3b8" }} />
            <input placeholder="Search events…" style={{ paddingLeft:26, paddingRight:10, paddingTop:6, paddingBottom:6, fontSize:11, border:"1px solid #e2e8f0", borderRadius:7, width:180, outline:"none", fontFamily:"'Plus Jakarta Sans', sans-serif", color:"#374151" }} />
          </div>
          <div style={{ marginLeft:"auto", display:"flex", gap:18 }}>
            {[{ l:"Open", v:metrics.open, c:S.primary }, { l:"Pipe", v:metrics.inPipe, c:"#2563eb" }, { l:"Offers", v:metrics.offers, c:"#d97706" }, { l:"Joins", v:metrics.joins, c:"#059669" }].map(({ l, v, c }) => (
              <div key={l} style={{ display:"flex", alignItems:"baseline", gap:4 }}>
                <span style={{ fontSize:18, fontWeight:800, color:c, fontFamily:"'DM Mono', monospace" }}>{v}</span>
                <span style={{ fontSize:9, fontWeight:600, color:"#94a3b8", textTransform:"uppercase" }}>{l}</span>
              </div>
            ))}
          </div>
          <div style={{ width:1, height:28, background:"#e2e8f0" }} />
          <div style={{ width:30, height:30, borderRadius:"50%", background:S.primary, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:11, fontWeight:700 }}>AK</div>
        </div>

        {/* Filter bar */}
        <div style={{ height:44, background:"#fff", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", padding:"0 20px", gap:8, flexShrink:0 }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setCategoryFilter(cat.id)} style={{
              padding:"5px 12px", borderRadius:99, border:"1px solid", cursor:"pointer",
              borderColor: categoryFilter === cat.id ? S.primary : "#e2e8f0",
              background: categoryFilter === cat.id ? `${S.primary}10` : "#fff",
              color: categoryFilter === cat.id ? S.primary : "#64748b",
              fontSize:11, fontWeight:600, fontFamily:"'Plus Jakarta Sans', sans-serif",
            }}>{cat.label}</button>
          ))}
          <div style={{ width:1, height:20, background:"#e2e8f0", margin:"0 4px" }} />
          <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} style={{ fontSize:11, border:"1px solid #e2e8f0", borderRadius:7, padding:"5px 10px", background:"#fff", cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", color:"#374151", outline:"none" }}>
            <option value="all">All Cities</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span style={{ marginLeft:"auto", fontSize:11, color:"#94a3b8" }}>{filteredEvents.length} events</span>
        </div>

        {/* Main content */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
          {/* Feed */}
          <div style={{ flex:1, overflowY:"auto" }}>
            {grouped.length === 0 && (
              <div style={{ textAlign:"center", padding:"60px 20px", color:"#94a3b8", fontSize:13 }}>No events match your filters</div>
            )}
            {grouped.map(group => (
              <div key={group.date}>
                {/* Date header */}
                <div style={{ position:"sticky", top:0, zIndex:10, padding:"8px 20px", background:"#f1f5f9", borderBottom:"1px solid #e2e8f0" }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.05em" }}>{group.label}</span>
                  <span style={{ fontSize:10, color:"#94a3b8", marginLeft:8 }}>{group.events.length} event{group.events.length !== 1 ? "s" : ""}</span>
                </div>
                {group.events.map((e, i) => (
                  <EventCard key={`${e.type}-${e.date}-${i}`} event={e} onClick={setSelectedEvent}
                    isSelected={selectedEvent && selectedEvent.type === e.type && selectedEvent.date === e.date && selectedEvent.title === e.title} />
                ))}
              </div>
            ))}
          </div>

          {/* Detail panel */}
          {selectedEvent && (
            <div style={{ width:400, borderLeft:"1px solid #e2e8f0", background:"#fff", flexShrink:0, overflow:"hidden" }}>
              <DetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
