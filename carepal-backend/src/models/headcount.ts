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
 * Return the full headcount view — target + derived actuals per (city, bu).
 * "Active" is the count of candidates that reached stage='Joined' in the tool.
 * "Offered" is the count at stage='Offered'.
 * "Notice / PIP / Training" are placeholders (0) until CarePal's BD dataset is wired.
 */
export async function getHeadcountView(filters: { bu?: string } = {}): Promise<HeadcountRow[]> {
  const db = getDb();

  const targetsQ = db('headcount').select('city', 'bu', 'aop');
  if (filters.bu) targetsQ.where('bu', filters.bu);
  const targets = await targetsQ;

  // One grouped query for active + offered counts per (city, bu, stage).
  const countsQ = db('candidates')
    .select('city', 'bu', 'stage')
    .count<{ city: string; bu: string; stage: string; c: number }[]>({ c: '*' })
    .whereIn('stage', ['Joined', 'Offered'])
    .groupBy('city', 'bu', 'stage');
  if (filters.bu) countsQ.where('bu', filters.bu);
  const counts = await countsQ;

  // Build quick lookup: { "Bangalore|CPM|Joined": 3 }
  const lookup = new Map<string, number>();
  for (const r of counts as { city: string; bu: string; stage: string; c: number }[]) {
    lookup.set(`${r.city}|${r.bu}|${r.stage}`, Number(r.c));
  }

  return targets.map(({ city, bu, aop }) => {
    const active = lookup.get(`${city}|${bu}|Joined`) ?? 0;
    const offered = lookup.get(`${city}|${bu}|Offered`) ?? 0;
    return {
      city,
      bu: bu as 'CPM' | 'IGIV',
      aop,
      active,
      offered,
      notice: 0,
      pip: 0,
      training: 0,
      deficit: calculateDeficit(aop, active),
    };
  });
}
