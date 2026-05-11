/**
 * PR-Q: rename 'Pending Approval' status to 'Phase 1'.
 *
 * New status flow: Phase 1 → Phase 2 → Approved → Active → Filled.
 * Existing rows with 'Approved', 'Active', 'Filled' are untouched.
 * Existing 'Phase 1' rows will have zero approvers until an admin assigns them.
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex('requisitions')
    .where('status', 'Pending Approval')
    .update({ status: 'Phase 1' });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex('requisitions')
    .where('status', 'Phase 1')
    .update({ status: 'Pending Approval' });
  await knex('requisitions')
    .where('status', 'Phase 2')
    .update({ status: 'Pending Approval' });
}
