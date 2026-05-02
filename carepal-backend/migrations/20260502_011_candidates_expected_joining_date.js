/**
 * Add Expected Joining Date to candidates (PR-E / C2 in Apr 29 backlog).
 * TA team fills this in manually once a candidate hits the Offered stage.
 * Surfaced on the Requisitions tab as the "Expected Joining" column (R5).
 *
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  await knex.schema.alterTable('candidates', (table) => {
    table.date('expected_joining_date').nullable();
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.alterTable('candidates', (table) => {
    table.dropColumn('expected_joining_date');
  });
}
