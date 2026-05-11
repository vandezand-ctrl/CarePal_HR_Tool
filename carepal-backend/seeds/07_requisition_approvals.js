/**
 * Seed req-approval rows for 'Pending Approval' requisitions using BU-based routing.
 *
 * REQ-003 = IGIV → Neer, Lazar, Harish
 * REQ-004 = CPM  → Rashi, Ashutosh, Soundappan
 * REQ-008 = CPM  → Rashi, Ashutosh, Soundappan
 */

const BU_APPROVER_EMAILS = {
  CPM: ['rashi.kharari@impactguru.com', 'ashutosh.sharma@impactguru.com', 'soundappan@carepalmoney.com'],
  IGIV: ['neer.samtani@impactguru.com', 'lazer@carepalmoney.com', 'harish.goud@impactguru.com'],
};

/** @param {import('knex').Knex} knex */
export async function seed(knex) {
  await knex('requisition_approvals').del();

  const allEmails = [...BU_APPROVER_EMAILS.CPM, ...BU_APPROVER_EMAILS.IGIV];
  const users = await knex('users').whereIn('email', allEmails).select('id', 'email');
  const emailToId = Object.fromEntries(users.map((u) => [u.email, u.id]));

  const rows = [];
  for (const [reqId, bu] of [['REQ-003', 'IGIV'], ['REQ-004', 'CPM'], ['REQ-008', 'CPM']]) {
    for (const email of BU_APPROVER_EMAILS[bu]) {
      const userId = emailToId[email];
      if (userId) rows.push({ requisition_id: reqId, phase: 1, user_id: userId, assigned_by: null });
    }
  }

  if (rows.length) await knex('requisition_approvals').insert(rows);
}
