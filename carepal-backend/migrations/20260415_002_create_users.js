/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('email').notNullable().unique();
    table.string('name').notNullable();
    table.string('role').notNullable(); // admin | approver | ta
    table.string('city'); // optional — for TA and city leads
    table.string('domain').notNullable(); // carepalmoney.com | impactguru.com
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTable('users');
}
