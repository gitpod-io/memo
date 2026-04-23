import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { isUsageTrackingDisabled } from "./usage-tracking-guard";

describe("isUsageTrackingDisabled", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns false when no flags are set and NODE_ENV is not test", () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.NEXT_PUBLIC_DISABLE_USAGE_TRACKING;
    expect(isUsageTrackingDisabled()).toBe(false);
  });

  it("returns true when NEXT_PUBLIC_DISABLE_USAGE_TRACKING is 'true'", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DISABLE_USAGE_TRACKING", "true");
    expect(isUsageTrackingDisabled()).toBe(true);
  });

  it("returns false when NEXT_PUBLIC_DISABLE_USAGE_TRACKING is 'false'", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DISABLE_USAGE_TRACKING", "false");
    expect(isUsageTrackingDisabled()).toBe(false);
  });

  it("returns true when NODE_ENV is 'test'", () => {
    vi.stubEnv("NODE_ENV", "test");
    delete process.env.NEXT_PUBLIC_DISABLE_USAGE_TRACKING;
    expect(isUsageTrackingDisabled()).toBe(true);
  });

  it("returns true when both flags are set", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_DISABLE_USAGE_TRACKING", "true");
    expect(isUsageTrackingDisabled()).toBe(true);
  });
});
