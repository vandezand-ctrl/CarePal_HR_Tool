import { useState, useEffect, useMemo } from 'react';
import { X, Mail, Check } from 'lucide-react';
import { useData } from './DataContext.jsx';
import { api } from './api.js';
import { buildInviteEmail } from './invite.js';

/**
 * Shared modal for scheduling, rescheduling, or editing an interview.
 *
 * Two entry modes, one component:
 *
 *   1. From the Candidate detail panel (CandidateModal):
 *      <ScheduleInterviewModal candidateId="C-001" onClose={...} />
 *      The candidate dropdown is rendered as the first field but disabled
 *      (selection is locked to the calling context).
 *
 *   2. From the Interviews page "+ Schedule Interview" button:
 *      <ScheduleInterviewModal candidateId={null} onClose={...} />
 *      The candidate dropdown is enabled — user picks first, then the
 *      rest of the form populates with smart defaults.
 *
 * Optionally pass `interviewId` to open in edit mode (form pre-fills from
 * the existing interview row).
 *
 * Smart-default round logic — fixes the bug where "Schedule" tab on a
 * candidate at R1 Complete would default to Round 1 and immediately error
 * with "Cannot schedule R1 from stage 'R1 Complete'":
 *
 *   - candidate.stage Sourced or R1 Scheduled       → R1
 *   - candidate.stage R1 Complete + R1 was Select   → R2
 *   - candidate.stage R1 Complete + R1 was Reject/No-show → no eligible round
 *     (form shows a "candidate did not pass R1" message instead)
 *   - candidate.stage R2 Scheduled                  → R2 (reschedule)
 *   - candidate.stage R2 Complete / Offered / Joined → no eligible round
 */
