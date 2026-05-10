/**
 * Bundle budget check — fails if any page route exceeds the gzipped first-load JS budget.
 *
 * Reads .next/diagnostics/route-bundle-stats.json (produced by `pnpm build`),
 * gzips each chunk to compute accurate transfer sizes, and asserts every page
 * route is ≤ the budget (default 200 kB gzipped).
 *
 * Also prints a shared chunk analysis showing the framework baseline and
 * per-route-group breakdown. This helps identify when a new dependency or
 * eager import inflates the shared chunks that affect all routes.
 *
 * Usage: node scripts/check-bundle.mjs
 * Requires: a prior `pnpm build` so .next/diagnostics exists.
 */

import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve, basename } from "node:path";

const BUDGET_KB = 200;
const BUDGET_BYTES = BUDGET_KB * 1024;
const STATS_PATH = resolve(".next/diagnostics/route-bundle-stats.json");

// Framework baseline budget (kB gzipped). This covers the chunks shared by
// ALL routes: Next.js runtime, React, tailwind-merge, shared providers, etc.
// If this number grows, a new shared dependency was added — investigate before
// bumping the limit. See docs/bundle-budget.md for the chunk inventory.
const FRAMEWORK_BASELINE_BUDGET_KB = 160;

// Routes that are allowed to exceed the default budget.
// Each entry records the observed size (rounded up) so the check prevents further regression.
// Add entries here only as a temporary measure while actively reducing bundle size.
const ALLOWLIST = [];

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

  // --- Phase 1: Per-route budget check ---

  // Build chunk → routes mapping for the shared chunk analysis
  const chunkRoutes = new Map();

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

      // Track which routes use each chunk
      if (!chunkRoutes.has(chunkPath)) {
        chunkRoutes.set(chunkPath, []);
      }
      chunkRoutes.get(chunkPath).push(route);
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

  // --- Phase 2: Shared chunk analysis ---

  const totalRoutes = results.length;

  // Categorize chunks by sharing scope
  let frameworkTotal = 0;
  const frameworkChunks = [];
  const groupShared = [];

  for (const [chunkPath, routeList] of chunkRoutes) {
    const size = getGzippedSize(chunkPath);
    const name = basename(chunkPath);

    if (routeList.length === totalRoutes) {
      frameworkTotal += size;
      frameworkChunks.push({ name, size });
    } else if (routeList.length > 1) {
      groupShared.push({ name, size, routes: routeList });
    }
  }

  frameworkChunks.sort((a, b) => b.size - a.size);
  groupShared.sort((a, b) => b.size - a.size);

  const frameworkKB = frameworkTotal / 1024;

  console.log("Shared Chunk Analysis");
  console.log("=".repeat(70));

  console.log(
    `\nFramework baseline: ${frameworkKB.toFixed(1)} kB gzipped (budget: ${FRAMEWORK_BASELINE_BUDGET_KB} kB)`,
  );
  console.log(`Chunks shared by all ${totalRoutes} routes:`);
  for (const c of frameworkChunks) {
    console.log(`  ${c.name.padEnd(50)} ${(c.size / 1024).toFixed(1).padStart(8)} kB`);
  }

  if (groupShared.length > 0) {
    console.log(`\nRoute-group shared chunks:`);
    for (const c of groupShared) {
      console.log(
        `  ${c.name.padEnd(50)} ${(c.size / 1024).toFixed(1).padStart(8)} kB  (${c.routes.length} routes)`,
      );
    }
  }

  console.log(
    `\nPer-route breakdown (framework + route-specific):`,
  );
  for (const r of results) {
    const routeOnly = parseFloat(r.totalKB) - frameworkKB;
    console.log(
      `  ${r.route.padEnd(40)} ${frameworkKB.toFixed(1).padStart(7)} + ${routeOnly.toFixed(1).padStart(5)} = ${r.totalKB.padStart(7)} kB`,
    );
  }

  console.log("-".repeat(70));

  // Check framework baseline budget
  if (frameworkTotal > FRAMEWORK_BASELINE_BUDGET_KB * 1024) {
    console.error(
      `\n⚠️  Framework baseline (${frameworkKB.toFixed(1)} kB) exceeds budget (${FRAMEWORK_BASELINE_BUDGET_KB} kB).`,
    );
    console.error(
      `   A new shared dependency may have been added to the root layout or providers.`,
    );
    console.error(
      `   Check docs/bundle-budget.md for the expected chunk inventory.\n`,
    );
    // Warning only — don't fail the build for framework growth, but make it visible
  } else {
    console.log(
      `\n✅ Framework baseline (${frameworkKB.toFixed(1)} kB) is within ${FRAMEWORK_BASELINE_BUDGET_KB} kB budget.\n`,
    );
  }
}

run();
