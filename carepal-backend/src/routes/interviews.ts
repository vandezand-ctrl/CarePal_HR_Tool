import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  listInterviews,
  getInterview,
  scheduleInterview,
  recordInterviewResult,
  cancelInterview,
  type ListInterviewsFilters,
  type InterviewResult,
} from '../models/interview.js';
import {
  scheduleInterviewSchema,
  recordResultSchema,
  cancelInterviewSchema,
} from '../schemas/interview.js';
import { requireRole } from '../middleware/rbac.js';
import { getCandidate } from '../models/candidate.js';
import { getUserByName } from '../models/user.js';
import { isEmailConfigured, sendEmailWithICS } from '../services/email.js';
import { INTERVIEWERS } from './interviewers.js';

export const interviewsRouter = Router();

// Helpers — Express query strings are messy (string | string[] | parsed obj),
// so coerce defensively.
function strParam(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function boolParam(v: unknown): boolean | undefined {
  if (typeof v !== 'string') return undefined;
  return v.toLowerCase() === 'true';
}

function roundParam(v: unknown): 1 | 2 | undefined {
  if (v === '1') return 1;
  if (v === '2') return 2;
  return undefined;
}

function resultParam(v: unknown): ListInterviewsFilters['result'] | undefined {
  const allowed: ListInterviewsFilters['result'][] = [
    'Select', 'Reject', 'No-show', 'Scheduled',
  ];
  return typeof v === 'string' && (allowed as string[]).includes(v)
    ? (v as ListInterviewsFilters['result'])
    : undefined;
}

// GET /api/interviews
//   ?candidateId=C-001
//   &dateFrom=2026-04-01 &dateTo=2026-04-30
//   &round=1|2
//   &result=Select|Reject|No-show|Scheduled
//   &interviewerName=Soundappan%20Gopal
//   &includeCancelled=true|false  (default false)
interviewsRouter.get('/api/interviews', async (req, res, next) => {
  try {
    const candidateId = strParam(req.query.candidateId);
    if (req.user!.role === 'ta' && candidateId) {
      const cand = await getCandidate(candidateId);
      if (!cand || !cand.assignedTas.some(t => t.id === req.user!.id)) {
        return res.json([]);
      }
    }
    const rows = await listInterviews({
      candidateId,
      dateFrom: strParam(req.query.dateFrom),
      dateTo: strParam(req.query.dateTo),
      round: roundParam(req.query.round),
      result: resultParam(req.query.result),
      interviewerName: strParam(req.query.interviewerName),
      includeCancelled: boolParam(req.query.includeCancelled),
    });
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

// GET /api/interviews/:id
interviewsRouter.get('/api/interviews/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid interview id' });
    const row = await getInterview(id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (req.user!.role === 'ta') {
      const cand = await getCandidate(row.candidateId);
      if (!cand || !cand.assignedTas.some(t => t.id === req.user!.id)) {
        return res.status(404).json({ error: 'Not found' });
      }
    }
    return res.json(row);
  } catch (err) {
    return next(err);
  }
});

async function sendInterviewInvites(interview: {
  candidateId: string;
  round: 1 | 2;
  interviewerName: string;
  scheduledDate: string;
  scheduledTime: string | null;
  mode: string;
  locationOrLink: string | null;
}): Promise<void> {
  if (!isEmailConfigured()) return;

  const [candidate, interviewerUser] = await Promise.all([
    getCandidate(interview.candidateId),
    getUserByName(interview.interviewerName),
  ]);

  const candidateEmail = candidate?.email;
  const interviewerEmail = interviewerUser?.email;
  if (!candidateEmail && !interviewerEmail) return;

  const candidateName = candidate?.name ?? interview.candidateId;
  const roundLabel = interview.round === 1 ? 'R1' : 'R2';
  const dateStr = interview.scheduledDate;
  const timeStr = interview.scheduledTime ?? '10:00';

  const { default: ical, ICalCalendarMethod } = await import('ical-generator');
  const cal = ical({ method: ICalCalendarMethod.REQUEST });

  const [hours, minutes] = timeStr.split(':').map(Number);
  const start = new Date(`${dateStr}T00:00:00+05:30`);
  start.setHours(hours, minutes, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const location = interview.locationOrLink ?? (interview.mode === 'Virtual' ? 'Virtual' : 'Office');

  cal.createEvent({
    start,
    end,
    summary: `${roundLabel} Interview — ${candidateName}`,
    description: `${roundLabel} interview for ${candidateName} with ${interview.interviewerName}.\nMode: ${interview.mode}\nLocation: ${location}`,
    location,
  });

  const icsContent = cal.toString();
  const subject = `${roundLabel} Interview Scheduled — ${candidateName} on ${dateStr}`;

  const promises: Promise<void>[] = [];

  if (candidateEmail) {
    promises.push(sendEmailWithICS({
      to: candidateEmail,
      subject,
      body: `Dear ${candidateName},\n\nYour ${roundLabel} interview has been scheduled.\n\nDate: ${dateStr}\nTime: ${timeStr}\nMode: ${interview.mode}\nLocation: ${location}\nInterviewer: ${interview.interviewerName}\n\nPlease find the calendar invite attached.\n\nBest regards,\nCarePal Money Talent Acquisition Team`,
      icsContent,
    }));
  }

  if (interviewerEmail) {
    promises.push(sendEmailWithICS({
      to: interviewerEmail,
      subject,
      body: `Hi ${interview.interviewerName},\n\nAn ${roundLabel} interview has been scheduled.\n\nCandidate: ${candidateName}\nDate: ${dateStr}\nTime: ${timeStr}\nMode: ${interview.mode}\nLocation: ${location}\n\nPlease find the calendar invite attached.\n\nBest regards,\nCarePal Money Talent Acquisition Team`,
      icsContent,
    }));
  }

  await Promise.all(promises);
}

// POST /api/interviews — schedule or reschedule an interview (upsert on candidate + round).
// Triggers a candidate pipeline stage transition.
interviewsRouter.post('/api/interviews', async (req, res, next) => {
  try {
    const input = scheduleInterviewSchema.parse(req.body);

    if (req.user!.role === 'ta') {
      const cand = await getCandidate(input.candidateId);
      if (!cand || !cand.assignedTas.some(t => t.id === req.user!.id)) {
        return res.status(404).json({ error: 'Not found' });
      }
    }

    const interviewer = INTERVIEWERS.find(i => i.name === input.interviewerName);
    if (interviewer?.city) {
      const cand = await getCandidate(input.candidateId);
      if (cand?.city && cand.city !== interviewer.city) {
        return res.status(400).json({
          error: `Cannot schedule: interviewer ${input.interviewerName} covers ${interviewer.city}, but candidate is in ${cand.city}`,
        });
      }
    }

    const interview = await scheduleInterview(input);

    sendInterviewInvites(interview).catch((err) =>
      console.error('[interviews] invite email failed:', err),
    );

    return res.status(201).json(interview);
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    }
    if (err instanceof Error && /Cannot (schedule|record|cancel|make)/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof Error && /not found/i.test(err.message)) {
      return res.status(404).json({ error: err.message });
    }
    return next(err);
  }
});

// PATCH /api/interviews/:id — record the Select/Reject/No-show result. Triggers stage transition.
interviewsRouter.patch('/api/interviews/:id', requireRole('approver'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid interview id' });
    const { result } = recordResultSchema.parse(req.body);
    const interview = await recordInterviewResult(id, result as InterviewResult);
    return res.json(interview);
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    }
    if (err instanceof Error && /Cannot (schedule|record|cancel|make)/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof Error && /not found/i.test(err.message)) {
      return res.status(404).json({ error: err.message });
    }
    return next(err);
  }
});

