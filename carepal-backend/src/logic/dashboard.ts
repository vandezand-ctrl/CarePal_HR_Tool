import { PIPELINE_STAGES, PipelineStage } from '../models/candidate.js';

// ── Pure aggregation helpers ────────────────────────────────────────────────
// All functions take already-filtered inputs (caller handles BU filter).
// They contain no DB access and no side effects — safe to unit-test.

export interface FunnelCount {
  stage: PipelineStage;
  count: number;
}

/**
 * Funnel counts for every pipeline stage, in canonical order. Stages with
 * zero candidates still appear (returns a fixed-shape array). This makes
 * the frontend chart code simpler (no gaps).
 */
export function funnelCounts(candidateStages: PipelineStage[]): FunnelCount[] {
  const bucket = new Map<PipelineStage, number>();
  for (const s of PIPELINE_STAGES) bucket.set(s, 0);
  for (const stage of candidateStages) {
    if (bucket.has(stage)) bucket.set(stage, (bucket.get(stage) ?? 0) + 1);
  }
  return PIPELINE_STAGES.map((stage) => ({ stage, count: bucket.get(stage) ?? 0 }));
}

export interface TopLineCounts {
  openPositions: number;
  candidatesInPipe: number;
  offersExtended: number;
  confirmedJoins: number;
}

/**
 * Headline KPI numbers for the four Dashboard stat cards.
 * - openPositions: requisitions in status != 'Filled'
 * - candidatesInPipe: candidates NOT in terminal stages (Offered / Joined)
 * - offersExtended: Offered OR Joined (cumulative — "has been offered")
 * - confirmedJoins: stage = Joined
 */
export function topLineCounts(
  requisitionStatuses: string[],
  candidateStages: PipelineStage[],
): TopLineCounts {
  const openPositions = requisitionStatuses.filter((s) => s !== 'Filled').length;
  const candidatesInPipe = candidateStages.filter((s) => s !== 'Offered' && s !== 'Joined').length;
  const offersExtended = candidateStages.filter((s) => s === 'Offered' || s === 'Joined').length;
  const confirmedJoins = candidateStages.filter((s) => s === 'Joined').length;
  return { openPositions, candidatesInPipe, offersExtended, confirmedJoins };
}

export interface PendingApprovalItem {
  id: string;
  city: string;
  hospital: string;
  bu: string;
  bdType: string;
  hireType: string;
  raisedBy: string;
  date: string;
}

/**
 * Requisitions awaiting approval, in a stable slim shape.
 */
export function pendingApprovals<
  T extends {
    id: string;
    city: string;
    hospital: string;
    bu: string;
    bdType: string;
    hireType: string;
    raisedBy: string;
    date: string;
    status: string;
  },
>(reqs: T[]): PendingApprovalItem[] {
  return reqs
    .filter((r) => r.status === 'Pending Approval')
    .map(({ id, city, hospital, bu, bdType, hireType, raisedBy, date }) => ({
      id,
      city,
      hospital,
      bu,
      bdType,
      hireType,
      raisedBy,
      date,
    }));
}

export interface CityRow {
  city: string;
  aopTotal: number;
  activeTotal: number;
  deficitTotal: number;
  openReqs: number;
  candidates: number; // total candidates sourced into this city (any stage)
  hospitals: { hospital: string; openReqs: number }[];
}

function emptyRow(city: string): CityRow {
  return { city, aopTotal: 0, activeTotal: 0, deficitTotal: 0, openReqs: 0, candidates: 0, hospitals: [] };
}

/**
 * Per-city aggregation combining headcount targets + live candidates + reqs.
 * Headcount rows expected to be the auto-calculated view (see models/headcount).
 */
export function cityBreakdown(
  headcountRows: Array<{ city: string; aop: number; active: number; deficit: number }>,
  requisitions: Array<{ city: string; hospital: string; status: string }>,
  candidates: Array<{ city: string }> = [],
): CityRow[] {
  const cityMap = new Map<string, CityRow>();

  for (const h of headcountRows) {
    const row = cityMap.get(h.city) ?? emptyRow(h.city);
    row.aopTotal += h.aop;
    row.activeTotal += h.active;
    row.deficitTotal += h.deficit;
    cityMap.set(h.city, row);
  }

  const openReqs = requisitions.filter((r) => r.status !== 'Filled');
  for (const r of openReqs) {
    const row = cityMap.get(r.city) ?? emptyRow(r.city);
    row.openReqs += 1;
    const existingH = row.hospitals.find((h) => h.hospital === r.hospital);
    if (existingH) existingH.openReqs += 1;
    else row.hospitals.push({ hospital: r.hospital, openReqs: 1 });
    cityMap.set(r.city, row);
  }

  for (const c of candidates) {
    const row = cityMap.get(c.city) ?? emptyRow(c.city);
    row.candidates += 1;
    cityMap.set(c.city, row);
  }

  return [...cityMap.values()].sort((a, b) => a.city.localeCompare(b.city));
}
