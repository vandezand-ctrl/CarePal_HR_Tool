/**
 * Seed interview rows. Previously this seed derived its data from the
 * candidate r1_/r2_ cache columns (r1_by, r1_date, r1_result, r2_by, r2_date,
 * r2_result); those were dropped in PR C of the Interviews-page rebuild
 * (migration 20260428_009), so the rows are now listed explicitly here.
 * Mirrors the historical state the seed used to produce — same candidates,
 * same dates, same outcomes.
 *
 * @param {import('knex').Knex} knex
 */
export async function seed(knex) {
  await knex('interviews').del();
  await knex('interviews').insert([
    // C-001 (Sakthivel A) — R2 Complete, both rounds Select
    { candidate_id: 'C-001', round: 1, interviewer_name: 'Lazer Rajan',     scheduled_date: '2025-12-03', scheduled_time: null, mode: 'Virtual', location_or_link: null, result: 'Select' },
    { candidate_id: 'C-001', round: 2, interviewer_name: 'Soundappan Gopal', scheduled_date: '2025-12-10', scheduled_time: null, mode: 'Virtual', location_or_link: null, result: 'Select' },

    // C-002 (Ravikumar K M) — Joined, both rounds Select
    { candidate_id: 'C-002', round: 1, interviewer_name: 'Gaurav Sharma',  scheduled_date: '2025-11-06', scheduled_time: null, mode: 'Virtual', location_or_link: null, result: 'Select' },
    { candidate_id: 'C-002', round: 2, interviewer_name: 'Ankita Kumari',  scheduled_date: '2025-11-12', scheduled_time: null, mode: 'Virtual', location_or_link: null, result: 'Select' },

    // C-003 (Priya Sharma) — R1 Scheduled, no result yet
    { candidate_id: 'C-003', round: 1, interviewer_name: 'Himanshu Jaiswal', scheduled_date: '2026-04-08', scheduled_time: null, mode: 'Virtual', location_or_link: null, result: null },

    // C-005 (Lalith Singh) — R1 Scheduled, no result yet
    { candidate_id: 'C-005', round: 1, interviewer_name: 'Khazim Syed',    scheduled_date: '2026-04-06', scheduled_time: null, mode: 'Virtual', location_or_link: null, result: null },

    // C-007 (Arjun Mullick) — Offered, both rounds Select
    { candidate_id: 'C-007', round: 1, interviewer_name: 'Bhavesh N',     scheduled_date: '2026-03-25', scheduled_time: null, mode: 'Virtual', location_or_link: null, result: 'Select' },
    { candidate_id: 'C-007', round: 2, interviewer_name: 'Ankita Kumari', scheduled_date: '2026-03-28', scheduled_time: null, mode: 'Virtual', location_or_link: null, result: 'Select' },

    // C-008 (Tarkeshhwar R) — R2 Scheduled
    { candidate_id: 'C-008', round: 1, interviewer_name: 'Khazim Syed', scheduled_date: '2025-08-20', scheduled_time: null, mode: 'Virtual', location_or_link: null, result: 'Select' },
    { candidate_id: 'C-008', round: 2, interviewer_name: 'Bhavesh N',   scheduled_date: '2026-04-07', scheduled_time: null, mode: 'Virtual', location_or_link: null, result: null },
  ]);
}