// DELETE /api/interviews/:id?reason=... — soft-cancel a scheduled interview.
// Reverts the candidate's pipeline stage by one step in the same transaction.
// Rejected (400) if the interview already has a recorded result — the audit
// trail of what actually happened wins over a soft delete.
//
// RBAC (added in PR D, Apr 2026): cancel is approver/admin only. TAs can
// re-schedule via POST (which overwrites the existing row), but full
// cancellation requires a slightly higher bar to prevent a junior TA from
// accidentally wiping an Approver's R2. The schedule (POST) and outcome-
// recording (PATCH) endpoints stay open to all authenticated users —
// that's the TA team's daily work.
interviewsRouter.delete('/api/interviews/:id', requireRole('approver'), async (req, res, next) => {
  try {
    const { reason } = cancelInterviewSchema.parse({
      reason: strParam(req.query.reason),
    });
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid interview id' });
    }
    const interview = await cancelInterview(id, reason);
    return res.json(interview);
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    }
    if (err instanceof Error && /Cannot (schedule|record|cancel|make)/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof Error && /Cannot cancel an interview with a recorded result/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof Error && /not found/i.test(err.message)) {
      return res.status(404).json({ error: err.message });
    }
    return next(err);
  }
});

interviewsRouter.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[interviews]', err);
  res.status(500).json({ error: 'Internal server error' });
});
