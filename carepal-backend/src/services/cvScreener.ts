import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import type { Requisition } from '../models/requisition.js';

export interface ScreeningResult {
  /** 0–100. Higher = better match for the requisition. */
  score: number;
  /** 2–3 sentence rationale shown to the TA below the score badge. */
  explanation: string;
}

// Trim CV text before sending — keeps token cost predictable and avoids
// blowing past the context window on absurdly long PDFs.
const MAX_CV_CHARS = 15_000;

// Sonnet 4.6 is fast, cheap, and excellent at structured JSON output.
// Bump to a newer model when one ships, but don't downgrade — the screening
// rubric assumes a model that understands hiring context.
const MODEL = 'claude-sonnet-4-6';

// System prompt is static across every screening call → marked
// cache_control: ephemeral so we get the 5-minute prompt-cache discount
// on the second screening within the window.
const SYSTEM_PROMPT = `You are a recruiting analyst evaluating CVs for the CarePal Money hiring team.

You score how well a candidate's CV matches a Business Development Associate (BD) requisition for hospitals in India. BDs are field sales agents — strong candidates have field sales / BD / business development / healthcare / fintech / insurance / lending experience, ideally in the requisition's city.

Score 0–100 using this rubric:
  80–100  Strong match. Directly relevant role + ideal location/sector fit.
  60–79   Decent match. Most criteria met; some adjacent experience.
  40–59   Partial match. Some transferable skills but notable gaps.
  20–39   Weak match. Limited overlap; would need significant ramp.
  0–19    Poor match. Largely irrelevant background.

Respond with valid JSON only, no markdown fences, no prose around it:
{"score": <integer 0-100>, "explanation": "<2-3 sentences explaining the score, mentioning specific CV details>"}`;

// ──────────────────────────────────────────────────────────────────────────
// Test injection point — mirrors setDbForTesting in db/index.ts. Tests call
// setScreenerStubForTesting() in before() and clear it in after() so they
// never hit the real Anthropic API. Production code never calls this.
// ──────────────────────────────────────────────────────────────────────────
let _stub: ((cvText: string, requisition: Requisition) => Promise<ScreeningResult>) | null = null;

export function setScreenerStubForTesting(
  stub: ((cvText: string, requisition: Requisition) => Promise<ScreeningResult>) | null,
): void {
  _stub = stub;
}

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  if (!config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  _client = new Anthropic({ apiKey: config.anthropicApiKey });
  return _client;
}

export function isScreeningConfigured(): boolean {
  // Stub counts as configured in tests so the soft-fail path is bypassed
  // and the happy path can be exercised.
  return _stub !== null || Boolean(config.anthropicApiKey);
}

function buildUserPrompt(cvText: string, req: Requisition): string {
  const buExpanded = req.bu === 'CPM' ? 'CPM (CarePal Money — Lending)' : 'IGIV (CarePal Money — Crowdfunding)';
  const bdTypeExpanded =
    req.bdType === 'Focus'
      ? 'Focus BD (dedicated to a single hospital)'
      : 'Floater BD (covers multiple hospitals in the city)';
  const hireTypeLine =
    req.hireType === 'Replacement' && req.replacementFor
      ? `${req.hireType} (replacing ${req.replacementFor})`
      : req.hireType;

  const notesLine = req.notes ? `- Notes: ${req.notes}` : '';

  const truncatedCv = cvText.length > MAX_CV_CHARS ? cvText.slice(0, MAX_CV_CHARS) : cvText;

  return `Score this candidate against the following requisition.

## Requisition
- City: ${req.city}
- Hospital / Location: ${req.hospital}
- BD Type: ${bdTypeExpanded}
- Business Unit: ${buExpanded}
- Hire Type: ${hireTypeLine}
${notesLine}

## Candidate CV
${truncatedCv}

Return JSON only.`;
}

function parseAndValidate(rawText: string): ScreeningResult {
  // Defensive: strip markdown fences if the model wraps the JSON despite the
  // system-prompt instruction.
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Screener returned non-JSON response: ${rawText.slice(0, 200)}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Screener response was not an object');
  }
  const obj = parsed as { score?: unknown; explanation?: unknown };

  const score = Number(obj.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error(`Screener returned invalid score: ${obj.score}`);
  }
  if (typeof obj.explanation !== 'string' || obj.explanation.trim().length < 5) {
    throw new Error('Screener returned invalid explanation');
  }

  return { score: Math.round(score), explanation: obj.explanation.trim() };
}

/**
 * Score a CV against a requisition. Throws on API failures or malformed
 * model output — callers handle these as 500-class errors. Soft conditions
 * (missing key, missing CV) are handled by the route, not here.
 */
export async function screenCv(cvText: string, requisition: Requisition): Promise<ScreeningResult> {
  if (_stub) return _stub(cvText, requisition);

  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(cvText, requisition),
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Screener returned no text content');
  }
  return parseAndValidate(textBlock.text);
}
