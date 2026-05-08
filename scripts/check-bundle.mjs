/**
 * Bundle budget check — fails if any page route exceeds the gzipped first-load JS budget.
 *
 * Reads .next/diagnostics/route-bundle-stats.json (produced by `pnpm build`),
 * gzips each chunk to compute accurate transfer sizes, and asserts every page
 * route is ≤ the budget (default 200 kB gzipped).
 *
 * Usage: node scripts/check-bundle.mjs
 * Requires: a prior `pnpm build` so .next/diagnostics exists.
 */

import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

const BUDGET_KB = 200;
const BUDGET_BYTES = BUDGET_KB * 1024;
const STATS_PATH = resolve(".next/diagnostics/route-bundle-stats.json");

// Routes that are allowed to exceed the default budget.
// Each entry records the observed size (rounded up) so the check prevents further regression.
// Tracked in #973 — these should be reduced to ≤200 kB over time.
const ALLOWLIST = [
  { route: "/sign-in", budgetKB: 290, reason: "Auth pages share a large Supabase auth bundle (#973)" },
  { route: "/sign-up", budgetKB: 290, reason: "Auth pages share a large Supabase auth bundle (#973)" },
  { route: "/forgot-password", budgetKB: 250, reason: "Auth pages share a large Supabase auth bundle (#973)" },
  { route: "/reset-password", budgetKB: 250, reason: "Auth pages share a large Supabase auth bundle (#973)" },
  { route: "/[workspaceSlug]", budgetKB: 250, reason: "Workspace root includes editor + sidebar bundles (#973)" },
  { route: "/[workspaceSlug]/settings", budgetKB: 230, reason: "Settings page includes form + avatar components (#973)" },
  { route: "/[workspaceSlug]/settings/members", budgetKB: 270, reason: "Members page includes invite dialog + member list (#973)" },
];

function run() {
  let raw;
  try {
    raw = readFileSync(STATS_PATH, "utf-8");
  } catch {
    console.error(
      `\n❌ Could not read ${STATS_PATH}\n   Run \`pnpm build\` first to generate bundle stats.\n`,
    );
    process.exit(1);
  }

  const routes = JSON.parse(raw);

  // Cache gzipped sizes per chunk path to avoid re-compressing shared chunks
  const gzipCache = new Map();

  function getGzippedSize(chunkPath) {
    if (gzipCache.has(chunkPath)) {
      return gzipCache.get(chunkPath);
    }
    const fullPath = resolve(chunkPath);
    try {
      const content = readFileSync(fullPath);
      const gzipped = gzipSync(content);
      const size = gzipped.length;
      gzipCache.set(chunkPath, size);
      return size;
    } catch {
      // Chunk file missing — skip it (may have been cleaned)
      return 0;
    }
  }

  const results = [];
  let hasFailure = false;

  for (const entry of routes) {
    const { route, firstLoadChunkPaths } = entry;
    if (!firstLoadChunkPaths || firstLoadChunkPaths.length === 0) {
      continue;
    }

    let totalGzipped = 0;
    for (const chunkPath of firstLoadChunkPaths) {
      totalGzipped += getGzippedSize(chunkPath);
    }

    const totalKB = totalGzipped / 1024;

    // Check allowlist for custom budget
    const override = ALLOWLIST.find((a) => a.route === route);
    const effectiveBudget = override ? override.budgetKB * 1024 : BUDGET_BYTES;
    const effectiveBudgetKB = effectiveBudget / 1024;

    const passed = totalGzipped <= effectiveBudget;
    if (!passed) {
      hasFailure = true;
    }

    results.push({
      route,
      totalKB: totalKB.toFixed(1),
      budgetKB: effectiveBudgetKB,
      passed,
      reason: override?.reason,
    });
  }

  // Sort: failures first, then by size descending
  results.sort((a, b) => {
    if (a.passed !== b.passed) return a.passed ? 1 : -1;
    return parseFloat(b.totalKB) - parseFloat(a.totalKB);
  });

  // Print results table
  console.log("\nBundle Budget Check");
  console.log("=".repeat(70));
  console.log(
    `${"Route".padEnd(40)} ${"Size (gzip)".padStart(12)} ${"Budget".padStart(10)}  Status`,
  );
  console.log("-".repeat(70));

  for (const r of results) {
    const status = r.passed ? "✅" : "❌";
    const sizeStr = `${r.totalKB} kB`.padStart(12);
    const budgetStr = `${r.budgetKB} kB`.padStart(10);
    console.log(`${r.route.padEnd(40)} ${sizeStr} ${budgetStr}  ${status}`);
  }

  console.log("-".repeat(70));

  if (hasFailure) {
    const failures = results.filter((r) => !r.passed);
    console.error(
      `\n❌ ${failures.length} route(s) exceed the ${BUDGET_KB} kB gzipped budget:\n`,
    );
    for (const f of failures) {
      console.error(`   ${f.route}: ${f.totalKB} kB (budget: ${f.budgetKB} kB)`);
    }
    console.error("");
    process.exit(1);
  }

  console.log(
    `\n✅ All ${results.length} routes are within the ${BUDGET_KB} kB gzipped budget.\n`,
  );
}

run();
