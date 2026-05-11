import { getDb } from '../db/index.js';

// BU-based req-approval routing. Maps each BU to the emails of users who
// can approve requisitions for that BU. Any ONE approval is sufficient.
// Admins (e.g. Sahil) can approve any BU — handled via the admin role
// check in the route, not by listing them here.
export const BU_APPROVER_EMAILS: Record<string, string[]> = {
  CPM: [
    'rashi.kharari@impactguru.com',
    'ashutosh.sharma@impactguru.com',
    'soundappan@carepalmoney.com',
  ],
  IGIV: [
    'neer.samtani@impactguru.com',
    'lazer@carepalmoney.com',
    'harish.goud@impactguru.com',
  ],
};

export async function getApproverIdsForBU(bu: string): Promise<number[]> {
  const emails = BU_APPROVER_EMAILS[bu];
  if (!emails || emails.length === 0) {
    throw new Error(`No approver routing configured for BU: ${bu}`);
  }
  const rows = await getDb()('users')
    .whereIn('email', emails)
    .select<Array<{ id: number }>>('id');
  if (rows.length === 0) {
    throw new Error(`No approver users found in DB for BU: ${bu}`);
  }
  return rows.map((r) => r.id);
}
