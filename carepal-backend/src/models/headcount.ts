import { getDb } from '../db/index.js';
import { calculateDeficit } from '../logic/headcount.js';

export interface HeadcountRow {
  city: string;
  bu: 'CPM' | 'IGIV';
  aop: number;       // target
  active: number;    // derived: candidates at stage='Joined'
  offered: number;   // derived: candidates at stage='Offered'
  notice: number;    // 0 until we have external BD data (Sujeet integration)
  pip: number;       // 0 until we have external BD data
  training: number;  // 0 until we have external BD data
  deficit: number;   // target - active
}

/**
 * Update the AOP target for a single (city, bu) cell. Returns the updated row
 * (with derived fields recomputed) or null if the cell doesn't exist. Admin
 * sets these manually each year from the AOP — there is no source-of-truth
 * integration (per the Apr 29 beta-feedback decision).
 */
export async function updateHeadcountTarget(
  city: string,
  bu: 'CPM' | 'IGIV',
  aop: number,
): Promise<HeadcountRow | null> {
  const db = getDb();
  const updated = await db('headcount')
    .where({ city, bu })
    .update({ aop, updated_at: new Date() });
  if (updated === 0) return null;

  // Re-fetch through the view so derived fields (active/offered/deficit) are
  // consistent with the rest of the API. One row at most for (city, bu).
  const rows = await getHeadcountView({ bu });
  return rows.find((r) => r.city === city && r.bu === bu) ?? null;
}

/**
 * Return the full headcount view — target + derived actuals per (city, bu).
 *
 * Stage → headcount mapping (per Apr 29 backlog C3):
 *   - active   = stage 'Active'   (fully ramped, productive on the job)
 *   - training = stage 'Training' (post-join onboarding)
 *   - offered  = stage 'Offered'  (signed offer not yet started)
 *   - 'Joined' is a transient state (signed but not yet in training/active)
 *      and intentionally not counted in any headcount metric — Sahil's read
 *      is "joined ≠ deployed yet". Surfaced via the Funnel chart instead.
 *
 * Notice / PIP are placeholders (0) until CarePal's BD dataset is wired.
 */
export async function getHeadcountView(filters: { bu?: string } = {}): Promise<HeadcountRow[]> {
  const db = getDb();

  const targetsQ = db('headcount').select('city', 'bu', 'aop');
  if (filters.bu) targetsQ.where('bu', filters.bu);
  const targets = await targetsQ;

  // One grouped query for active + training + offered counts per (city, bu, stage).
  const countsQ = db('candidates')
    .select('city', 'bu', 'stage')
    .count<{ city: string; bu: string; stage: string; c: number }[]>({ c: '*' })
    .whereIn('stage', ['Active', 'Training', 'Offered'])
    .groupBy('city', 'bu', 'stage');
  if (filters.bu) countsQ.where('bu', filters.bu);
  const counts = await countsQ;

  // Build quick lookup: { "Bangalore|CPM|Active": 3 }
  const lookup = new Map<string, number>();
  for (const r of counts as { city: string; bu: string; stage: string; c: number }[]) {
    lookup.set(`${r.city}|${r.bu}|${r.stage}`, Number(r.c));
  }

  return targets.map(({ city, bu, aop }) => {
    const active = lookup.get(`${city}|${bu}|Active`) ?? 0;
    const training = lookup.get(`${city}|${bu}|Training`) ?? 0;
    const offered = lookup.get(`${city}|${bu}|Offered`) ?? 0;
    return {
      city,
      bu: bu as 'CPM' | 'IGIV',
      aop,
      active,
      offered,
      notice: 0,
      pip: 0,
      training,
      deficit: calculateDeficit(aop, active),
    };
  });
}
