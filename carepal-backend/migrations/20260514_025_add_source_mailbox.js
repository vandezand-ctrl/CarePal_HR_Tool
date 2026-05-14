/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.alterTable('applications', (table) => {
    table.string('source_mailbox', 255).nullable();
  });
  await knex('applications').update({ source_mailbox: 'ta1@impactguru.com' });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.alterTable('applications', (table) => {
    table.dropColumn('source_mailbox');
  });
}
