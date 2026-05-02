// Interview-invite builder (PR-G / point 6 N1+N3).
//
// We're shipping the lightest version first: a frontend-only "open the user's
// mail client with everything pre-filled" flow. No backend email service, no
// .ics attachment (mailto: can't attach files), and an "Add to Google
// Calendar" prefill link in the body that the recipient clicks once to land
// the event on their calendar.
//
// When CarePal asks for actual server-side automated emails, we swap the
// `mailto:` URL for a backend `POST /api/interviews/:id/notify` and reuse the
// same subject/body builders. Keep these pure to make that swap painless.

/**
 * Build a Google Calendar prefill URL recipients can click to add the event
 * to their own calendar in one step. Works in any mail client because it's
 * just an HTTPS link — sidesteps the .ics-attach problem entirely.
 *
 * Date format Google expects: YYYYMMDDTHHmmssZ (UTC). For all-day events
 * (no time given), use date-only YYYYMMDD/YYYYMMDD.
 */
export function buildGoogleCalendarUrl({ subject, scheduledDate, scheduledTime, mode, locationOrLink, description }) {
  if (!scheduledDate) return null;
  const compact = (s) => s.replace(/[-:]/g, '');
  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', subject);

  if (scheduledTime) {
    // Treat the user-entered local time as IST (Asia/Kolkata, UTC+5:30) since
    // that's where every BD interview happens. Convert to a UTC-stamp Google
    // accepts. Using the IANA-naive approach: parse as if local, then subtract
    // 5h30m to get UTC. (No DST in IST, so this is unambiguous.)
    const [y, m, d] = scheduledDate.split('-').map(Number);
    const [hh, mm] = scheduledTime.split(':').map(Number);
    // Build a UTC date that represents the IST wall-clock time minus 5:30.
    const startUtc = new Date(Date.UTC(y, m - 1, d, hh - 5, mm - 30));
    const endUtc = new Date(startUtc.getTime() + 60 * 60 * 1000); // +1h default
    const fmt = (date) => `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}T${String(date.getUTCHours()).padStart(2, '0')}${String(date.getUTCMinutes()).padStart(2, '0')}00Z`;
    params.set('dates', `${fmt(startUtc)}/${fmt(endUtc)}`);
  } else {
    // All-day event — Google's all-day format is YYYYMMDD/YYYYMMDD where the
    // end date is exclusive (so the event spans the single given date).
    const start = compact(scheduledDate);
    // Add one day for the exclusive end.
    const [y, m, d] = scheduledDate.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    const end = `${next.getUTCFullYear()}${String(next.getUTCMonth() + 1).padStart(2, '0')}${String(next.getUTCDate()).padStart(2, '0')}`;
    params.set('dates', `${start}/${end}`);
  }

  if (locationOrLink) params.set('location', locationOrLink);
  if (description) params.set('details', description);
  // Mode hint in Google Calendar's "Where" if no explicit link was given.
  if (!locationOrLink && mode) params.set('location', `${mode} interview`);

  return `https://www.google.com/calendar/render?${params.toString()}`;
}

/**
 * Build a mailto: URL with To, Subject, and Body pre-filled. Recipients
 * (candidate + interviewer) go on a single email; the body explains who's who.
 *
 * Returns:
 *   - mailto: a click-to-open URL the UI hands to <a href={...}> or window.open
 *   - subject: surfaced in the confirmation panel for review
 *   - body: ditto
 *   - googleCalendarUrl: the "Add to Google Calendar" link embedded in body
 *   - missingInterviewerEmail / missingCandidateEmail: booleans the UI can use
 *     to flag "you'll have to add this address yourself" rather than silently
 *     emailing a single recipient.
 */
export function buildInviteEmail({
  candidate,        // { name, email, ... }
  interviewerName,
  interviewerEmail, // may be null/undefined if no users-table match
  round,
  scheduledDate,
  scheduledTime,
  mode,
  locationOrLink,
  reqId,
}) {
  const subject = `R${round} Interview · ${candidate?.name || 'Candidate'} · ${scheduledDate}`;

  // Body description (used both in the email body and embedded in the GCal
  // event description so the calendar item carries the same context).
  const lines = [
    `Hello,`,
    ``,
    `An R${round} interview is scheduled at CarePal.`,
    ``,
    `Candidate:   ${candidate?.name || ''}`,
    `Interviewer: ${interviewerName || ''}`,
    `Date:        ${scheduledDate}${scheduledTime ? ` at ${scheduledTime} IST` : ''}`,
    `Mode:        ${mode || ''}`,
  ];
  if (locationOrLink) lines.push(`Location:    ${locationOrLink}`);
  if (reqId) lines.push(`Requisition: ${reqId}`);
  lines.push('', '— CarePal HR');

  const description = lines.join('\n');

  const googleCalendarUrl = buildGoogleCalendarUrl({
    subject,
    scheduledDate,
    scheduledTime,
    mode,
    locationOrLink,
    description,
  });

  // Append the "Add to Google Calendar" line to the email body (the GCal URL
  // doesn't go in the calendar event's own description — that would be a
  // self-referential loop).
  const body = description + (googleCalendarUrl ? `\n\nAdd to your Google Calendar: ${googleCalendarUrl}` : '');

  const recipients = [candidate?.email, interviewerEmail].filter(Boolean);

  const mailto = `mailto:${encodeURIComponent(recipients.join(','))}`
    + `?subject=${encodeURIComponent(subject)}`
    + `&body=${encodeURIComponent(body)}`;

  return {
    mailto,
    subject,
    body,
    googleCalendarUrl,
    recipients,
    missingCandidateEmail: !candidate?.email,
    missingInterviewerEmail: !interviewerEmail,
  };
}
