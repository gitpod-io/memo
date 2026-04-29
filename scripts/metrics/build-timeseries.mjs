#!/usr/bin/env node

/**
 * Aggregates metrics/daily/*.json into metrics/timeseries.json.
 * Run after each daily snapshot is written. Idempotent modulo updatedAt.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DAILY_DIR = 'metrics/daily';
const OUT = 'metrics/timeseries.json';
const START = '2026-04-14';

// ── Schema guards ──

const EXPECTED_TOP_KEYS = ['days', 'latest', 'startDate', 'updatedAt'];
const EXPECTED_DAY_KEYS = ['autonomousPct', 'ciGreenPct', 'commits', 'date', 'dayNumber', 'issues', 'loc', 'prs', 'tests'];
const PR_BUCKET_KEYS = ['10_20m', '1_2h', '30_60m', '5_10m', 'lt_5m'];
const ISSUE_BUCKET_KEYS = ['15_30m', '1_2h', '2_4h', '30_60m', '4_8h', 'lt_15m'];

function assertSchema(out) {
  const topKeys = Object.keys(out).sort();
  if (JSON.stringify(topKeys) !== JSON.stringify(EXPECTED_TOP_KEYS)) {
    throw new Error(`timeseries top-level keys drifted: ${topKeys.join(',')}`);
  }

  for (const d of out.days) {
    const k = Object.keys(d).sort();
    if (JSON.stringify(k) !== JSON.stringify(EXPECTED_DAY_KEYS)) {
      throw new Error(`day ${d.date} keys drifted: ${k.join(',')}`);
    }
  }

  const pr = Object.keys(out.latest.distributions.prMergeTime).sort();
  if (JSON.stringify(pr) !== JSON.stringify(PR_BUCKET_KEYS)) {
    throw new Error(`prMergeTime keys drifted: ${pr.join(',')}`);
  }

  const is = Object.keys(out.latest.distributions.issueCloseTime).sort();
  if (JSON.stringify(is) !== JSON.stringify(ISSUE_BUCKET_KEYS)) {
    throw new Error(`issueCloseTime keys drifted: ${is.join(',')}`);
  }
}

// ── Helpers ──

function dayNumberOf(d) {
  const ms = (Date.parse(d) - Date.parse(START)) / 86_400_000;
  return Math.round(ms) + 1;
}

/** Extract CI pass rate from a daily snapshot, handling both schema variants. */
function ciGreenPct(snap) {
  if (snap.ci && snap.ci.pass_rate_pct != null) {
    return snap.ci.pass_rate_pct;
  }
  if (snap.ci_pass_rate_pct != null) {
    return snap.ci_pass_rate_pct;
  }
  // If CI didn't run that day, default to 100
  return 100;
}

// ── Main ──

const dayFiles = readdirSync(DAILY_DIR)
  .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort();

if (dayFiles.length === 0) {
  throw new Error('No daily snapshot files found');
}

// Gap detection: ensure contiguous dates from first to last
const firstDate = dayFiles[0].replace('.json', '');
const lastDate = dayFiles[dayFiles.length - 1].replace('.json', '');
const expectedDates = [];
{
  let d = new Date(firstDate + 'T00:00:00Z');
  const end = new Date(lastDate + 'T00:00:00Z');
  while (d <= end) {
    expectedDates.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() + 86_400_000);
  }
}
const actualDates = dayFiles.map(f => f.replace('.json', ''));
const missing = expectedDates.filter(d => !actualDates.includes(d));
if (missing.length > 0) {
  throw new Error(`metrics: timeseries gap detected — missing dates: ${missing.join(', ')}`);
}

const days = dayFiles.map(f => {
  const snap = JSON.parse(readFileSync(join(DAILY_DIR, f), 'utf8'));
  return {
    date: snap.date,
    dayNumber: dayNumberOf(snap.date),
    loc: { total: snap.loc.total, delta: snap.loc.delta },
    prs: { total: snap.prs.total, delta: snap.prs.delta },
    commits: { total: snap.commits.total, delta: snap.commits.delta },
    issues: {
      done: snap.issues.done,
      deltaDone: snap.issues.delta_done ?? snap.issues.closed_today ?? 0,
      deltaOpened: snap.issues.delta_opened ?? snap.issues.opened_today ?? 0,
    },
    tests: {
      unit: snap.tests?.unit ?? 0,
      e2e: snap.tests?.e2e ?? 0,
      total: (snap.tests?.unit ?? 0) + (snap.tests?.e2e ?? 0),
    },
    autonomousPct: snap.autonomous_pct,
    ciGreenPct: ciGreenPct(snap),
  };
});

const lastSnap = JSON.parse(readFileSync(join(DAILY_DIR, dayFiles[dayFiles.length - 1]), 'utf8'));

const out = {
  updatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  startDate: START,
  days,
  latest: {
    date: lastSnap.date,
    dayNumber: dayNumberOf(lastSnap.date),
    totals: {
      prs: lastSnap.prs.total,
      commits: lastSnap.commits.total,
      loc: lastSnap.loc.total,
      issuesDone: lastSnap.issues.done,
      tests: (lastSnap.tests?.unit ?? 0) + (lastSnap.tests?.e2e ?? 0),
    },
    rates: {
      autonomousPct: lastSnap.autonomous_pct,
      ciGreenPct: ciGreenPct(lastSnap),
      testCoveragePct: lastSnap.test_coverage_pct,
    },
    distributions: {
      prMergeTime: lastSnap.pr_merge_time_buckets,
      issueCloseTime: lastSnap.issue_close_time_buckets,
    },
  },
};

assertSchema(out);
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${OUT} (${days.length} days, ${firstDate} → ${lastDate})`);
