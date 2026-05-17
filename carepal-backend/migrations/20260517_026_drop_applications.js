// Inbox feature removed — candidates are always entered manually.

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.dropTableIfExists('applications');
  if (await knex.schema.hasColumn('users', 'last_inbox_seen_at')) {
    await knex.schema.alterTable('users', (t) => {
      t.dropColumn('last_inbox_seen_at');
    });
  }
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.createTable('applications', (t) => {
    t.increments('id').primary();
    t.string('email').notNullable();
    t.string('name');
    t.string('status').notNullable().defaultTo('pending');
    t.string('source_mailbox');
    t.text('parsed_name');
    t.text('parsed_role');
    t.text('parsed_city');
    t.text('reject_reason');
    t.string('cv_path');
    t.integer('candidate_id').references('id').inTable('candidates');
    t.timestamps(true, true);
  });
  await knex.schema.alterTable('users', (t) => {
    t.timestamp('last_inbox_seen_at');
  });
}
