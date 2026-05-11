/**
 * Seed requisition_approvals for the three Phase 1 requisitions (REQ-003, REQ-004, REQ-008).
 * Uses user IDs from seeds/02_users.js (auto-increment starts at 1):
 *   1 = Sahil (admin), 2 = Akhlaque (admin),
 *   3 = Soundappan (approver), 4 = Ankita (approver), 5 = Bhavesh (approver),
 *   6 = Mahesh (approver), 7 = Varun (approver), 8 = Gourav (approver)
 */

/** @param {import('knex').Knex} knex */
export async function seed(knex) {
  await knex('requisition_approvals').del();
  await knex('requisition_approvals').insert([
    // REQ-003 (Delhi, IGIV, raised by Mahesh Anand)
    { requisition_id: 'REQ-003', phase: 1, user_id: 3, assigned_by: 6 },  // Soundappan
    { requisition_id: 'REQ-003', phase: 1, user_id: 7, assigned_by: 6 },  // Varun
    { requisition_id: 'REQ-003', phase: 2, user_id: 1, assigned_by: 6 },  // Sahil
    { requisition_id: 'REQ-003', phase: 2, user_id: 2, assigned_by: 6 },  // Akhlaque

    // REQ-004 (Mumbai, CPM, raised by Varun Vishwanath)
    { requisition_id: 'REQ-004', phase: 1, user_id: 3, assigned_by: 7 },  // Soundappan
    { requisition_id: 'REQ-004', phase: 2, user_id: 1, assigned_by: 7 },  // Sahil

    // REQ-008 (Delhi, CPM, raised by Gourav Singh)
    { requisition_id: 'REQ-008', phase: 1, user_id: 6, assigned_by: 8 },  // Mahesh
    { requisition_id: 'REQ-008', phase: 1, user_id: 7, assigned_by: 8 },  // Varun
    { requisition_id: 'REQ-008', phase: 2, user_id: 1, assigned_by: 8 },  // Sahil
  ]);
}
