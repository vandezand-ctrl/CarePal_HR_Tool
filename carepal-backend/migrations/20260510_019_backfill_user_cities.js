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
  // knex.raw returns [rows, fields] for MySQL, plain rows array for SQLite.
  const rawRows = Array.isArray(cityRows[0]) ? cityRows[0] : cityRows;
  const cities = rawRows.map((r) => r.city);
  if (cities.length === 0) return;

  const users = await knex('users').select('id');
  const insertRows = [];
  for (const user of users) {
    for (const city of cities) {
      insertRows.push({
        user_id: user.id,
        city,
        assigned_by: null,
      });
    }
  }
  if (insertRows.length > 0) {
    await knex.batchInsert('user_cities', insertRows, 500);
  }
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex('user_cities').del();
}
