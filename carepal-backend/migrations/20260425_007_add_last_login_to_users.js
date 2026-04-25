// Adds last_login_at to users so we can show "last seen N days ago" in the
// admin User Management UI and prune dormant accounts later.
//
// Nullable because every existing user predates this column - they get NULL
// until the next time they sign in. The Google auth middleware (and the mock
// auth middleware) bumps this on every successful authentication.

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.timestamp('last_login_at').nullable();
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('last_login_at');
  });
}
