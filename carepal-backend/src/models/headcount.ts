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
 *
 * PR-O: actorId is the user making the edit. Stored on the row so the
 * Dashboard's "changes since you last viewed" toast can filter out the
 * viewer's own edits. Nullable for backwards compat with seed data.
 */
export async function updateHeadcountTarget(
  city: string,
  bu: 'CPM' | 'IGIV',
  aop: number,
  actorId: number | null = null,
): Promise<HeadcountRow | null> {
  const db = getDb();
  const updated = await db('headcount')
    .where({ city, bu })
    .update({ aop, updated_at: new Date(), updated_by_user_id: actorId });
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
export async function getHeadcountView(filters: { bu?: string; cities?: string[] } = {}): Promise<HeadcountRow[]> {
  const db = getDb();

  const targetsQ = db('headcount').select('city', 'bu', 'aop');
  if (filters.bu) targetsQ.where('bu', filters.bu);
  if (filters.cities) targetsQ.whereIn('city', filters.cities);
  const targets = await targetsQ;

  // One grouped query for active + training + offered counts per (city, bu, stage).
  const countsQ = db('candidates')
    .select('city', 'bu', 'stage')
    .count<{ city: string; bu: string; stage: string; c: number }[]>({ c: '*' })
    .whereIn('stage', ['Active', 'Training', 'Offered'])
    .groupBy('city', 'bu', 'stage');
  if (filters.bu) countsQ.where('bu', filters.bu);
  if (filters.cities) countsQ.whereIn('city', filters.cities);
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

/**
 * PR-O: AOP target changes the viewer hasn't seen yet. "Unseen" = updated
 * after the viewer's `last_aop_seen_at` AND not by the viewer themselves.
 *
 * Null `last_aop_seen_at` (a brand-new admin who has never opened the
 * Dashboard) returns []. We deliberately don't surprise them with the
 * entire change history — they pick up the timestamp on their first
 * "Got it" click, and only see things that happen *after* that.
 */
export interface UnseenAopChange {
  city: string;
  bu: 'CPM' | 'IGIV';
  aop: number;
  updatedAt: string;
  updatedBy: { id: number; name: string };
}

export async function getUnseenAopChanges(viewerId: number): Promise<UnseenAopChange[]> {
  const db = getDb();
  const viewer = await db('users').where({ id: viewerId }).select('last_aop_seen_at').first();
  const lastSeen = viewer?.last_aop_seen_at;
  if (!lastSeen) return [];

  type Row = {
    city: string;
    bu: 'CPM' | 'IGIV';
    aop: number;
    updated_at: string;
    actor_id: number;
    actor_name: string;
  };
  const rows = (await db('headcount as h')
    .innerJoin('users as u', 'h.updated_by_user_id', 'u.id')
    .where('h.updated_at', '>', lastSeen)
    .whereNot('h.updated_by_user_id', viewerId)
    .orderBy('h.updated_at', 'desc')
    .select(
      'h.city',
      'h.bu',
      'h.aop',
      'h.updated_at',
      'u.id as actor_id',
      'u.name as actor_name',
    )) as unknown as Row[];

  return rows.map((r) => ({
    city: r.city,
    bu: r.bu,
    aop: r.aop,
    updatedAt: typeof r.updated_at === 'string' ? r.updated_at : new Date(r.updated_at).toISOString(),
    updatedBy: { id: r.actor_id, name: r.actor_name },
  }));
}