export default function ScheduleInterviewModal({
  candidateId: lockedCandidateId = null,
  interviewId = null,
  onClose,
  onSaved,
}) {
  const { candidates: CANDIDATES, requisitions: REQUISITIONS, interviewers, scheduleInterview, users: USERS } = useData();

  // Candidate selection. Locked when the modal is opened from a candidate's
  // own detail panel; user-pickable from the Interviews page.
  const [pickedCandidateId, setPickedCandidateId] = useState(lockedCandidateId || '');
  const candidate = CANDIDATES.find(c => c.id === pickedCandidateId);

  // Interviews already booked for the picked candidate — used to pre-fill
  // the form in edit mode AND to determine R1 outcome (so R2 eligibility
  // doesn't depend on the deprecated candidate.r1Result cache field).
  const [interviewsForCandidate, setInterviewsForCandidate] = useState([]);
  useEffect(() => {
    if (!pickedCandidateId) { setInterviewsForCandidate([]); return; }
    let alive = true;
    api.listInterviews({ candidateId: pickedCandidateId, includeCancelled: true })
      .then(rows => { if (alive) setInterviewsForCandidate(rows); })
      .catch(() => { /* non-blocking */ });
    return () => { alive = false; };
  }, [pickedCandidateId]);

  const r1Interview = interviewsForCandidate.find(i => i.round === 1 && !i.cancelledAt);
  const r2Interview = interviewsForCandidate.find(i => i.round === 2 && !i.cancelledAt);

  // Suggest a round based on candidate's current stage + R1 outcome.
  const suggestion = useMemo(
    () => suggestRound(candidate, r1Interview),
    [candidate, r1Interview],
  );

  // The interview being edited (if interviewId given).
  const editingInterview = interviewId
    ? interviewsForCandidate.find(i => i.id === interviewId)
    : null;

  // Form state. Round defaults to the editingInterview's round (if editing)
  // or the suggested round (if scheduling fresh).
  const [form, setForm] = useState({
    round: 1,
    mode: 'Virtual',
    interviewerName: '',
    scheduledDate: '',
    scheduledTime: '',
    locationOrLink: '',
  });
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Re-init the form whenever the picked candidate or editing target changes.
  useEffect(() => {
    if (editingInterview) {
      setForm({
        round: editingInterview.round,
        mode: editingInterview.mode,
        interviewerName: editingInterview.interviewerName,
        scheduledDate: editingInterview.scheduledDate,
        scheduledTime: editingInterview.scheduledTime || '',
        locationOrLink: editingInterview.locationOrLink || '',
      });
    } else if (suggestion.allowed) {
      setForm(f => ({ ...f, round: suggestion.round }));
    }
  }, [editingInterview, suggestion.allowed, suggestion.round]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  // PR-G (point 6): after a successful save, switch the modal to a
  // confirmation step that lets the user fire off a mailto: invite to the
  // candidate + interviewer with an "Add to Google Calendar" link.
  // null until saved; set to the form snapshot used for invite generation.
  const [confirmation, setConfirmation] = useState(null);

  const submit = async () => {
    setSubmitError(null);
    if (!pickedCandidateId) { setSubmitError('Please pick a candidate'); return; }
    if (!form.interviewerName) { setSubmitError('Please pick an interviewer'); return; }
    if (!form.scheduledDate) { setSubmitError('Please pick a date'); return; }
    try {
      setSubmitting(true);
      await scheduleInterview({
        candidateId: pickedCandidateId,
        round: form.round,
        interviewerName: form.interviewerName,
        scheduledDate: form.scheduledDate,
        scheduledTime: form.scheduledTime || null,
        mode: form.mode,
        locationOrLink: form.locationOrLink || null,
      });
      if (onSaved) onSaved();
      // Switch to confirmation step instead of closing — the user picks
      // whether to fire the invite mailto.
      setConfirmation({
        candidate,
        round: form.round,
        interviewerName: form.interviewerName,
        scheduledDate: form.scheduledDate,
        scheduledTime: form.scheduledTime,
        mode: form.mode,
        locationOrLink: form.locationOrLink,
        reqId: candidate?.reqId,
      });
    } catch (err) {
      setSubmitError(err.message || 'Failed to schedule');
    } finally {
      setSubmitting(false);
    }
  };

  const inp = {
    width: '100%', marginTop: 4, fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '8px 10px', outline: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#374151',
  };
  const lbl = { fontSize: 11, fontWeight: 600, color: '#374151' };

  // Eligible candidates for the dropdown — only those at a stage where SOME
  // interview can be scheduled. (Avoids the user picking a Joined candidate
  // and immediately hitting an error.)
  const eligibleCandidates = useMemo(() => {
    return CANDIDATES.filter(c => {
      const r1 = interviewsForCandidate.find(i => i.candidateId === c.id && i.round === 1 && !i.cancelledAt);
      // We don't have interviews loaded for *all* candidates here, so for the
      // dropdown we use a coarser stage-only filter. Fine-grained eligibility
      // is shown after pick in the form.
      void r1;
      return ['Sourced', 'R1 Scheduled', 'R1 Complete', 'R2 Scheduled'].includes(c.stage);
    });
  }, [CANDIDATES, interviewsForCandidate]);

  const formIsLocked = !suggestion.allowed && !editingInterview;
  const title = confirmation ? 'Interview Scheduled' : editingInterview ? 'Edit Interview' : 'Schedule Interview';

  // Look up the interviewer's email by name match against the users table.
  // Some interviewers (Mahesh, Varun, etc.) aren't in the interviewers list
  // but ARE in the users table — and vice-versa for older Workspace folks.
  // Best-effort: when we can match, we pre-fill; otherwise the To: field
  // will only have the candidate's address and the user can add the rest.
  const interviewerEmailFor = (name) => {
    if (!name) return null;
    return USERS?.find?.((u) => u.name === name)?.email || null;
  };

  // If we're in confirmation mode, render that body + footer instead of
  // the schedule form. Builds the mailto + GCal link via the pure helper.
  if (confirmation) {
    const invite = buildInviteEmail({
      candidate: confirmation.candidate,
      interviewerName: confirmation.interviewerName,
      interviewerEmail: interviewerEmailFor(confirmation.interviewerName),
      round: confirmation.round,
      scheduledDate: confirmation.scheduledDate,
      scheduledTime: confirmation.scheduledTime,
      mode: confirmation.mode,
      locationOrLink: confirmation.locationOrLink,
      reqId: confirmation.reqId,
    });
    const scheduleAnother = () => {
      // Reset form state for the next schedule. Keep the candidate selection
      // when the modal was opened from a candidate context (locked).
      setConfirmation(null);
      setForm({
        round: 1, mode: 'Virtual', interviewerName: '',
        scheduledDate: '', scheduledTime: '', locationOrLink: '',
      });
    };
    return (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={onClose}
      >
        <div
          style={{ background: '#fff', borderRadius: 18, width: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: '#d1fae5', color: '#047857', borderRadius: 99, padding: 6, display: 'inline-flex' }}><Check size={14}/></span>
              <span style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>{title}</span>
            </div>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }} onClick={onClose}><X size={18} /></button>
          </div>

          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Summary card */}
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>SUMMARY</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                R{confirmation.round} · {confirmation.candidate?.name || '—'} → {confirmation.interviewerName}
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                {confirmation.scheduledDate}{confirmation.scheduledTime ? ` at ${confirmation.scheduledTime} IST` : ''} · {confirmation.mode}
                {confirmation.locationOrLink ? ` · ${confirmation.locationOrLink}` : ''}
              </div>
            </div>

            {/* Recipient warnings — surface missing addresses so the user knows
                what to add manually before clicking Send. */}
            {(invite.missingCandidateEmail || invite.missingInterviewerEmail) && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 9, padding: '10px 12px', fontSize: 11, color: '#92400e' }}>
                {invite.missingCandidateEmail && <div>• No email on file for the candidate — add it manually in your mail client.</div>}
                {invite.missingInterviewerEmail && <div>• No email on file for {confirmation.interviewerName} — add it manually in your mail client.</div>}
              </div>
            )}

            {/* Email + GCal preview */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>SUBJECT</div>
              <div style={{ fontSize: 12, color: '#0f172a', fontFamily: "'DM Mono', monospace", marginTop: 3 }}>{invite.subject}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginTop: 10 }}>RECIPIENTS</div>
              <div style={{ fontSize: 12, color: '#0f172a', marginTop: 3 }}>
                {invite.recipients.length > 0 ? invite.recipients.join(', ') : <span style={{ color: '#94a3b8' }}>None — you'll need to fill in the To: field</span>}
              </div>
              {invite.googleCalendarUrl && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginTop: 10 }}>CALENDAR LINK (recipients click to add)</div>
                  <div style={{ fontSize: 11, color: '#0d9488', marginTop: 3, wordBreak: 'break-all' }}>
                    <a href={invite.googleCalendarUrl} target="_blank" rel="noreferrer" style={{ color: '#0d9488' }}>Preview event in Google Calendar</a>
                  </div>
                </>
              )}
            </div>

            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
              Clicking <strong>Email candidate + interviewer</strong> opens your mail client with the message pre-filled. The candidate and interviewer click the calendar link inside the email to add the event to their own Google Calendar.
            </div>
          </div>

          <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <button
              onClick={scheduleAnother}
              style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#64748b', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >Schedule another</button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onClose}
                style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#64748b', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >Done (skip email)</button>
              <a
                href={invite.mailto}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, background: '#0d9488', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", textDecoration: 'none' }}
              >
                <Mail size={13}/> Email candidate + interviewer
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 18, width: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>{title}</div>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ padding: 24, maxHeight: '68vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Candidate field — always shown, disabled when locked */}
          <div>
            <label style={lbl}>Candidate *</label>
            <select
              value={pickedCandidateId}
              onChange={e => setPickedCandidateId(e.target.value)}
              disabled={!!lockedCandidateId || !!editingInterview}
              style={{ ...inp, background: (!!lockedCandidateId || !!editingInterview) ? '#f8fafc' : '#fff' }}
            >
              <option value="">Select candidate…</option>
              {eligibleCandidates.map(c => {
                const req = REQUISITIONS.find(r => r.id === c.reqId);
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.stage}{req ? ` (${req.id})` : ''}
                  </option>
                );
              })}
              {/* If the locked candidate isn't in the eligible list (e.g.
                  R1 Complete + Reject), still show them so the picker isn't blank. */}
              {lockedCandidateId && candidate && !eligibleCandidates.some(c => c.id === lockedCandidateId) && (
                <option value={lockedCandidateId}>{candidate.name} — {candidate.stage}</option>
              )}
            </select>
          </div>

          {/* Eligibility notice — replaces the form when no further interview can be scheduled */}
          {pickedCandidateId && !suggestion.allowed && !editingInterview && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 9, padding: '12px 14px', fontSize: 12, color: '#92400e' }}>
              {suggestion.reason}
            </div>
          )}

          {/* The schedule form — only render when there's an eligible round (or in edit mode) */}
          {pickedCandidateId && (suggestion.allowed || editingInterview) && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Round *</label>
                  <select
                    value={form.round}
                    onChange={e => setF('round', Number(e.target.value))}
                    disabled={!!editingInterview}
                    style={{ ...inp, background: editingInterview ? '#f8fafc' : '#fff' }}
                  >
                    {/* Only render allowed rounds based on candidate stage */}
                    {(suggestion.allowedRounds || [editingInterview?.round]).filter(Boolean).map(r => (
                      <option key={r} value={r}>Round {r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Mode *</label>
                  <select value={form.mode} onChange={e => setF('mode', e.target.value)} style={inp}>
                    <option value="Virtual">Virtual</option>
                    <option value="In-Person">In-Person (F2F)</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Interviewer *</label>
                  <select value={form.interviewerName} onChange={e => setF('interviewerName', e.target.value)} style={inp}>
                    <option value="">Select interviewer…</option>
                    {interviewers.filter(i => i.round === form.round).map(i => (
                      <option key={i.name} value={i.name}>{i.name}{i.city ? ` · ${i.city}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Date *</label>
                  <input type="date" value={form.scheduledDate} onChange={e => setF('scheduledDate', e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Time Slot</label>
                  <input type="time" value={form.scheduledTime} onChange={e => setF('scheduledTime', e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Location / Link</label>
                  <input type="text" value={form.locationOrLink} onChange={e => setF('locationOrLink', e.target.value)} placeholder="Google Meet link or address" style={inp} />
                </div>
              </div>

              {/* Reschedule warning when an interview at this round already exists */}
              {!editingInterview && ((form.round === 1 && r1Interview) || (form.round === 2 && r2Interview)) && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 9, padding: '10px 12px', fontSize: 11, color: '#1e40af' }}>
                  An R{form.round} is already scheduled for this candidate. Saving will <strong>reschedule</strong> (overwrite) it.
                </div>
              )}
            </>
          )}

          {submitError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: '10px 12px', fontSize: 11, color: '#991b1b' }}>
              {submitError}
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', color: '#64748b', fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: submitting ? 0.6 : 1 }}
          >Cancel</button>
          <button
            onClick={submit}
            disabled={submitting || formIsLocked || !pickedCandidateId}
            style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: '#0d9488', color: '#fff', fontSize: 12, fontWeight: 600, cursor: (submitting || formIsLocked || !pickedCandidateId) ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: (submitting || formIsLocked || !pickedCandidateId) ? 0.5 : 1 }}
          >
            {submitting ? 'Saving…' : editingInterview ? 'Save Changes' : 'Schedule Interview'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Pure helper. Given a candidate and their R1 interview row (if any), returns
 * which round can be scheduled next.
 *
 * Splitting this out as a pure function makes it testable, and lets the
 * Interviews page reuse the same eligibility logic when computing a default
 * round per candidate in the picker.
 */
function suggestRound(candidate, r1Interview) {
  if (!candidate) return { allowed: false, reason: 'No candidate selected', allowedRounds: [] };
  switch (candidate.stage) {
    case 'Sourced':
    case 'R1 Scheduled':
      return { allowed: true, round: 1, allowedRounds: [1] };
    case 'R1 Complete': {
      const r1Result = r1Interview?.result;
      if (r1Result === 'Select') return { allowed: true, round: 2, allowedRounds: [2] };
      return {
        allowed: false,
        reason: `Candidate did not pass R1 (result: ${r1Result || 'unrecorded'}). No further interviews can be scheduled.`,
        allowedRounds: [],
      };
    }
    case 'R2 Scheduled':
      return { allowed: true, round: 2, allowedRounds: [2] };
    case 'R2 Complete':
    case 'Offered':
    case 'Joined':
      return {
        allowed: false,
        reason: `Candidate is at stage '${candidate.stage}' — past the interview phase. Use the candidate detail panel to record offer / join.`,
        allowedRounds: [],
      };
    default:
      return { allowed: false, reason: `Unknown stage '${candidate.stage}'`, allowedRounds: [] };
  }
}
