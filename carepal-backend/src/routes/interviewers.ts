import { Router } from 'express';

export const interviewersRouter = Router();

/**
 * Hardcoded list of interviewers. The client confirmed this changes rarely,
 * so a management UI is deferred. When we need to add/remove, just edit this
 * file and redeploy — or promote to a DB-backed endpoint later.
 */
const INTERVIEWERS = [
  { name: 'Himanshu Jaiswal', city: 'Bangalore', round: 1 },
  { name: 'Khazim Syed', city: 'Hyderabad', round: 1 },
  { name: 'Lazer Rajan', city: 'Chennai', round: 1 },
  { name: 'Gaurav Sharma', city: 'Bangalore', round: 1 },
  { name: 'Soundappan Gopal', city: null, round: 2 },
  { name: 'Ankita Kumari', city: null, round: 2 },
  { name: 'Bhavesh N', city: null, round: 2 },
];

interviewersRouter.get('/api/interviewers', (_req, res) => {
  res.json(INTERVIEWERS);
});
