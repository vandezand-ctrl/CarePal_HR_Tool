import type { User } from '../models/user.js';

/**
 * Returns the effective city list for data-filtering queries.
 * - Admin → null (no filter — sees everything)
 * - Non-admin → user.cities (may be empty → sees nothing)
 */
export function getEffectiveCities(user: User): string[] | null {
  if (user.role === 'admin') return null;
  return user.cities;
}
