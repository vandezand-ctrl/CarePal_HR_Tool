// Drops the deprecated r1_*/r2_* cache fields from candidates. The interviews
// table is now the single source of truth for interview data:
//   - Reads were refactored in PR B (frontend pulls from /api/interviews
//     directly, no more c.r1Date / c.r2Date / etc.)
//   - Writes were removed in PR B (scheduleInterview /
//     recordInterviewResult no longer touch these columns)
//
// By the time this migration runs in production, no code path reads or
// writes these fields. Dropping them is purely a schema cleanup.
//
// down() is included for completeness but recovering the data would require
// re-deriving from the interviews table, which the down migration does not
// attempt — it just re-creates empty columns.

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.alterTable('candidates', (table) => {
    table.dropColumn('r1_by');
    table.dropColumn('r1_date');
    table.dropColumn('r1_result');
    table.dropColumn('r2_by');
    table.dropColumn('r2_date');
    table.dropColumn('r2_result');
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.alterTable('candidates', (table) => {
    table.string('r1_by');
    table.date('r1_date');
    table.string('r1_result');
    table.string('r2_by');
    table.date('r2_date');
    table.string('r2_result');
  });
}
