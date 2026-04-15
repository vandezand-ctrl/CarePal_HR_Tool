/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('requisitions', (table) => {
    table.string('id').primary(); // e.g. REQ-001
    table.string('city').notNullable();
    table.string('hospital').notNullable();
    table.string('area');
    table.string('bd_type').notNullable(); // Focus | Floater
    table.string('bu').notNullable(); // CPM | IGIV
    table.string('hire_type').notNullable(); // New | Replacement
    table.string('replacement_for');
    table.string('raised_by').notNullable();
    table.date('date').notNullable();
    table.string('status').notNullable().defaultTo('Pending Approval');
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTable('requisitions');
}
