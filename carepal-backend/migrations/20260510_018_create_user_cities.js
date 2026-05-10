/**
 * Per-user city-access scoping.
 *
 * Many-to-many join between users and cities. Admins always see everything
 * (enforced in application code); non-admin users only see data for the
 * cities listed here. An empty set means "sees nothing."
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('user_cities', (table) => {
    table.increments('id').primary();
    table
      .integer('user_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.string('city').notNullable();
    table
      .integer('assigned_by')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['user_id', 'city']);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('user_cities');
}
