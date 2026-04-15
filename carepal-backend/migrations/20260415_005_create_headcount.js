/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('headcount', (table) => {
    table.increments('id').primary();
    table.string('city').notNullable();
    table.string('bu').notNullable(); // CPM | IGIV
    table.integer('aop').notNullable(); // Annual Operating Plan — target headcount
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['city', 'bu']); // one row per (city, bu)
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTable('headcount');
}
