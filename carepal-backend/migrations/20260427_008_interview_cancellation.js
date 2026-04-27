// Adds soft-cancel columns to interviews. The new Interviews page lets users
// cancel a scheduled interview (e.g. interviewer sick, candidate withdrew);
// soft-delete preserves the audit trail vs a hard DELETE.
//
// Both columns are nullable because every existing row predates this column —
// they default to NULL meaning "active, not cancelled".

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.alterTable('interviews', (table) => {
    table.timestamp('cancelled_at').nullable();
    table.string('cancelled_reason').nullable();
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.alterTable('interviews', (table) => {
    table.dropColumn('cancelled_reason');
    table.dropColumn('cancelled_at');
  });
}
