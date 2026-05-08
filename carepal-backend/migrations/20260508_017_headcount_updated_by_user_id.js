// PR-O: track which admin made the most recent AOP edit on each headcount row,
// so the Dashboard can show a "changes since you last viewed" toast that
// excludes the viewer's own edits.
//
// .unsigned() matters: users.id is `increments()` which is `int unsigned` on
// MySQL. Without it, MySQL 8 rejects the FK as type-incompatible (the same
// gotcha that bit Stage 10's documents migration on the first prod deploy —
// SQLite ignores the modifier silently, MySQL doesn't).
//
// Nullable: pre-existing rows have no actor recorded. The unseen-changes
// query treats NULL as "system / pre-PR-O" (it never matches != viewerId), so
// no spurious notifications fire on the first deploy.

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.alterTable('headcount', (table) => {
    table.integer('updated_by_user_id').unsigned().nullable().references('id').inTable('users');
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.alterTable('headcount', (table) => {
    table.dropColumn('updated_by_user_id');
  });
}
