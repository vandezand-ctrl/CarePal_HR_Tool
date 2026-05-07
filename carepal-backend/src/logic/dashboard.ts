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

// Post-offer stages used by the topLineCounts semantics — anyone in any of
// these has already been offered. Order matches the canonical pipeline.
const POST_OFFER_STAGES: PipelineStage[] = ['Offered', 'Joined', 'Training', 'Active'];
const POST_JOIN_STAGES: PipelineStage[] = ['Joined', 'Training', 'Active'];

/**
 * Headline KPI numbers for the four Dashboard stat cards.
 * - openPositions: requisitions in status != 'Filled'
 * - candidatesInPipe: candidates NOT yet in any post-offer stage
 * - offersExtended: cumulative — "has been offered" (Offered + Joined + Training + Active)
 * - confirmedJoins: cumulative — "has joined" (Joined + Training + Active)
 *
 * Why cumulative rather than current-stage-only: the dashboard answers the
 * question "how many offers have we made this period?" — once offered, the
 * candidate counts forever (until rejected or hidden, which we don't model).
 */
export function topLineCounts(
  requisitionStatuses: string[],
  candidateStages: PipelineStage[],
): TopLineCounts {
  const openPositions = requisitionStatuses.filter((s) => s !== 'Filled').length;
  const candidatesInPipe = candidateStages.filter((s) => !POST_OFFER_STAGES.includes(s)).length;
  const offersExtended = candidateStages.filter((s) => POST_OFFER_STAGES.includes(s)).length;
  const confirmedJoins = candidateStages.filter((s) => POST_JOIN_STAGES.includes(s)).length;
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
  // Per-BU breakdown of the AOP target. Populated from the same headcount rows
  // that feed aopTotal; the All-BUs Dashboard view uses this to prefill the
  // per-BU edit popover (PR-N). When the dashboard is filtered to a single BU
  // the unselected BU's value will be 0 — that's expected, the popover only
  // opens in All-BUs view anyway.
  aopByBu: { CPM: number; IGIV: number };
  activeTotal: number;
  noticeTotal: number;
  pipTotal: number;
  trainingTotal: number;
  offeredTotal: number;
  deficitTotal: number;
  openReqs: number;
  candidates: number; // total candidates sourced into this city (any stage)
  hospitals: { hospital: string; openReqs: number }[];
}

function emptyRow(city: string): CityRow {
  return {
    city,
    aopTotal: 0,
    aopByBu: { CPM: 0, IGIV: 0 },
    activeTotal: 0,
    noticeTotal: 0,
    pipTotal: 0,
    trainingTotal: 0,
    offeredTotal: 0,
    deficitTotal: 0,
    openReqs: 0,
    candidates: 0,
    hospitals: [],
  };
}

/**
 * Per-city aggregation combining headcount targets + live candidates + reqs.
 * Headcount rows expected to be the auto-calculated view (see models/headcount).
 * notice/pip/training are placeholder zeros until the Sujeet integration lands —
 * they're summed here so the shape stays stable when real data arrives.
 */
export function cityBreakdown(
  headcountRows: Array<{
    city: string;
    bu: 'CPM' | 'IGIV';
    aop: number;
    active: number;
    notice: number;
    pip: number;
    training: number;
    offered: number;
    deficit: number;
  }>,
  requisitions: Array<{ city: string; hospital: string; status: string }>,
  candidates: Array<{ city: string }> = [],
): CityRow[] {
  const cityMap = new Map<string, CityRow>();

  for (const h of headcountRows) {
    const row = cityMap.get(h.city) ?? emptyRow(h.city);
    row.aopTotal += h.aop;
    row.aopByBu[h.bu] += h.aop;
    row.activeTotal += h.active;
    row.noticeTotal += h.notice;
    row.pipTotal += h.pip;
    row.trainingTotal += h.training;
    row.offeredTotal += h.offered;
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

/**
 * Empty-state nudge for the Dashboard. PR-N: shown to admins on first sign-in
 * before any AOP target has been set, with a CTA pointing at the Target HC
 * pencil. Strict trigger — disappears the moment any (city, bu) target is
 * non-zero, so no dismiss state to manage. Gated to All-BUs view to avoid
 * false positives when the user is filtered to one BU that happens to be
 * unset while the other has targets.
 */
export function shouldShowEmptyTargetsBanner(
  rows: CityRow[],
  bu: 'all' | 'CPM' | 'IGIV',
): boolean {
  if (bu !== 'all') return false;
  return rows.every((r) => r.aopTotal === 0);
}
