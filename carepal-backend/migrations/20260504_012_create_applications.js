/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('applications', (table) => {
    table.increments('id').primary();
    table.string('gmail_message_id', 255).unique().nullable();
    table.string('sender_email', 255).notNullable();
    table.string('sender_name', 255).nullable();
    table.string('subject', 500).nullable();
    table.datetime('received_at').notNullable();
    table.string('cv_storage_key', 500).nullable();
    table.string('cover_letter_storage_key', 500).nullable();
    table.string('parsed_name', 255).nullable();
    table.string('parsed_phone', 50).nullable();
    table.string('parsed_email', 255).nullable();
    table.text('body_snippet').nullable();
    table.string('status', 20).notNullable().defaultTo('pending');
    table.integer('reviewed_by').unsigned().nullable().references('id').inTable('users');
    table.datetime('reviewed_at').nullable();
    table.text('reject_reason').nullable();
    table.string('candidate_id', 20).nullable().references('id').inTable('candidates');
    table.timestamps(true, true);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('applications');
}
