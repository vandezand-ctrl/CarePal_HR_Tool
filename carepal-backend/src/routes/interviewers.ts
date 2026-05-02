import { Router } from 'express';

export const interviewersRouter = Router();

/**
 * Hardcoded interviewer roster. Updated PR-I (May 2026) to match the IG
 * Master Employee sheet — the prior list referenced people who weren't in
 * the actual users table, which broke the post-schedule mailto invite
 * lookup (it matches interviewer.name → user.email).
 *
 * Roster:
 *   - R1: City Leads (8) — first-round screening
 *   - R2: Regional Heads (5) — second-round / final
 *
 * City field is `null` for all rows because the master sheet didn't include
 * city assignments per City Lead. When Sahil confirms which city each
 * covers, fill in here so the Schedule Interview dropdown can suggest the
 * city-matched interviewer first.
 *
 * The client confirmed this list changes rarely, so a management UI is
 * deferred. When it does change, edit this file and redeploy — or promote
 * to a DB-backed endpoint if it starts churning.
 */
const INTERVIEWERS = [
  // Round 1 — City Leads
  { name: 'Javeed Pasha',      city: null, round: 1 },
  { name: 'Toheed Shaikh',     city: null, round: 1 },
  { name: 'Hemanth Ranganath', city: null, round: 1 },
  { name: 'Sachin Savalkar',   city: null, round: 1 },
  { name: 'Kiran',             city: null, round: 1 },
  { name: 'Saurav Kumar',      city: null, round: 1 },
  { name: 'Aman Kumar',        city: null, round: 1 },
  { name: 'Mohammed Rafi',     city: null, round: 1 },
  // Round 2 — Regional Heads
  { name: 'Lazar Desmond',     city: null, round: 2 },
  { name: 'Harish Goud',       city: null, round: 2 },
  { name: 'Ashutosh Sharma',   city: null, round: 2 },
  { name: 'Soundappan Gopal',  city: null, round: 2 },
  { name: 'Abhishek Sah',      city: null, round: 2 },
];

interviewersRouter.get('/api/interviewers', (_req, res) => {
  res.json(INTERVIEWERS);
});
