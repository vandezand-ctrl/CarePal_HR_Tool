import { useState, useMemo } from "react";
import {
  Plus, Search, X, ChevronLeft, Phone, Mail, MapPin, Clock,
  Check, FileText, AlertCircle, UserPlus, ArrowRight
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

/* ─── STYLE HELPERS ────────────────────────────────────────── */
const S = { primary: "#0d9488" };
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
  return <span style={{ background:s.bg, color:s.color, display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px", borderRadius:99, fontSize:11, fontWeight:600 }}><span style={{ width:6, height:6, borderRadius:99, background:s.dot, display:"inline-block" }} />{status}</span>;
}
function StageBadge({ stage }) {
  const c = STAGE_CLS[stage] || "#94a3b8";
  return <span style={{ background:`${c}18`, color:c, padding:"2px 8px", borderRadius:99, fontSize:11, fontWeight:600 }}>{stage}</span>;
}
function BUBadge({ bu }) {
  return <span style={{ background: bu === "CPM" ? "#dbeafe" : "#ede9fe", color: bu === "CPM" ? "#1e40af" : "#5b21b6", padding:"2px 8px", borderRadius:99, fontSize:11, fontWeight:600 }}>{bu === "CPM" ? "CPM" : "IGIV"}</span>;
}

/* ─── POSITION CARD ────────────────────────────────────────── */
function PositionCard({ req, candidates, onClick }) {
  const maxStageIdx = candidates.length > 0
    ? Math.max(...candidates.map(c => STAGES.indexOf(c.stage)))
    : -1;
  const progress = candidates.length > 0 ? ((maxStageIdx + 1) / STAGES.length) * 100 : 0;
  const furthestStage = maxStageIdx >= 0 ? STAGES[maxStageIdx] : "No candidates";
  const stageColor = STAGE_CLS[furthestStage] || "#94a3b8";

  return (
    <div onClick={onClick} style={{
      background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", padding:"20px",
      cursor:"pointer", transition:"all 0.15s", display:"flex", flexDirection:"column", gap:12,
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; e.currentTarget.style.borderColor = S.primary; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
    >
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:S.primary }}>{req.id}</div>
          <div style={{ fontSize:16, fontWeight:800, color:"#0f172a", marginTop:2 }}>{req.city}</div>
          <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>{req.hospital || "Hospital TBD"}</div>
        </div>
        <StatusBadge status={req.status} />
      </div>

      <div style={{ display:"flex", gap:6 }}>
        <BUBadge bu={req.bu} />
        <span style={{ fontSize:11, color:"#374151", padding:"2px 8px", background:"#f1f5f9", borderRadius:99 }}>{req.bdType} BD</span>
        <span style={{ fontSize:11, color:"#374151", padding:"2px 8px", background:"#f1f5f9", borderRadius:99 }}>{req.hireType}</span>
      </div>

      {/* Progress bar */}
      <div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
          <span style={{ fontSize:10, fontWeight:600, color:stageColor }}>{furthestStage}</span>
          <span style={{ fontSize:10, color:"#94a3b8" }}>{candidates.length} candidate{candidates.length !== 1 ? "s" : ""}</span>
        </div>
        <div style={{ height:6, background:"#f1f5f9", borderRadius:99, overflow:"hidden" }}>
          <div style={{ height:6, borderRadius:99, background:`linear-gradient(90deg, ${S.primary}, #14b8a6)`, width:`${Math.max(3, progress)}%`, transition:"width 0.3s" }} />
        </div>
      </div>

      {/* Candidate avatars */}
      {candidates.length > 0 && (
        <div style={{ display:"flex", gap:-4, alignItems:"center" }}>
          {candidates.slice(0, 4).map((c, i) => (
            <div key={c.id} style={{
              width:28, height:28, borderRadius:"50%", background:STAGE_CLS[c.stage] || "#94a3b8",
              display:"flex", alignItems:"center", justifyContent:"center",
              color:"#fff", fontSize:10, fontWeight:700, border:"2px solid #fff",
              marginLeft: i > 0 ? -6 : 0, zIndex:candidates.length - i,
            }}>
              {c.name.split(" ").map(n => n[0]).join("")}
            </div>
          ))}
          {candidates.length > 4 && <span style={{ fontSize:10, color:"#94a3b8", marginLeft:4 }}>+{candidates.length - 4}</span>}
        </div>
      )}
    </div>
  );
}

/* ─── WIZARD STEPPER ───────────────────────────────────────── */
function WizardStepper({ activeStep, candidatesByStage }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:0, padding:"0 20px", overflowX:"auto" }}>
      {STAGES.map((stage, i) => {
        const count = candidatesByStage[stage]?.length || 0;
        const isActive = i === activeStep;
        const isPast = i < activeStep;
        const color = STAGE_CLS[stage];

        return (
          <div key={stage} style={{ display:"flex", alignItems:"center", flex:1, minWidth:0 }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, flex:"0 0 auto" }}>
              {/* Circle */}
              <div style={{
                width:30, height:30, borderRadius:"50%",
                background: isPast ? "#d1fae5" : isActive ? color : "#f1f5f9",
                border: isActive ? `2px solid ${color}` : "2px solid transparent",
                display:"flex", alignItems:"center", justifyContent:"center",
                transition:"all 0.2s",
              }}>
                {isPast ? <Check size={13} color="#059669" /> : (
                  <span style={{ fontSize:11, fontWeight:700, color: isActive ? "#fff" : "#94a3b8" }}>{i + 1}</span>
                )}
              </div>
              {/* Label */}
              <div style={{ fontSize:10, fontWeight: isActive ? 700 : 500, color: isActive ? color : "#94a3b8", whiteSpace:"nowrap", textAlign:"center" }}>
                {stage}
              </div>
              {/* Count */}
              {count > 0 && (
                <span style={{ fontSize:9, fontWeight:700, background:`${color}15`, color, borderRadius:99, padding:"1px 6px" }}>{count}</span>
              )}
            </div>
            {/* Connector line */}
            {i < STAGES.length - 1 && (
              <div style={{ flex:1, height:2, background: isPast ? "#10b981" : "#e2e8f0", margin:"0 4px", minWidth:12, alignSelf:"flex-start", marginTop:14 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── STEP CONTENT ─────────────────────────────────────────── */
function StepContent({ stage, candidates, onSelectCandidate }) {
  const inp = { width:"100%", marginTop:4, fontSize:12, border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 10px", outline:"none", fontFamily:"'Plus Jakarta Sans', sans-serif", color:"#374151" };

  const stageIdx = STAGES.indexOf(stage);
  // Candidates AT this stage
  const atStage = candidates.filter(c => c.stage === stage);
  // Candidates at earlier stages (not yet here)
  const earlier = candidates.filter(c => STAGES.indexOf(c.stage) < stageIdx);
  // Candidates past this stage
  const later = candidates.filter(c => STAGES.indexOf(c.stage) > stageIdx);

  const descriptions = {
    "Sourced": "Candidates identified by the TA team. Add new candidates or move them to R1 scheduling.",
    "R1 Scheduled": "Round 1 interviews are scheduled. Assign interviewers and set dates.",
    "R1 Complete": "Round 1 results are in. Record Select or Reject for each candidate.",
    "R2 Scheduled": "Round 2 interviews are scheduled with Regional Heads.",
    "R2 Complete": "Round 2 results are in. Candidates who pass move to the offer stage.",
    "Offered": "Offer letters have been extended. Track acceptance and joining dates.",
    "Joined": "Candidates who have started. Position filled!",
  };

  return (
    <div style={{ padding:"24px", display:"flex", flexDirection:"column", gap:16 }}>
      <div>
        <div style={{ fontSize:16, fontWeight:800, color:"#0f172a" }}>{stage}</div>
        <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>{descriptions[stage]}</div>
      </div>

      {/* Candidates at this stage */}
      {atStage.length > 0 && (
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>
            At this stage ({atStage.length})
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {atStage.map(c => (
              <div key={c.id} onClick={() => onSelectCandidate(c)} style={{
                background:"#fff", border:`1px solid ${STAGE_CLS[stage]}30`, borderLeft:`4px solid ${STAGE_CLS[stage]}`,
                borderRadius:10, padding:"14px 16px", cursor:"pointer", transition:"box-shadow 0.15s",
              }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.06)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
              >
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>{c.name}</div>
                    <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>{c.currentRole} · {c.company}</div>
                    <div style={{ display:"flex", gap:8, marginTop:6, alignItems:"center" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:3 }}><MapPin size={10} color="#94a3b8" /><span style={{ fontSize:10, color:"#94a3b8" }}>{c.city}</span></div>
                      {c.notice && <span style={{ fontSize:10, color:S.primary, fontWeight:600 }}>NP: {c.notice}</span>}
                      <span style={{ fontSize:10, color:"#94a3b8" }}>TA: {c.ta}</span>
                      {c.currentCTC && <span style={{ fontSize:10, color:"#94a3b8", fontFamily:"'DM Mono', monospace" }}>CTC: {fmt(c.currentCTC)}</span>}
                    </div>
                  </div>
                  <ArrowRight size={14} color="#94a3b8" />
                </div>

                {/* Stage-specific info */}
                {(stage === "R1 Scheduled" || stage === "R2 Scheduled") && (
                  <div style={{ marginTop:10, padding:"10px 12px", background:"#f8fafc", borderRadius:8, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    <div><div style={{ fontSize:9, color:"#94a3b8", fontWeight:600 }}>INTERVIEWER</div><div style={{ fontSize:12, fontWeight:600, color:"#0f172a", marginTop:2 }}>{stage === "R1 Scheduled" ? (c.r1By || "—") : (c.r2By || "—")}</div></div>
                    <div><div style={{ fontSize:9, color:"#94a3b8", fontWeight:600 }}>DATE</div><div style={{ fontSize:12, fontWeight:600, color:"#0f172a", marginTop:2, fontFamily:"'DM Mono', monospace" }}>{stage === "R1 Scheduled" ? (c.r1Date || "—") : (c.r2Date || "—")}</div></div>
                  </div>
                )}
                {(stage === "R1 Complete" || stage === "R2 Complete") && (
                  <div style={{ marginTop:10, display:"flex", gap:8 }}>
                    {(() => { const result = stage === "R1 Complete" ? c.r1Result : c.r2Result; return result ? (
                      <span style={{ fontSize:11, fontWeight:700, color:result === "Select" ? "#059669" : "#dc2626", background:result === "Select" ? "#d1fae5" : "#fee2e2", padding:"3px 10px", borderRadius:99 }}>{result}</span>
                    ) : <span style={{ fontSize:11, color:"#94a3b8" }}>Pending result</span>; })()}
                  </div>
                )}
                {stage === "Offered" && c.offerDate && (
                  <div style={{ marginTop:8, fontSize:11, color:"#d97706" }}>Offer sent: {c.offerDate}</div>
                )}
                {stage === "Joined" && c.joinDate && (
                  <div style={{ marginTop:8, fontSize:11, color:"#059669", fontWeight:600 }}>Joined: {c.joinDate}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {atStage.length === 0 && (
        <div style={{ background:"#f8fafc", borderRadius:12, padding:"30px 20px", textAlign:"center" }}>
          <div style={{ fontSize:13, color:"#94a3b8", fontWeight:500 }}>No candidates at this stage</div>
          {earlier.length > 0 && <div style={{ fontSize:11, color:"#cbd5e1", marginTop:4 }}>{earlier.length} candidate{earlier.length !== 1 ? "s" : ""} at earlier stages</div>}
        </div>
      )}

      {/* Candidates who have passed this stage */}
      {later.length > 0 && (
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>
            Already past this stage ({later.length})
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {later.map(c => (
              <div key={c.id} onClick={() => onSelectCandidate(c)} style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"8px 12px", background:"#f8fafc", borderRadius:8, cursor:"pointer", opacity:0.7,
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <Check size={12} color="#059669" />
                  <span style={{ fontSize:12, fontWeight:600, color:"#374151" }}>{c.name}</span>
                  <span style={{ fontSize:11, color:"#94a3b8" }}>{c.company}</span>
                </div>
                <StageBadge stage={c.stage} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Candidates still at earlier stages */}
      {earlier.length > 0 && (
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>
            Not yet at this stage ({earlier.length})
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {earlier.map(c => (
              <div key={c.id} onClick={() => onSelectCandidate(c)} style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"8px 12px", background:"#f8fafc", borderRadius:8, cursor:"pointer", opacity:0.5,
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <Clock size={12} color="#94a3b8" />
                  <span style={{ fontSize:12, fontWeight:600, color:"#374151" }}>{c.name}</span>
                  <span style={{ fontSize:11, color:"#94a3b8" }}>{c.company}</span>
                </div>
                <StageBadge stage={c.stage} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action button */}
      {stage === "Sourced" && (
        <button style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"10px", borderRadius:9, border:`1px dashed ${S.primary}`, background:"transparent", color:S.primary, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif" }}>
          <UserPlus size={14} /> Add Candidate
        </button>
      )}
    </div>
  );
}

/* ─── CANDIDATE DETAIL PANEL ───────────────────────────────── */
function CandidatePanel({ c, onClose }) {
  const [tab, setTab] = useState("overview");
  const req = REQUISITIONS.find(r => r.id === c.reqId);
  const inp = { width:"100%", marginTop:4, fontSize:12, border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 10px", outline:"none", fontFamily:"'Plus Jakarta Sans', sans-serif", color:"#374151" };

  return (
    <div style={{ position:"fixed", top:0, right:0, bottom:0, width:400, zIndex:50, background:"#fff", boxShadow:"-8px 0 40px rgba(0,0,0,0.12)", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid #f1f5f9", flexShrink:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:"#0f172a" }}>{c.name}</div>
            <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>{c.currentRole} · {c.company}</div>
            <div style={{ display:"flex", gap:6, marginTop:8 }}><StageBadge stage={c.stage} /><BUBadge bu={c.bu} /></div>
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
        {["overview","interviews","documents"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding:"10px 12px", border:"none", borderBottom:`2px solid ${tab === t ? S.primary : "transparent"}`, background:"transparent", fontSize:11, fontWeight:600, color:tab === t ? S.primary : "#94a3b8", cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif", textTransform:"capitalize" }}>{t}</button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:20 }}>
        {tab === "overview" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {[{ l:"Current CTC", v:fmt(c.currentCTC) }, { l:"Expected CTC", v:fmt(c.expectedCTC) }, { l:"TA", v:c.ta }, { l:"Sourced", v:c.sourced }, { l:"Offer Date", v:c.offerDate || "—" }, { l:"Join Date", v:c.joinDate || "—" }].map(({ l, v }) => (
              <div key={l} style={{ background:"#f8fafc", borderRadius:8, padding:"8px 10px" }}><div style={{ fontSize:9, color:"#94a3b8", fontWeight:600, textTransform:"uppercase" }}>{l}</div><div style={{ fontSize:13, fontWeight:700, color:"#0f172a", marginTop:2, fontFamily:"'DM Mono', monospace" }}>{v}</div></div>
            ))}
          </div>
        )}
        {tab === "interviews" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[{ round:"Round 1", by:c.r1By, date:c.r1Date, result:c.r1Result }, { round:"Round 2", by:c.r2By, date:c.r2Date, result:c.r2Result }].map(({ round, by, date, result }) => (
              <div key={round} style={{ border:"1px solid #e2e8f0", borderRadius:10, padding:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                  <span style={{ fontSize:12, fontWeight:700 }}>{round}</span>
                  {result ? <span style={{ fontSize:11, fontWeight:700, color:result === "Select" ? "#059669" : "#dc2626", background:result === "Select" ? "#d1fae5" : "#fee2e2", padding:"2px 8px", borderRadius:99 }}>{result}</span> : <span style={{ fontSize:10, color:"#94a3b8" }}>Pending</span>}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <div style={{ background:"#f8fafc", borderRadius:7, padding:"7px 10px" }}><div style={{ fontSize:9, color:"#94a3b8", fontWeight:600 }}>INTERVIEWER</div><div style={{ fontSize:12, fontWeight:600, marginTop:2 }}>{by || "—"}</div></div>
                  <div style={{ background:"#f8fafc", borderRadius:7, padding:"7px 10px" }}><div style={{ fontSize:9, color:"#94a3b8", fontWeight:600 }}>DATE</div><div style={{ fontSize:12, fontWeight:600, marginTop:2, fontFamily:"'DM Mono', monospace" }}>{date || "—"}</div></div>
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

/* ─── APP ───────────────────────────────────────────────────── */
export default function App() {
  const [bu, setBu] = useState("all");
  const [selectedReq, setSelectedReq] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  const reqs = useMemo(() => REQUISITIONS.filter(r => bu === "all" || r.bu === bu), [bu]);
  const cands = useMemo(() => CANDIDATES.filter(c => bu === "all" || c.bu === bu), [bu]);
  const openReqs = reqs.filter(r => r.status !== "Filled");

  const metrics = {
    open: openReqs.length,
    inPipe: cands.length,
    offers: cands.filter(c => ["Offered","Joined"].includes(c.stage)).length,
    joins: cands.filter(c => c.stage === "Joined").length,
  };

  // Candidates for selected requisition
  const reqCands = selectedReq ? CANDIDATES.filter(c => c.reqId === selectedReq.id) : [];
  const candidatesByStage = {};
  STAGES.forEach(s => { candidatesByStage[s] = reqCands.filter(c => c.stage === s); });

  return (
    <>
      <GlobalStyle />
      <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"#f8fafc", overflow:"hidden" }}>
        {/* Header */}
        <div style={{ height:56, background:"#fff", borderBottom:"1px solid #e2e8f0", display:"flex", alignItems:"center", padding:"0 20px", gap:16, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <img src="https://carepalmoney.com/assets/img/carepal-logo.png" alt="CarePal" style={{ height:22, objectFit:"contain" }} onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="block"; }} />
            <div style={{ display:"none", fontWeight:800, fontSize:14, color:"#0f172a" }}>CarePal</div>
            <span style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:"0.08em", textTransform:"uppercase" }}>HR</span>
          </div>
          <div style={{ width:1, height:28, background:"#e2e8f0" }} />
          <div style={{ display:"flex", background:"#f1f5f9", borderRadius:8, padding:2, gap:1 }}>
            {[["all","All"],["CPM","CPM"],["IGIV","IGIV"]].map(([v, l]) => (
              <button key={v} onClick={() => { setBu(v); setSelectedReq(null); }} style={{ padding:"4px 10px", borderRadius:6, border:"none", cursor:"pointer", background:bu === v ? "#fff" : "transparent", boxShadow:bu === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none", color:bu === v ? S.primary : "#64748b", fontSize:11, fontWeight:600, fontFamily:"'Plus Jakarta Sans', sans-serif" }}>{l}</button>
            ))}
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

        {/* Content */}
        {!selectedReq ? (
          /* ─── HOME: Position cards ─── */
          <div style={{ flex:1, overflowY:"auto", padding:24 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div>
                <div style={{ fontSize:20, fontWeight:800, color:"#0f172a" }}>Open Positions</div>
                <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>{openReqs.length} positions awaiting candidates</div>
              </div>
              <button style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:9, border:"none", background:S.primary, color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Plus Jakarta Sans', sans-serif" }}>
                <Plus size={13} /> New Requisition
              </button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:16 }}>
              {openReqs.map(r => (
                <PositionCard
                  key={r.id}
                  req={r}
                  candidates={CANDIDATES.filter(c => c.reqId === r.id)}
                  onClick={() => { setSelectedReq(r); setActiveStep(0); }}
                />
              ))}
            </div>
            {/* Filled positions */}
            {reqs.filter(r => r.status === "Filled").length > 0 && (
              <div style={{ marginTop:32 }}>
                <div style={{ fontSize:14, fontWeight:700, color:"#94a3b8", marginBottom:12 }}>Filled Positions</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:16, opacity:0.5 }}>
                  {reqs.filter(r => r.status === "Filled").map(r => (
                    <PositionCard key={r.id} req={r} candidates={CANDIDATES.filter(c => c.reqId === r.id)} onClick={() => { setSelectedReq(r); setActiveStep(6); }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ─── WIZARD: Step-by-step flow ─── */
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            {/* Wizard header */}
            <div style={{ padding:"14px 20px", background:"#fff", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
              <button onClick={() => setSelectedReq(null)} style={{ display:"flex", alignItems:"center", gap:4, background:"none", border:"none", cursor:"pointer", color:"#64748b", fontSize:12, fontWeight:600, fontFamily:"'Plus Jakarta Sans', sans-serif" }}>
                <ChevronLeft size={14} /> Positions
              </button>
              <div style={{ width:1, height:20, background:"#e2e8f0" }} />
              <span style={{ fontSize:13, fontWeight:700, color:S.primary }}>{selectedReq.id}</span>
              <span style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>{selectedReq.city} · {selectedReq.bdType} BD</span>
              <StatusBadge status={selectedReq.status} />
              <BUBadge bu={selectedReq.bu} />
              <span style={{ marginLeft:"auto", fontSize:11, color:"#94a3b8" }}>{reqCands.length} candidate{reqCands.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Stepper */}
            <div style={{ padding:"16px 0", background:"#fff", borderBottom:"1px solid #e2e8f0", flexShrink:0 }}>
              <WizardStepper activeStep={activeStep} candidatesByStage={candidatesByStage} />
            </div>

            {/* Step navigation */}
            <div style={{ display:"flex", alignItems:"center", padding:"10px 20px", background:"#f8fafc", borderBottom:"1px solid #f1f5f9", gap:6, flexShrink:0 }}>
              <button disabled={activeStep === 0} onClick={() => setActiveStep(s => s - 1)} style={{ padding:"5px 12px", borderRadius:7, border:"1px solid #e2e8f0", background:activeStep === 0 ? "#f8fafc" : "#fff", cursor:activeStep === 0 ? "default" : "pointer", fontSize:11, fontWeight:600, color:activeStep === 0 ? "#cbd5e1" : "#374151", fontFamily:"'Plus Jakarta Sans', sans-serif" }}>Previous</button>
              {STAGES.map((s, i) => (
                <button key={s} onClick={() => setActiveStep(i)} style={{
                  width:28, height:28, borderRadius:"50%", border:"none", cursor:"pointer",
                  background: i === activeStep ? STAGE_CLS[s] : "transparent",
                  color: i === activeStep ? "#fff" : "#94a3b8",
                  fontSize:10, fontWeight:700, fontFamily:"'Plus Jakarta Sans', sans-serif",
                }}>{i + 1}</button>
              ))}
              <button disabled={activeStep === 6} onClick={() => setActiveStep(s => s + 1)} style={{ padding:"5px 12px", borderRadius:7, border:"1px solid #e2e8f0", background:activeStep === 6 ? "#f8fafc" : "#fff", cursor:activeStep === 6 ? "default" : "pointer", fontSize:11, fontWeight:600, color:activeStep === 6 ? "#cbd5e1" : "#374151", fontFamily:"'Plus Jakarta Sans', sans-serif" }}>Next</button>
            </div>

            {/* Step content */}
            <div style={{ flex:1, overflowY:"auto" }}>
              <StepContent
                stage={STAGES[activeStep]}
                candidates={reqCands}
                onSelectCandidate={setSelectedCandidate}
              />
            </div>
          </div>
        )}
      </div>

      {selectedCandidate && <CandidatePanel c={selectedCandidate} onClose={() => setSelectedCandidate(null)} />}
    </>
  );
}
