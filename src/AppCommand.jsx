import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Plus, Search, X, Phone, Mail, MapPin, Clock, Check,
  FileText, AlertCircle, ChevronRight, Command, ArrowUp, ArrowDown,
  CornerDownLeft, Users, ClipboardList, BarChart3, Zap
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
const STAGE_CLS = { "Sourced":"#64748b", "R1 Scheduled":"#2563eb", "R1 Complete":"#0891b2", "R2 Scheduled":"#7c3aed", "R2 Complete":"#6d28d9", "Offered":"#d97706", "Joined":"#059669" };
const STATUS_CLS = { "Pending Approval":{ bg:"#fef3c7", color:"#92400e", dot:"#f59e0b" }, "Approved":{ bg:"#dbeafe", color:"#1e40af", dot:"#3b82f6" }, "Active":{ bg:"#d1fae5", color:"#065f46", dot:"#10b981" }, "Filled":{ bg:"#f1f5f9", color:"#64748b", dot:"#94a3b8" } };
const fmt = n => n != null ? `₹${(n/1000).toFixed(0)}k` : "—";

/* ─── ATOMS ─────────────────────────────────────────────────── */
function StatusBadge({ status }) { const s = STATUS_CLS[status] || STATUS_CLS["Filled"]; return <span style={{ background:s.bg, color:s.color, display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px", borderRadius:99, fontSize:11, fontWeight:600 }}><span style={{ width:6, height:6, borderRadius:99, background:s.dot, display:"inline-block" }} />{status}</span>; }
function StageBadge({ stage }) { const c = STAGE_CLS[stage] || "#94a3b8"; return <span style={{ background:`${c}18`, color:c, padding:"2px 8px", borderRadius:99, fontSize:11, fontWeight:600 }}>{stage}</span>; }
function BUBadge({ bu }) { return <span style={{ background: bu === "CPM" ? "#dbeafe" : "#ede9fe", color: bu === "CPM" ? "#1e40af" : "#5b21b6", padding:"2px 8px", borderRadius:99, fontSize:11, fontWeight:600 }}>{bu === "CPM" ? "CPM" : "IGIV"}</span>; }
function Th({ children }) { return <th style={{ padding:"9px 10px", textAlign:"left", fontSize:11, fontWeight:600, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.03em", whiteSpace:"nowrap" }}>{children}</th>; }
function Td({ children, style }) { return <td style={{ padding:"10px 10px", fontSize:13, borderBottom:"1px solid #f1f5f9", verticalAlign:"middle", ...style }}>{children}</td>; }

/* ─── COMMAND PALETTE ──────────────────────────────────────── */
function CommandPalette({ onClose, onSelectCandidate, onSelectReq, onAction }) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const q = query.toLowerCase().trim();

  const candidateResults = useMemo(() => {
    if (!q) return CANDIDATES.slice(0, 5);
    return CANDIDATES.filter(c =>
      c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) || c.stage.toLowerCase().includes(q) ||
      c.ta.toLowerCase().includes(q) || c.reqId.toLowerCase().includes(q)
    );
  }, [q]);

  const reqResults = useMemo(() => {
    if (!q) return REQUISITIONS.filter(r => r.status !== "Filled").slice(0, 4);
    return REQUISITIONS.filter(r =>
      r.id.toLowerCase().includes(q) || r.city.toLowerCase().includes(q) ||
      (r.hospital || "").toLowerCase().includes(q) || r.bdType.toLowerCase().includes(q) ||
      r.bu.toLowerCase().includes(q) || r.status.toLowerCase().includes(q)
    );
  }, [q]);

  const actions = useMemo(() => {
    const all = [
      { id:"new_req", label:"New Requisition", desc:"Create a new hiring request", icon:Plus },
      { id:"headcount", label:"View Headcount", desc:"Target vs active by city", icon:BarChart3 },
      { id:"all_candidates", label:"View All Candidates", desc:"Browse full candidate list", icon:Users },
      { id:"pending", label:"Pending Approvals", desc:`${REQUISITIONS.filter(r=>r.status==="Pending Approval").length} awaiting approval`, icon:AlertCircle },
    ];
    if (!q) return all;
    return all.filter(a => a.label.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q));
  }, [q]);

  // Flat list for keyboard navigation
  const flatItems = useMemo(() => {
    const items = [];
    candidateResults.forEach(c => items.push({ type:"candidate", data:c }));
    reqResults.forEach(r => items.push({ type:"req", data:r }));
    actions.forEach(a => items.push({ type:"action", data:a }));
    return items;
  }, [candidateResults, reqResults, actions]);

  useEffect(() => { setSelectedIdx(0); }, [query]);

  const handleSelect = useCallback((item) => {
    if (item.type === "candidate") { onSelectCandidate(item.data); onClose(); }
    else if (item.type === "req") { onSelectReq(item.data); onClose(); }
    else if (item.type === "action") { onAction(item.data.id); onClose(); }
  }, [onSelectCandidate, onSelectReq, onAction, onClose]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, flatItems.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && flatItems[selectedIdx]) { e.preventDefault(); handleSelect(flatItems[selectedIdx]); }
    else if (e.key === "Escape") { onClose(); }
  };

  let itemIdx = -1;
  const renderItem = (item) => {
    itemIdx++;
    const idx = itemIdx;
    const isSelected = idx === selectedIdx;
    return { isSelected, idx };
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"flex-start", justifyContent:"center", paddingTop:80 }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:16, width:560, maxHeight:"70vh", boxShadow:"0 25px 60px rgba(0,0,0,0.25)", overflow:"hidden", display:"flex", flexDirection:"column" }} onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div style={{ display:"flex", alignItems:"center", padding:"14px 18px", borderBottom:"1px solid #f1f5f9", gap:10 }}>
          <Search size={16} color="#94a3b8" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Search candidates, requisitions, or type a command..."
            style={{ flex:1, border:"none", outline:"none", fontSize:15, fontWeight:500, fontFamily:"'Plus Jakarta Sans', sans-serif", color:"#0f172a" }}
          />
          <div style={{ display:"flex", gap:4, alignItems:"center" }}>
            <kbd style={{ padding:"2px 6px", background:"#f1f5f9", borderRadius:4, fontSize:10, color:"#94a3b8", border:"1px solid #e2e8f0" }}>ESC</kbd>
          </div>
        </div>

        {/* Results */}
        <div style={{ flex:1, overflowY:"auto", padding:"8px 0" }}>
          {flatItems.length === 0 && (
            <div style={{ padding:"30px 20px", textAlign:"center", color:"#94a3b8", fontSize:13 }}>No results for "{query}"</div>
          )}

          {/* Candidates */}
          {candidateResults.length > 0 && (
            <>
              <div style={{ padding:"6px 18px 4px", fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:"0.08em", textTransform:"uppercase" }}>Candidates</div>
              {candidateResults.map(c => {
                const { isSelected, idx } = renderItem({ type:"candidate", data:c });
                return (
                  <div key={c.id} onClick={() => handleSelect({ type:"candidate", data:c })}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    style={{
                      display:"flex", alignItems:"center", padding:"8px 18px", cursor:"pointer", gap:12,
                      background: isSelected ? `${S.primary}08` : "transparent",
                      borderLeft: isSelected ? `3px solid ${S.primary}` : "3px solid transparent",
                    }}>
                    <div style={{ width:32, height:32, borderRadius:"50%", background:STAGE_CLS[c.stage] || "#94a3b8", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:11, fontWeight:700, flexShrink:0 }}>
                      {c.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>{c.name}</div>
                      <div style={{ fontSize:11, color:"#64748b" }}>{c.currentRole} · {c.company} · {c.city}</div>
                    </div>
                    <StageBadge stage={c.stage} />
                    {isSelected && <CornerDownLeft size={12} color="#94a3b8" />}
                  </div>
                );
              })}
            </>
          )}

          {/* Requisitions */}
          {reqResults.length > 0 && (
            <>
              <div style={{ padding:"10px 18px 4px", fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:"0.08em", textTransform:"uppercase" }}>Requisitions</div>
              {reqResults.map(r => {
                const { isSelected, idx } = renderItem({ type:"req", data:r });
                return (
                  <div key={r.id} onClick={() => handleSelect({ type:"req", data:r })}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    style={{
                      display:"flex", alignItems:"center", padding:"8px 18px", cursor:"pointer", gap:12,
                      background: isSelected ? `${S.primary}08` : "transparent",
                      borderLeft: isSelected ? `3px solid ${S.primary}` : "3px solid transparent",
                    }}>
                    <div style={{ width:32, height:32, borderRadius:8, background:"#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <ClipboardList size={14} color="#64748b" />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>{r.id} · {r.city} · {r.bdType} BD</div>
                      <div style={{ fontSize:11, color:"#64748b" }}>{r.hospital || "Hospital TBD"} · {r.hireType}</div>
                    </div>
                    <StatusBadge status={r.status} />
                    {isSelected && <CornerDownLeft size={12} color="#94a3b8" />}
                  </div>
                );
              })}
            </>
          )}

          {/* Actions */}
          {actions.length > 0 && (
            <>
              <div style={{ padding:"10px 18px 4px", fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:"0.08em", textTransform:"uppercase" }}>Actions</div>
              {actions.map(a => {
                const { isSelected, idx } = renderItem({ type:"action", data:a });
                const Icon = a.icon;
                return (
                  <div key={a.id} onClick={() => handleSelect({ type:"action", data:a })}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    style={{
                      display:"flex", alignItems:"center", padding:"8px 18px", cursor:"pointer", gap:12,
                      background: isSelected ? `${S.primary}08` : "transparent",
                      borderLeft: isSelected ? `3px solid ${S.primary}` : "3px solid transparent",
                    }}>
                    <div style={{ width:32, height:32, borderRadius:8, background:`${S.primary}10`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <Icon size={14} color={S.primary} />
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>{a.label}</div>
                      <div style={{ fontSize:11, color:"#64748b" }}>{a.desc}</div>
                    </div>
                    {isSelected && <CornerDownLeft size={12} color="#94a3b8" />}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:"8px 18px", borderTop:"1px solid #f1f5f9", display:"flex", gap:12, alignItems:"center" }}>
          <div style={{ display:"flex", gap:4, alignItems:"center" }}><ArrowUp size={10} color="#94a3b8" /><ArrowDown size={10} color="#94a3b8" /><span style={{ fontSize:10, color:"#94a3b8" }}>navigate</span></div>
          <div style={{ display:"flex", gap:4, alignItems:"center" }}><CornerDownLeft size={10} color="#94a3b8" /><span style={{ fontSize:10, color:"#94a3b8" }}>select</span></div>
          <div style={{ display:"flex", gap:4, alignItems:"center" }}><kbd style={{ padding:"1px 4px", background:"#f1f5f9", borderRadius:3, fontSize:9, color:"#94a3b8", border:"1px solid #e2e8f0" }}>esc</kbd><span style={{ fontSize:10, color:"#94a3b8" }}>close</span></div>
        </div>
      </div>
    </div>
  );
}

/* ─── CANDIDATE PANEL ──────────────────────────────────────── */
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
            <div style={{ display:"flex", gap:6, marginTop:8 }}><StageBadge stage={c.stage} /><BUBadge bu={c.bu} />{req && <span style={{ fontSize:11, color:"#94a3b8", padding:"2px 0" }}>{req.id}</span>}</div>
          </div>
          <button style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8" }} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginTop:12 }}>
          {[{ icon:Phone, l:"Phone", v:c.phone }, { icon:Mail, l:"Email", v:c.email||"—" }, { icon:MapPin, l:"City", v:c.city }, { icon:Clock, l:"Notice", v:c.notice||"—" }].map(({ icon:Icon, l, v }) => (
            <div key={l} style={{ display:"flex", gap:6 }}><Icon size={11} color="#94a3b8" style={{ marginTop:2 }} /><div><div style={{ fontSize:9, color:"#94a3b8", fontWeight:600 }}>{l}</div><div style={{ fontSize:11, fontWeight:600, color:"#0f172a", marginTop:1 }}>{v}</div></div></div>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", borderBottom:"1px solid #f1f5f9", padding:"0 20px", flexShrink:0 }}>
        {["overview","interviews","documents"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding:"10px 12px", border:"none", borderBottom:`2px solid ${tab === t ? S.primary : "transparent"}`, background:"transparent", fontSize:11, fontWeight:600, color:tab === t ? S.primary : "#94a3b8", cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", textTransform:"capitalize" }}>{t}</button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:20 }}>
        {tab === "overview" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {[{ l:"Current CTC", v:fmt(c.currentCTC) }, { l:"Expected CTC", v:fmt(c.expectedCTC) }, { l:"TA", v:c.ta }, { l:"Sourced", v:c.sourced }, { l:"Offer Date", v:c.offerDate||"—" }, { l:"Join Date", v:c.joinDate||"—" }].map(({ l, v }) => (
              <div key={l} style={{ background:"#f8fafc", borderRadius:8, padding:"8px 10px" }}><div style={{ fontSize:9, color:"#94a3b8", fontWeight:600, textTransform:"uppercase" }}>{l}</div><div style={{ fontSize:13, fontWeight:700, color:"#0f172a", marginTop:2, fontFamily:"'DM Mono', monospace" }}>{v}</div></div>
            ))}
          </div>
        )}
        {tab === "interviews" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[{ round:"Round 1", by:c.r1By, date:c.r1Date, result:c.r1Result }, { round:"Round 2", by:c.r2By, date:c.r2Date, result:c.r2Result }].map(({ round, by, date, result }) => (
              <div key={round} style={{ border:"1px solid #e2e8f0", borderRadius:10, padding:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}><span style={{ fontSize:12, fontWeight:700 }}>{round}</span>{result ? <span style={{ fontSize:11, fontWeight:700, color:result === "Select" ? "#059669" : "#dc2626", background:result === "Select" ? "#d1fae5" : "#fee2e2", padding:"2px 8px", borderRadius:99 }}>{result}</span> : <span style={{ fontSize:10, color:"#94a3b8" }}>Pending</span>}</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <div style={{ background:"#f8fafc", borderRadius:7, padding:"7px 10px" }}><div style={{ fontSize:9, color:"#94a3b8", fontWeight:600 }}>INTERVIEWER</div><div style={{ fontSize:12, fontWeight:600, marginTop:2 }}>{by||"—"}</div></div>
                  <div style={{ background:"#f8fafc", borderRadius:7, padding:"7px 10px" }}><div style={{ fontSize:9, color:"#94a3b8", fontWeight:600 }}>DATE</div><div style={{ fontSize:12, fontWeight:600, marginTop:2, fontFamily:"'DM Mono', monospace" }}>{date||"—"}</div></div>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "documents" && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {["Resume / CV","Offer Letter","ID Proof","Relieving Letter"].map(doc => (
              <div key={doc} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 12px", border:"1px solid #e2e8f0", borderRadius:9 }}>
                <div style={{ display:"flex", alignItems:"center", gap:7 }}><FileText size={13} color="#94a3b8" /><span style={{ fontSize:11, color:"#374151" }}>{doc}</span></div>
                <button style={{ fontSize:10, fontWeight:600, color:S.primary, background:"transparent", border:`1px solid ${S.primary}40`, borderRadius:6, padding:"3px 8px", cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif" }}>Upload</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── HEADCOUNT PANEL ──────────────────────────────────────── */
function HeadcountPanel({ onClose }) {
  const hcRows = useMemo(() => {
    const cities = [...new Set(HEADCOUNT.map(h => h.city))];
    return cities.map(city => {
      const cr = HEADCOUNT.filter(h => h.city === city);
      const aop = cr.reduce((s,r) => s+r.aop,0), active = cr.reduce((s,r) => s+r.active,0);
      const notice = cr.reduce((s,r) => s+r.notice,0), pip = cr.reduce((s,r) => s+r.pip,0);
      const offered = cr.reduce((s,r) => s+r.offered,0);
      return { city, aop, active, notice, pip, offered, deficit:aop-active-offered };
    });
  }, []);
  return (
    <div style={{ position:"fixed", top:0, right:0, bottom:0, width:480, zIndex:50, background:"#fff", boxShadow:"-8px 0 40px rgba(0,0,0,0.12)", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"18px 20px", borderBottom:"1px solid #f1f5f9", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
        <div style={{ fontSize:16, fontWeight:800, color:"#0f172a" }}>Headcount Overview</div>
        <button style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8" }} onClick={onClose}><X size={18} /></button>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"0 20px 20px" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead style={{ background:"#f8fafc", position:"sticky", top:0 }}><tr>{["City","Target","Active","Notice","PIP","Offered","Deficit"].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
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
            <div><label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Business Unit *</label><select value={form.bu} onChange={e => set("bu",e.target.value)} style={inp}><option value="CPM">CPM</option><option value="IGIV">IGIV</option></select></div>
            <div><label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Hire Type *</label><select value={form.hireType} onChange={e => set("hireType",e.target.value)} style={inp}><option value="New">New</option><option value="Replacement">Replacement</option></select></div>
            <div><label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>City *</label><select value={form.city} onChange={e => set("city",e.target.value)} style={inp}><option value="">Select…</option>{["Ahmedabad","Bangalore","Chennai","Delhi","Hyderabad","Kolkata","Mumbai","Pune"].map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>BD Type *</label><select value={form.bdType} onChange={e => set("bdType",e.target.value)} style={inp}><option value="Focus">Focus</option><option value="Floater">Floater</option></select></div>
            <div><label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Hospital</label><input value={form.hospital} onChange={e => set("hospital",e.target.value)} style={inp} /></div>
            <div><label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Area</label><input value={form.area} onChange={e => set("area",e.target.value)} style={inp} /></div>
          </div>
          <div><label style={{ fontSize:11, fontWeight:600, color:"#374151" }}>Notes</label><textarea value={form.notes} onChange={e => set("notes",e.target.value)} rows={2} style={{ ...inp, resize:"none" }} /></div>
        </div>
        <div style={{ padding:"16px 24px", borderTop:"1px solid #f1f5f9", display:"flex", justifyContent:"flex-end", gap:10 }}>
          <button onClick={onClose} style={{ padding:"9px 16px", borderRadius:9, border:"1px solid #e2e8f0", background:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", color:"#64748b", fontFamily:"'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button style={{ padding:"9px 18px", borderRadius:9, border:"none", background:S.primary, color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif" }}>Submit</button>
        </div>
      </div>
    </div>
  );
}

/* ─── APP ───────────────────────────────────────────────────── */
export default function App() {
  const [showPalette, setShowPalette] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [selectedReq, setSelectedReq] = useState(null);
  const [showHeadcount, setShowHeadcount] = useState(false);
  const [showNewReq, setShowNewReq] = useState(false);
  const [showAllCandidates, setShowAllCandidates] = useState(false);

  // Ctrl+K handler
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setShowPalette(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const openReqs = REQUISITIONS.filter(r => r.status !== "Filled");
  const pendingReqs = REQUISITIONS.filter(r => r.status === "Pending Approval");
  const metrics = {
    open: openReqs.length,
    inPipe: CANDIDATES.length,
    offers: CANDIDATES.filter(c => ["Offered","Joined"].includes(c.stage)).length,
    joins: CANDIDATES.filter(c => c.stage === "Joined").length,
  };

  // Recent events
  const recentEvents = useMemo(() => {
    const events = [];
    CANDIDATES.forEach(c => {
      const req = REQUISITIONS.find(r => r.id === c.reqId);
      events.push({ date:c.sourced, label:`${c.name} sourced`, detail:`${c.city} · ${c.company}`, color:"#64748b", candidate:c });
      if (c.offerDate) events.push({ date:c.offerDate, label:`Offer to ${c.name}`, detail:`${c.city}`, color:"#d97706", candidate:c });
      if (c.joinDate) events.push({ date:c.joinDate, label:`${c.name} joined`, detail:`${c.city}`, color:"#059669", candidate:c });
    });
    REQUISITIONS.forEach(r => {
      events.push({ date:r.date, label:`${r.id} raised`, detail:`${r.city} · ${r.bdType} BD`, color:"#f59e0b", req:r });
    });
    events.sort((a, b) => b.date.localeCompare(a.date));
    return events.slice(0, 10);
  }, []);

  // Upcoming interviews
  const upcomingInterviews = CANDIDATES.filter(c => c.stage === "R1 Scheduled" || c.stage === "R2 Scheduled");

  const handleAction = (actionId) => {
    if (actionId === "new_req") setShowNewReq(true);
    else if (actionId === "headcount") setShowHeadcount(true);
    else if (actionId === "all_candidates") setShowAllCandidates(true);
    else if (actionId === "pending") {} // could open a filtered view
  };

  return (
    <>
      <GlobalStyle />
      <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"#f8fafc", overflow:"hidden" }}>
        {/* Minimal header */}
        <div style={{ height:56, background:"#fff", borderBottom:"1px solid #e2e8f0", display:"flex", alignItems:"center", padding:"0 24px", gap:16, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <img src="https://carepalmoney.com/assets/img/carepal-logo.png" alt="CarePal" style={{ height:22, objectFit:"contain" }} onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="block"; }} />
            <div style={{ display:"none", fontWeight:800, fontSize:14, color:"#0f172a" }}>CarePal</div>
            <span style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:"0.08em", textTransform:"uppercase" }}>HR</span>
          </div>

          {/* Search trigger */}
          <div onClick={() => setShowPalette(true)} style={{
            flex:1, maxWidth:480, marginLeft:20, display:"flex", alignItems:"center", gap:8,
            padding:"7px 14px", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10,
            cursor:"pointer", transition:"border-color 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#94a3b8"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "#e2e8f0"}
          >
            <Search size={14} color="#94a3b8" />
            <span style={{ fontSize:13, color:"#94a3b8", flex:1 }}>Search anything...</span>
            <kbd style={{ padding:"2px 8px", background:"#fff", borderRadius:5, fontSize:11, color:"#94a3b8", border:"1px solid #e2e8f0", fontFamily:"'DM Mono', monospace" }}>Ctrl K</kbd>
          </div>

          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:32, height:32, borderRadius:"50%", background:S.primary, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:12, fontWeight:700 }}>AK</div>
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:"#0f172a" }}>Akhlaque Khan</div>
              <div style={{ fontSize:9, color:"#94a3b8" }}>TA Lead</div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex:1, overflowY:"auto", padding:24, maxWidth:900, margin:"0 auto", width:"100%" }}>
          {/* Big metrics */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:28 }}>
            {[
              { label:"Open Positions", value:metrics.open, color:S.primary },
              { label:"In Pipeline", value:metrics.inPipe, color:"#2563eb" },
              { label:"Offers Extended", value:metrics.offers, color:"#d97706" },
              { label:"Confirmed Joins", value:metrics.joins, color:"#059669" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", padding:"24px 20px", textAlign:"center" }}>
                <div style={{ fontSize:40, fontWeight:800, color, fontFamily:"'DM Mono', monospace", lineHeight:1 }}>{value}</div>
                <div style={{ fontSize:12, fontWeight:600, color:"#64748b", marginTop:8 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            {/* Recent Activity */}
            <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", overflow:"hidden" }}>
              <div style={{ padding:"16px 20px", borderBottom:"1px solid #f1f5f9" }}>
                <span style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>Recent Activity</span>
              </div>
              <div style={{ maxHeight:360, overflowY:"auto" }}>
                {recentEvents.map((e, i) => (
                  <div key={i} onClick={() => { if (e.candidate) setSelectedCandidate(e.candidate); else if (e.req) setSelectedReq(e.req); }}
                    style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"10px 20px", cursor:"pointer", borderBottom:"1px solid #fafafa" }}
                    onMouseEnter={ev => ev.currentTarget.style.background = "#fafafa"}
                    onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ width:8, height:8, borderRadius:99, background:e.color, marginTop:5, flexShrink:0 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:"#0f172a" }}>{e.label}</div>
                      <div style={{ fontSize:11, color:"#94a3b8" }}>{e.detail}</div>
                    </div>
                    <span style={{ fontSize:10, color:"#cbd5e1", flexShrink:0, fontFamily:"'DM Mono', monospace" }}>{e.date}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Needs Attention */}
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {/* Pending approvals */}
              <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", overflow:"hidden" }}>
                <div style={{ padding:"16px 20px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", gap:8 }}>
                  <Zap size={14} color="#f59e0b" />
                  <span style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>Needs Attention</span>
                </div>
                <div style={{ padding:"12px 20px", display:"flex", flexDirection:"column", gap:10 }}>
                  {pendingReqs.length > 0 && (
                    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"#fffbeb", borderRadius:10, border:"1px solid #fde68a" }}>
                      <AlertCircle size={14} color="#f59e0b" />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:"#92400e" }}>{pendingReqs.length} pending approval{pendingReqs.length !== 1 ? "s" : ""}</div>
                        <div style={{ fontSize:11, color:"#b45309", marginTop:1 }}>{pendingReqs.map(r => r.city).join(", ")}</div>
                      </div>
                    </div>
                  )}
                  {upcomingInterviews.length > 0 && (
                    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"#eff6ff", borderRadius:10, border:"1px solid #bfdbfe" }}>
                      <Clock size={14} color="#2563eb" />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:"#1e40af" }}>{upcomingInterviews.length} interview{upcomingInterviews.length !== 1 ? "s" : ""} scheduled</div>
                        <div style={{ fontSize:11, color:"#3b82f6", marginTop:1 }}>{upcomingInterviews.map(c => c.name).join(", ")}</div>
                      </div>
                    </div>
                  )}
                  {CANDIDATES.filter(c => c.stage === "Offered").length > 0 && (
                    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"#fffbeb", borderRadius:10, border:"1px solid #fde68a" }}>
                      <Check size={14} color="#d97706" />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:"#92400e" }}>{CANDIDATES.filter(c => c.stage === "Offered").length} offer{CANDIDATES.filter(c => c.stage === "Offered").length !== 1 ? "s" : ""} awaiting acceptance</div>
                        <div style={{ fontSize:11, color:"#b45309", marginTop:1 }}>{CANDIDATES.filter(c => c.stage === "Offered").map(c => c.name).join(", ")}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick tip */}
              <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", padding:"16px 20px" }}>
                <div style={{ fontSize:12, fontWeight:600, color:"#0f172a", marginBottom:6 }}>Quick tip</div>
                <div style={{ fontSize:12, color:"#64748b", lineHeight:1.5 }}>
                  Press <kbd style={{ padding:"1px 6px", background:"#f1f5f9", borderRadius:4, fontSize:11, color:"#374151", border:"1px solid #e2e8f0", fontFamily:"'DM Mono', monospace" }}>Ctrl K</kbd> to search candidates, requisitions, or trigger actions from anywhere.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overlays */}
      {showPalette && (
        <CommandPalette
          onClose={() => setShowPalette(false)}
          onSelectCandidate={setSelectedCandidate}
          onSelectReq={setSelectedReq}
          onAction={handleAction}
        />
      )}
      {selectedCandidate && <CandidatePanel c={selectedCandidate} onClose={() => setSelectedCandidate(null)} />}
      {showHeadcount && <HeadcountPanel onClose={() => setShowHeadcount(false)} />}
      {showNewReq && <NewReqModal onClose={() => setShowNewReq(false)} />}

      {/* Req detail panel */}
      {selectedReq && (
        <div style={{ position:"fixed", top:0, right:0, bottom:0, width:400, zIndex:50, background:"#fff", boxShadow:"-8px 0 40px rgba(0,0,0,0.12)", display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"18px 20px", borderBottom:"1px solid #f1f5f9", flexShrink:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:11, color:"#94a3b8", fontWeight:600 }}>{selectedReq.id}</div>
                <div style={{ fontSize:18, fontWeight:800, color:"#0f172a", marginTop:2 }}>{selectedReq.city} · {selectedReq.bdType} BD</div>
                <div style={{ display:"flex", gap:6, marginTop:8 }}><StatusBadge status={selectedReq.status} /><BUBadge bu={selectedReq.bu} /></div>
              </div>
              <button style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8" }} onClick={() => setSelectedReq(null)}><X size={18} /></button>
            </div>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[{ l:"Hospital", v:selectedReq.hospital||"—" }, { l:"Area", v:selectedReq.area||"—" }, { l:"Hire Type", v:selectedReq.hireType }, { l:"Replacing", v:selectedReq.replacementFor||"—" }, { l:"Raised By", v:selectedReq.raisedBy }, { l:"Date", v:selectedReq.date }].map(({ l, v }) => (
                <div key={l} style={{ background:"#f8fafc", borderRadius:8, padding:"8px 10px" }}><div style={{ fontSize:9, color:"#94a3b8", fontWeight:600, textTransform:"uppercase" }}>{l}</div><div style={{ fontSize:13, fontWeight:600, color:"#0f172a", marginTop:2 }}>{v}</div></div>
              ))}
            </div>
            {selectedReq.notes && <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8, padding:"8px 12px", fontSize:11, color:"#92400e" }}><strong>Note:</strong> {selectedReq.notes}</div>}
            <div style={{ borderTop:"1px solid #f1f5f9", paddingTop:12 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>Candidates</div>
              {CANDIDATES.filter(c => c.reqId === selectedReq.id).length === 0
                ? <div style={{ fontSize:12, color:"#94a3b8" }}>No candidates yet</div>
                : CANDIDATES.filter(c => c.reqId === selectedReq.id).map(c => (
                  <div key={c.id} onClick={() => { setSelectedReq(null); setSelectedCandidate(c); }} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #f8fafc", cursor:"pointer" }}>
                    <div><div style={{ fontSize:12, fontWeight:600, color:"#0f172a" }}>{c.name}</div><div style={{ fontSize:11, color:"#64748b" }}>{c.ta} · {c.sourced}</div></div>
                    <StageBadge stage={c.stage} />
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}
    </>
  );
}
