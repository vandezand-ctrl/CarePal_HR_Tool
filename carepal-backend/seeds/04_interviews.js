/**
 * Seed interviews from existing candidate r1/r2 denormalized data.
 * The r1 and r2 columns on `candidates` stay populated as a materialized cache,
 * maintained by the API on every interview write.
 *
 * @param {import('knex').Knex} knex
 */
export async function seed(knex) {
  await knex('interviews').del();

  const candidates = await knex('candidates').select('*');
  const rows = [];

  for (const c of candidates) {
    if (c.r1_date && c.r1_by) {
      rows.push({
        candidate_id: c.id,
        round: 1,
        interviewer_name: c.r1_by,
        scheduled_date: c.r1_date,
        scheduled_time: null,
        mode: 'Virtual',
        location_or_link: null,
        result: c.r1_result,
      });
    }
    if (c.r2_date && c.r2_by) {
      rows.push({
        candidate_id: c.id,
        round: 2,
        interviewer_name: c.r2_by,
        scheduled_date: c.r2_date,
        scheduled_time: null,
        mode: 'Virtual',
        location_or_link: null,
        result: c.r2_result,
      });
    }
  }

  if (rows.length > 0) await knex('interviews').insert(rows);
}
