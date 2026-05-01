import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';

/**
 * Regression tests for build-timeseries.mjs (#877).
 * Runs the actual script via a thin wrapper that overrides DAILY_DIR and OUT
 * to point at temp fixtures.
 */

const SCRIPT_PATH = join(import.meta.dirname, 'build-timeseries.mjs');

function makeSnapshot(overrides = {}) {
  return {
    date: '2026-04-14',
    day_number: 1,
    loc: { total: 100, delta: 100, by_language: { TypeScript: 100 } },
    files: { total: 10, delta: 10 },
    prs: { total: 5, delta: 5, currently_open: 0 },
    commits: { total: 10, delta: 10 },
    issues: {
      backlog: 0, in_progress: 0, in_review: 0, done: 3,
      opened_today: 1, closed_today: 1, delta_opened: 1, delta_done: 1,
    },
    tests: { unit: 10, e2e: 5 },
    ci: { runs_total: 2, runs_passed: 2, pass_rate_pct: 100 },
    test_coverage_pct: 50,
    autonomous_pct: 90,
    pr_merge_time_buckets: { lt_5m: 2, '5_10m': 1, '10_20m': 1, '30_60m': 1, '1_2h': 0 },
    issue_close_time_buckets: { lt_15m: 1, '15_30m': 1, '30_60m': 0, '1_2h': 1, '2_4h': 0, '4_8h': 0 },
    human_minutes: null,
    agent_minutes: null,
    ...overrides,
  };
}

/** Run the real script with overridden DAILY_DIR and OUT paths. */
function runAggregator(dailyDir, outFile) {
  // Read the real script, patch the two path constants, write to a temp wrapper
  let src = readFileSync(SCRIPT_PATH, 'utf8');
  src = src.replace(
    /const DAILY_DIR = .+;/,
    `const DAILY_DIR = ${JSON.stringify(dailyDir)};`,
  );
  src = src.replace(
    /const OUT = .+;/,
    `const OUT = ${JSON.stringify(outFile)};`,
  );
  const wrapperPath = join(dailyDir, '..', '_test_wrapper.mjs');
  writeFileSync(wrapperPath, src);
  try {
    return execSync(`node ${wrapperPath}`, { encoding: 'utf8', stdio: 'pipe' });
  } finally {
    rmSync(wrapperPath, { force: true });
  }
}

describe('build-timeseries.mjs', () => {
  let tmpDir;
  let dailyDir;
  let outFile;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'timeseries-test-'));
    dailyDir = join(tmpDir, 'daily');
    mkdirSync(dailyDir);
    outFile = join(tmpDir, 'timeseries.json');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('succeeds when all snapshots have complete fields', () => {
    const snap1 = makeSnapshot({ date: '2026-04-14' });
    const snap2 = makeSnapshot({
      date: '2026-04-15',
      loc: { total: 120, delta: 20, by_language: { TypeScript: 120 } },
      prs: { total: 7, delta: 2, currently_open: 0 },
      commits: { total: 12, delta: 2 },
    });
    writeFileSync(join(dailyDir, '2026-04-14.json'), JSON.stringify(snap1));
    writeFileSync(join(dailyDir, '2026-04-15.json'), JSON.stringify(snap2));

    runAggregator(dailyDir, outFile);

    const result = JSON.parse(readFileSync(outFile, 'utf8'));
    expect(result.days).toHaveLength(2);
    expect(result.latest.distributions.prMergeTime).toEqual(snap2.pr_merge_time_buckets);
    expect(result.latest.distributions.issueCloseTime).toEqual(snap2.issue_close_time_buckets);
  });

  it('falls back to earlier snapshot when latest is missing distribution buckets', () => {
    const snap1 = makeSnapshot({ date: '2026-04-14' });
    const snap2 = makeSnapshot({ date: '2026-04-15' });
    delete snap2.pr_merge_time_buckets;
    delete snap2.issue_close_time_buckets;

    writeFileSync(join(dailyDir, '2026-04-14.json'), JSON.stringify(snap1));
    writeFileSync(join(dailyDir, '2026-04-15.json'), JSON.stringify(snap2));

    runAggregator(dailyDir, outFile);

    const result = JSON.parse(readFileSync(outFile, 'utf8'));
    expect(result.days).toHaveLength(2);
    expect(result.latest.distributions.prMergeTime).toEqual(snap1.pr_merge_time_buckets);
    expect(result.latest.distributions.issueCloseTime).toEqual(snap1.issue_close_time_buckets);
  });

  it('uses zero-filled defaults when no snapshot has distribution buckets', () => {
    const snap1 = makeSnapshot({ date: '2026-04-14' });
    delete snap1.pr_merge_time_buckets;
    delete snap1.issue_close_time_buckets;

    writeFileSync(join(dailyDir, '2026-04-14.json'), JSON.stringify(snap1));

    runAggregator(dailyDir, outFile);

    const result = JSON.parse(readFileSync(outFile, 'utf8'));
    expect(result.latest.distributions.prMergeTime).toEqual({
      lt_5m: 0, '5_10m': 0, '10_20m': 0, '30_60m': 0, '1_2h': 0,
    });
    expect(result.latest.distributions.issueCloseTime).toEqual({
      lt_15m: 0, '15_30m': 0, '30_60m': 0, '1_2h': 0, '2_4h': 0, '4_8h': 0,
    });
  });

  it('reads ci.pass_rate_pct from nested ci object', () => {
    const snap = makeSnapshot({
      date: '2026-04-14',
      ci: { runs_total: 6, runs_passed: 6, pass_rate_pct: 100 },
    });
    writeFileSync(join(dailyDir, '2026-04-14.json'), JSON.stringify(snap));

    runAggregator(dailyDir, outFile);

    const result = JSON.parse(readFileSync(outFile, 'utf8'));
    expect(result.days[0].ciGreenPct).toBe(100);
    expect(result.latest.rates.ciGreenPct).toBe(100);
  });

  it('defaults ciGreenPct to 100 when ci.pass_rate_pct is null', () => {
    const snap = makeSnapshot({
      date: '2026-04-14',
      ci: { runs_total: 0, runs_passed: 0, pass_rate_pct: null },
    });
    writeFileSync(join(dailyDir, '2026-04-14.json'), JSON.stringify(snap));

    runAggregator(dailyDir, outFile);

    const result = JSON.parse(readFileSync(outFile, 'utf8'));
    expect(result.days[0].ciGreenPct).toBe(100);
  });

  it('uses closed_today/opened_today when delta_done/delta_opened are missing', () => {
    const snap = makeSnapshot({ date: '2026-04-14' });
    delete snap.issues.delta_done;
    delete snap.issues.delta_opened;
    snap.issues.closed_today = 3;
    snap.issues.opened_today = 5;

    writeFileSync(join(dailyDir, '2026-04-14.json'), JSON.stringify(snap));

    runAggregator(dailyDir, outFile);

    const result = JSON.parse(readFileSync(outFile, 'utf8'));
    expect(result.days[0].issues.deltaDone).toBe(3);
    expect(result.days[0].issues.deltaOpened).toBe(5);
  });
});
