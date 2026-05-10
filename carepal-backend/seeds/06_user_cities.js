/**
 * Seed: give every user access to every city. Mirrors the backfill
 * migration (019) but runs after seed data is populated.
 *
 * @param {import('knex').Knex} knex
 */
export async function seed(knex) {
  await knex('user_cities').del();

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
      insertRows.push({ user_id: user.id, city, assigned_by: null });
    }
  }
  if (insertRows.length > 0) {
    await knex.batchInsert('user_cities', insertRows, 500);
  }
}
