/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('interviews', (table) => {
    table.increments('id').primary();
    table.string('candidate_id').notNullable().references('id').inTable('candidates').onDelete('CASCADE');
    table.integer('round').notNullable(); // 1 or 2
    table.string('interviewer_name').notNullable(); // display name; later we can FK to users
    table.date('scheduled_date').notNullable();
    table.string('scheduled_time'); // "14:00" (optional)
    table.string('mode').notNullable(); // 'Virtual' | 'In-Person'
    table.string('location_or_link'); // Meet link or address
    table.string('result'); // 'Select' | 'Reject' | null
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['candidate_id', 'round']); // one R1 + one R2 per candidate
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTable('interviews');
}
