/**
 * PR-Q: two-phase requisition approval.
 *
 * Join table linking requisitions to their assigned approvers per phase.
 * Each requisition has phase 1 and phase 2 approvers (1-3 per phase).
 * All assigned approvers must approve before the phase advances.
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('requisition_approvals', (table) => {
    table.increments('id').primary();
    table
      .string('requisition_id')
      .notNullable()
      .references('id')
      .inTable('requisitions')
      .onDelete('CASCADE');
    table.integer('phase').notNullable(); // 1 or 2
    table
      .integer('user_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users');
    table.timestamp('approved_at').nullable();
    table.timestamp('assigned_at').defaultTo(knex.fn.now());
    table
      .integer('assigned_by')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['requisition_id', 'phase', 'user_id']);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('requisition_approvals');
}
