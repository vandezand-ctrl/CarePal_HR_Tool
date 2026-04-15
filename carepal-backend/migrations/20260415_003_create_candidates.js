/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('candidates', (table) => {
    table.string('id').primary(); // e.g. C-001
    table.string('req_id').notNullable().references('id').inTable('requisitions').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('phone').notNullable();
    table.string('email');
    table.string('city').notNullable();
    table.string('current_role').notNullable();
    table.string('company').notNullable();
    table.integer('current_ctc'); // annual salary in INR, nullable
    table.integer('expected_ctc');
    table.string('notice'); // "Immediate" | "7 Days" | "15 Days" | "30 Days" | null
    table.string('ta').notNullable(); // TA recruiter name (FK to users.name deferred)
    table.date('sourced_at').notNullable();
    table.string('stage').notNullable().defaultTo('Sourced');
    table.string('bu').notNullable(); // redundant with req.bu but kept for filtering

    // Interview fields — transitional, will migrate to `interviews` table in Stage 4
    table.string('r1_by');
    table.date('r1_date');
    table.string('r1_result'); // Select | Reject | null
    table.string('r2_by');
    table.date('r2_date');
    table.string('r2_result');

    table.date('offer_date');
    table.date('join_date');

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTable('candidates');
}
