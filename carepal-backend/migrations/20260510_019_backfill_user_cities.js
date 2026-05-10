/**
 * Backfill user_cities: give every existing user access to every city that
 * appears in headcount or requisitions. This ensures nothing breaks on deploy.
 *
 * New users created after this migration will start with zero cities
 * (sees nothing) until an admin grants access.
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  const cityRows = await knex.raw(`
    SELECT DISTINCT city FROM (
      SELECT city FROM headcount WHERE city IS NOT NULL
      UNION
      SELECT city FROM requisitions WHERE city IS NOT NULL
    ) AS all_cities
    ORDER BY city
  `);
  // knex.raw returns different shapes for SQLite vs MySQL.
  const cities = (Array.isArray(cityRows) ? cityRows : cityRows[0] || []).map(
    (r) => r.city,
  );
  if (cities.length === 0) return;

  const users = await knex('users').select('id');
  const rows = [];
  for (const user of users) {
    for (const city of cities) {
      rows.push({
        user_id: user.id,
        city,
        assigned_by: null,
      });
    }
  }
  if (rows.length > 0) {
    await knex.batchInsert('user_cities', rows, 500);
  }
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex('user_cities').del();
}
