#!/usr/bin/env node
// Stop hook — blocks Claude from finishing if a backend route or frontend
// section was changed without corresponding test updates.
//
// Activation order matters: this fires on Stop, looks at the diff vs main
// AND unstaged work, and emits {decision:"block", reason:"…"} on a violation.
//
// Why this exists: the tool entered beta with real users on 2026-04-29. From
// then on, every PR must keep the regression net intact. Forgetting a test is
// the most common way Claude introduces silent regressions; this hook makes it
// loud instead of silent.
import { execSync } from 'node:child_process';

const FRONTEND_FILES = new Set([
  'src/App.jsx',
  'src/Login.jsx',
  'src/UserManagement.jsx',
  'src/ScheduleInterviewModal.jsx',
  'src/Search.jsx',
  'src/DataContext.jsx',
  'src/Search.jsx',
  'src/api.js',
]);

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function changedFiles() {
  // Union of: committed-vs-main + staged + unstaged + untracked.
  const committed = git('diff --name-only main...HEAD');
  const staged = git('diff --name-only --cached');
  const unstaged = git('diff --name-only');
  const untracked = git('ls-files --others --exclude-standard');
  return new Set([...committed, ...staged, ...unstaged, ...untracked]);
}

function isBackendRoute(p) {
  return /^carepal-backend\/src\/routes\/[^/]+\.ts$/.test(p) && !p.endsWith('.test.ts');
}

function isBackendTest(p) {
  return p.startsWith('carepal-backend/src/') && p.endsWith('.test.ts');
}

function isFrontendSection(p) {
  return FRONTEND_FILES.has(p);
}

function isE2ESpec(p) {
  return /^e2e\/.+\.spec\.ts$/.test(p);
}

function block(reason) {
  // Per Claude Code Stop-hook contract: write JSON with decision:"block" + reason.
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

const files = changedFiles();
const backendRoutesChanged = [...files].filter(isBackendRoute);
const backendTestsChanged = [...files].some(isBackendTest);
const frontendSectionsChanged = [...files].filter(isFrontendSection);
const e2eSpecsChanged = [...files].some(isE2ESpec);

const violations = [];

if (backendRoutesChanged.length > 0 && !backendTestsChanged) {
  violations.push(
    `Backend route(s) changed without any test update:\n  ${backendRoutesChanged.join('\n  ')}\n` +
      `Add or update a *.test.ts in carepal-backend/src/ before finishing. ` +
      `See CLAUDE.md "Testing & test discipline".`,
  );
}

if (frontendSectionsChanged.length > 0 && !e2eSpecsChanged) {
  violations.push(
    `Frontend section(s) changed without any e2e test update:\n  ${frontendSectionsChanged.join('\n  ')}\n` +
      `Add or update an e2e/*.spec.ts before finishing. ` +
      `See CLAUDE.md "Testing & test discipline".`,
  );
}

if (violations.length > 0) {
  block(violations.join('\n\n'));
}

process.exit(0);
