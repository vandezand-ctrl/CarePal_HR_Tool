/**
 * Simplify req-approval: two-phase unanimous → single-step BU-based any-one-of.
 *
 * 1. Rename 'Phase 1' / 'Phase 2' → 'Pending Approval' in requisitions.
 * 2. Clear existing requisition_approvals rows (old manual assignments).
 * 3. Insert 4 new approver users needed for BU-based routing.
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  // 1. Collapse Phase 1 / Phase 2 → Pending Approval
  await knex('requisitions')
    .whereIn('status', ['Phase 1', 'Phase 2'])
    .update({ status: 'Pending Approval' });

  // 2. Wipe old manually-assigned approval rows — seeds will re-populate
  await knex('requisition_approvals').del();

  // 3. Add missing BU approvers (idempotent — skip if email already present)
  const newUsers = [
    { email: 'rashi.kharari@impactguru.com', name: 'Rashi Kharari', role: 'approver', city: null, domain: 'impactguru.com' },
    { email: 'ashutosh.sharma@impactguru.com', name: 'Ashutosh Sharma', role: 'approver', city: null, domain: 'impactguru.com' },
    { email: 'neer.samtani@impactguru.com', name: 'Neernidhi Samtani', role: 'approver', city: null, domain: 'impactguru.com' },
    { email: 'harish.goud@impactguru.com', name: 'Harish Goud', role: 'approver', city: null, domain: 'impactguru.com' },
  ];
  for (const u of newUsers) {
    const exists = await knex('users').where('email', u.email).first();
    if (!exists) {
      await knex('users').insert(u);
    }
  }
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  // Reverse status rename
  await knex('requisitions')
    .where('status', 'Pending Approval')
    .update({ status: 'Phase 1' });

  // Remove the 4 added users
  await knex('users').whereIn('email', [
    'rashi.kharari@impactguru.com',
    'ashutosh.sharma@impactguru.com',
    'neer.samtani@impactguru.com',
    'harish.goud@impactguru.com',
  ]).del();
}
