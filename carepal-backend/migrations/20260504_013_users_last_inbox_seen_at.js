/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.datetime('last_inbox_seen_at').nullable();
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('last_inbox_seen_at');
  });
}
