/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('documents', (table) => {
    table.increments('id').primary();
    table.string('candidate_id').notNullable().references('id').inTable('candidates').onDelete('CASCADE');
    table.string('doc_type').notNullable(); // e.g. "Resume", "Motivation Letter", ...
    table.string('filename').notNullable(); // original filename as uploaded
    table.string('storage_key').notNullable(); // local: relative path; S3: bucket key
    table.integer('size_bytes').notNullable();
    table.string('mime_type').notNullable();
    table.integer('uploaded_by_user_id').unsigned().references('id').inTable('users');
    table.timestamp('uploaded_at').defaultTo(knex.fn.now());

    table.unique(['candidate_id', 'doc_type']); // one active doc per type per candidate
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTable('documents');
}
