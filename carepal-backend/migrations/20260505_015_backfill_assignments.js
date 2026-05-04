/**
 * PR-L: backfill candidate_assignments from the legacy `candidates.ta`
 * string column, then drop that column.
 *
 * Strategy:
 *  1. For each candidate, look up a user whose `name` matches `candidates.ta`
 *     case-insensitively. Insert one row into candidate_assignments.
 *  2. After backfill, verify every candidate has >=1 assignment row. If any
 *     candidate is left orphaned (no name match), throw — this halts the
 *     deploy and forces manual cleanup before the legacy column is dropped.
 *  3. Drop `candidates.ta`.
 *
 * Pre-deploy audit (run in Cloud SQL Studio before merging the PR):
 *   SELECT c.id, c.ta
 *   FROM candidates c
 *   LEFT JOIN users u ON LOWER(u.name) = LOWER(c.ta)
 *   WHERE u.id IS NULL;
 *
 * Should return zero rows. If not, UPDATE the offending candidate's `ta`
 * column to a real user name first.
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  // 1. Backfill: insert one (candidate_id, user_id) row per candidate, joining
  // case-insensitively on user name.
  // SQLite + MySQL both support this CTE-free form.
  const candidates = await knex('candidates').select('id', 'ta');
  for (const c of candidates) {
    if (!c.ta) {
      throw new Error(
        `PR-L backfill: candidate ${c.id} has no \`ta\` value. Fix in DB before re-running.`,
      );
    }
    const user = await knex('users')
      .whereRaw('LOWER(name) = LOWER(?)', [c.ta])
      .first('id');
    if (!user) {
      throw new Error(
        `PR-L backfill: candidate ${c.id} has ta='${c.ta}' which does not match any user (case-insensitive). Run the audit query in Cloud SQL Studio (see migration header) and fix before re-deploying.`,
      );
    }
    await knex('candidate_assignments').insert({
      candidate_id: c.id,
      user_id: user.id,
      assigned_at: knex.fn.now(),
      assigned_by: null,
    });
  }

  // 2. Sanity check: every candidate now has >=1 assignment.
  const orphans = await knex('candidates as c')
    .leftJoin('candidate_assignments as ca', 'c.id', 'ca.candidate_id')
    .whereNull('ca.id')
    .select('c.id');
  if (orphans.length > 0) {
    throw new Error(
      `PR-L backfill: ${orphans.length} candidate(s) without an assignment after backfill: ${orphans.map((o) => o.id).join(', ')}. Aborting before drop of \`ta\` column.`,
    );
  }

  // 3. Drop the now-redundant `ta` column.
  await knex.schema.alterTable('candidates', (table) => {
    table.dropColumn('ta');
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  // Reverse: re-add the `ta` column and reconstruct the value from the first
  // assignment per candidate.
  await knex.schema.alterTable('candidates', (table) => {
    table.string('ta').notNullable().defaultTo('');
  });
  const rows = await knex('candidate_assignments as ca')
    .join('users as u', 'u.id', 'ca.user_id')
    .select('ca.candidate_id', 'u.name')
    .orderBy('ca.assigned_at', 'asc');
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.candidate_id)) continue;
    seen.add(r.candidate_id);
    await knex('candidates').where({ id: r.candidate_id }).update({ ta: r.name });
  }
  await knex('candidate_assignments').del();
}
