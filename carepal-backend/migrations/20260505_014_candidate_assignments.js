/**
 * PR-L: multi-TA assignment.
 *
 * Replaces the single `candidates.ta` string column with a many-to-many
 * relationship in a dedicated join table. The companion migration
 * `20260505_015_backfill_assignments` does the backfill + drops the
 * legacy column once every existing candidate has at least one row here.
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('candidate_assignments', (table) => {
    table.increments('id').primary();
    table
      .string('candidate_id')
      .notNullable()
      .references('id')
      .inTable('candidates')
      .onDelete('CASCADE');
    table
      .integer('user_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users');
    // assigned_at: when this user was added to the candidate. Set to NOW
    // for new assignments; the backfill migration uses NOW too.
    table.timestamp('assigned_at').defaultTo(knex.fn.now());
    // assigned_by: who initiated the assignment (nullable so the backfill
    // can use NULL for the historical rows where we don't know).
    table
      .integer('assigned_by')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    // Prevent the same user from being assigned to the same candidate twice.
    table.unique(['candidate_id', 'user_id']);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('candidate_assignments');
}
