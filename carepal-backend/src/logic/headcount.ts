/**
 * Deficit = Target (AOP) - Active.
 * NB: "Offered" candidates are NOT subtracted — per client feedback Apr 9 2026.
 * A negative deficit means over-hired (Active > Target) and is shown as-is.
 */
export function calculateDeficit(target: number, active: number): number {
  return target - active;
}
