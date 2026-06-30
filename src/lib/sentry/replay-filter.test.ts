import { describe, it, expect } from "vitest";
import { isReplayHydrationError } from "./replay-filter";

describe("isReplayHydrationError", () => {
  it("returns true for replay.hydrate-error breadcrumb events", () => {
    const event = {
      type: 5,
      timestamp: 1719700000,
      data: {
        tag: "breadcrumb",
        payload: {
          timestamp: 1719700000,
          type: "default",
          category: "replay.hydrate-error",
          data: { url: "https://memo.software-factory.dev/" },
        },
      },
    };

    expect(isReplayHydrationError(event)).toBe(true);
  });

  it("returns false for non-hydration breadcrumb events", () => {
    const event = {
      type: 5,
      timestamp: 1719700000,
      data: {
        tag: "breadcrumb",
        payload: {
          timestamp: 1719700000,
          type: "default",
          category: "ui.click",
          message: "body > div > button",
          data: { nodeId: 42 },
        },
      },
    };

    expect(isReplayHydrationError(event)).toBe(false);
  });

  it("returns false for performanceSpan events", () => {
    const event = {
      type: 5,
      timestamp: 1719700000,
      data: {
        tag: "performanceSpan",
        payload: {
          op: "navigation.push",
          description: "/workspace",
          startTimestamp: 1719700000,
          endTimestamp: 1719700001,
        },
      },
    };

    expect(isReplayHydrationError(event)).toBe(false);
  });

  it("returns false for options events", () => {
    const event = {
      type: 5,
      timestamp: 1719700000,
      data: {
        tag: "options",
        payload: {
          blockAllMedia: false,
          errorSampleRate: 1.0,
          maskAllInputs: true,
          maskAllText: true,
          sessionSampleRate: 0.1,
        },
      },
    };

    expect(isReplayHydrationError(event)).toBe(false);
  });

  it("returns false for replay.mutations breadcrumb events", () => {
    const event = {
      type: 5,
      timestamp: 1719700000,
      data: {
        tag: "breadcrumb",
        payload: {
          timestamp: 1719700000,
          type: "default",
          category: "replay.mutations",
          data: { count: 500, limit: true },
        },
      },
    };

    expect(isReplayHydrationError(event)).toBe(false);
  });

  it("returns false when payload is undefined", () => {
    const event = {
      type: 5,
      timestamp: 1719700000,
      data: {
        tag: "breadcrumb",
        payload: undefined,
      },
    };

    expect(isReplayHydrationError(event)).toBe(false);
  });
});
