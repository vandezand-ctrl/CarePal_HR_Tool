export interface ExtractedFields {
  name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  role: string | null;
  city: string | null;
}

const CITY_VARIANTS: { pattern: RegExp; canonical: string }[] = [
  { pattern: /\bahmedabad\b/i, canonical: 'Ahmedabad' },
  { pattern: /\bbangalore\b/i, canonical: 'Bangalore' },
  { pattern: /\bbengaluru\b/i, canonical: 'Bangalore' },
  { pattern: /\bbhubaneswar\b/i, canonical: 'Bhubaneswar' },
  { pattern: /\bchennai\b/i, canonical: 'Chennai' },
  { pattern: /\bdelhi\b/i, canonical: 'Delhi' },
  { pattern: /\bnew delhi\b/i, canonical: 'Delhi' },
  { pattern: /\bhyderabad\b/i, canonical: 'Hyderabad' },
  { pattern: /\bindore\b/i, canonical: 'Indore' },
  { pattern: /\bkochi\b/i, canonical: 'Kochi' },
  { pattern: /\bkolkata\b/i, canonical: 'Kolkata' },
  { pattern: /\bmumbai\b/i, canonical: 'Mumbai' },
  { pattern: /\bpune\b/i, canonical: 'Pune' },
];

const HEADER_KEYWORDS = new Set([
  'resume', 'curriculum vitae', 'cv', 'biodata', 'bio-data', 'bio data',
]);

const SECTION_HEADERS = /^(career\s*objective|objective|skills?|education|work\s*experience|experience|professional\s*(experience|summary)|qualifications?|personal\s*details?|declaration|hobbies|interests?|languages?|profile|key\s*skills|projects?|certifications?|achievements?|references?)/i;

const CURRENT_MARKERS = /currently\s*work|working\s+as\s+|present|current/i;

function extractPhone(text: string): string | null {
  // Strip all spaces/dashes/dots between digits so "86689 87433" → "8668987433",
  // then strip leading country code (+91 / 91).
  const stripped = text.replace(/(\d)[\s.\-]+(?=\d)/g, '$1');
  // Remove +91 or 91 prefix before the 10-digit number
  const normalised = stripped.replace(/(?<!\d)(?:\+?91)([6-9]\d{9})(?!\d)/g, '$1');
  const match = normalised.match(/(?<!\d)[6-9]\d{9}(?!\d)/);
  return match ? match[0] : null;
}

function extractEmail(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase() : null;
}

function extractCity(text: string): string | null {
  for (const { pattern, canonical } of CITY_VARIANTS) {
    if (pattern.test(text)) return canonical;
  }
  return null;
}

function extractName(lines: string[]): string | null {
  for (const line of lines.slice(0, 15)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 2) continue;
    const lower = trimmed.toLowerCase().replace(/[:\-–—]/g, '').trim();
    if (HEADER_KEYWORDS.has(lower)) continue;
    if (SECTION_HEADERS.test(lower)) continue;
    if (/^(phone|mobile|email|e-?mail|contact|address|dob|date\s*of\s*birth)/i.test(lower)) continue;
    if (/^\d/.test(trimmed)) continue;
    if (trimmed.includes('@')) continue;

    const nameMatch = trimmed.match(/^(?:name\s*[:]\s*)(.+)/i);
    if (nameMatch) return nameMatch[1].trim();

    if (/^[A-Z][a-zA-Z.\s'-]{1,50}$/.test(trimmed) && trimmed.split(/\s+/).length <= 5) {
      return trimmed;
    }
  }
  return null;
}

function extractCurrentEmployer(text: string): { company: string | null; role: string | null } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    if (!CURRENT_MARKERS.test(lines[i])) continue;

    // Pattern A: "Organization : Company Name" near a current-marker line
    for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 1); j++) {
      const orgMatch = lines[j].match(/(?:organization|company|employer)\s*[:]\s*(.+)/i);
      if (orgMatch) {
        const role = findRoleNearIndex(lines, j);
        return { company: orgMatch[1].trim(), role };
      }
    }

    // Pattern B: "Working as a [role] at [company]" sentence (common in Indian CVs)
    const sentenceMatch = lines[i].match(/(?:work(?:ing|ed)?)\s+(?:as\s+(?:an?\s+)?)?(.+?)\s+(?:at|in|with)\s+(.+?)(?:\s+where|\s+since|\s+from|\.|,|$)/i);
    if (sentenceMatch) {
      return { role: sentenceMatch[1].trim(), company: sentenceMatch[2].trim() };
    }

    const roleLine = findRoleNearIndex(lines, i);

    // Pattern C: pipe-separated "Role | Company | Location" lines
    for (let j = Math.max(0, i - 3); j <= i; j++) {
      const line = lines[j];
      if (SECTION_HEADERS.test(line)) continue;
      if (CURRENT_MARKERS.test(line) && !line.includes('|') && line.length < 60) continue;

      const pipeMatch = line.match(/^(.+?)\s*[|]\s*(.+?)(?:\s*[|]|$)/);
      if (pipeMatch) {
        return { role: pipeMatch[1].trim(), company: pipeMatch[2].trim() };
      }
    }

    // Pattern D: company name on a line 1-3 above, role found near it
    for (let j = Math.max(0, i - 3); j < i; j++) {
      const line = lines[j];
      if (SECTION_HEADERS.test(line)) continue;
      if (line.includes('@') || /^\d/.test(line)) continue;
      // Short non-header line near a current marker is likely a company name
      if (line.length > 2 && line.length < 60 && !CURRENT_MARKERS.test(line)) {
        return { company: line, role: roleLine };
      }
    }

    return { company: null, role: roleLine };
  }

  return { company: null, role: null };
}

function findRoleNearIndex(lines: string[], idx: number): string | null {
  const rolePatterns = /\b(manager|executive|associate|officer|engineer|developer|analyst|coordinator|counselor|administrator|supervisor|nurse|staff|lead|head|director|consultant)\b/i;
  for (let j = Math.max(0, idx - 3); j <= Math.min(lines.length - 1, idx + 2); j++) {
    const line = lines[j];
    if (SECTION_HEADERS.test(line)) continue;
    if (rolePatterns.test(line) && line.length < 80) {
      const cleaned = line.replace(/^(role|designation|position)\s*[:]\s*/i, '').trim();
      return cleaned;
    }
  }
  return null;
}

export function extractFieldsFromText(rawText: string): ExtractedFields {
  const lines = rawText.split('\n').map(l => l.trim());
  return {
    name: extractName(lines),
    phone: extractPhone(rawText),
    email: extractEmail(rawText),
    city: extractCity(rawText),
    ...extractCurrentEmployer(rawText),
  };
}
