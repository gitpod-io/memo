import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/track-event-server", () => ({
  trackEvent: vi.fn(),
}));

const captureApiErrorMock = vi.fn();

vi.mock("@/lib/sentry", () => ({
  captureApiError: (...args: unknown[]) => captureApiErrorMock(...args),
  captureSupabaseError: vi.fn(),
  isInsufficientPrivilegeError: (err: Error & { code?: string }) =>
    err.code === "42501" ||
    err.message?.includes("violates row-level security policy"),
}));

import { POST } from "./route";
import { createClient } from "@/lib/supabase/server";
import { trackEvent } from "@/lib/track-event-server";

const mockedCreateClient = vi.mocked(createClient);
const mockedTrackEvent = vi.mocked(trackEvent);

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockAuthenticatedClient(overrides: Record<string, unknown> = {}) {
  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
  const mockGetUser = vi
    .fn()
    .mockResolvedValue({ data: { user: { id: "user-123" } } });

  mockedCreateClient.mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    ...overrides,
  } as unknown as Awaited<ReturnType<typeof createClient>>);

  return { mockInsert, mockFrom, mockGetUser };
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    type: "bug",
    message: "Something is broken",
    page_path: "/workspace/abc/page/xyz",
    page_title: "My Page",
    screenshot_url: null,
    metadata: { browser: "Chrome", viewport: "1920x1080" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
});

describe("POST /api/feedback", () => {
  it("returns 503 when Supabase is not configured", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const response = await POST(makeRequest(validBody()));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("Supabase not configured");
  });

  it("returns 400 for invalid JSON body", async () => {
    const request = new NextRequest("http://localhost:3000/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid JSON body");
  });

  it("returns 401 if user is not authenticated", async () => {
    const mockGetUser = vi
      .fn()
      .mockResolvedValue({ data: { user: null } });
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: mockGetUser },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await POST(makeRequest(validBody()));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 if type is missing", async () => {
    const response = await POST(makeRequest(validBody({ type: undefined })));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Invalid type");
  });

  it("returns 400 if type is not one of bug, feature, general", async () => {
    const response = await POST(makeRequest(validBody({ type: "complaint" })));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Invalid type");
  });

  it("returns 400 if message is empty", async () => {
    mockAuthenticatedClient();

    const response = await POST(makeRequest(validBody({ message: "" })));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Message is required");
  });

  it("returns 400 if message is whitespace only", async () => {
    mockAuthenticatedClient();

    const response = await POST(makeRequest(validBody({ message: "   " })));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Message is required");
  });

  it("returns 400 if message exceeds 500 characters", async () => {
    mockAuthenticatedClient();

    const longMessage = "a".repeat(501);
    const response = await POST(makeRequest(validBody({ message: longMessage })));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("must not exceed 500 characters");
  });

  it("returns 400 if message is not a string", async () => {
    mockAuthenticatedClient();

    const response = await POST(makeRequest(validBody({ message: 123 })));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Message is required");
  });

  it("returns 201 on successful insert with { success: true }", async () => {
    const { mockInsert, mockFrom } = mockAuthenticatedClient();

    const response = await POST(makeRequest(validBody()));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({ success: true });
    expect(mockFrom).toHaveBeenCalledWith("user_feedback");
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-123",
      type: "bug",
      message: "Something is broken",
      page_path: "/workspace/abc/page/xyz",
      page_title: "My Page",
      screenshot_url: null,
      metadata: { browser: "Chrome", viewport: "1920x1080" },
    });
  });

  it("sets user_id from authenticated session, not request body", async () => {
    const { mockInsert } = mockAuthenticatedClient();

    const response = await POST(
      makeRequest(validBody({ user_id: "attacker-id" })),
    );

    expect(response.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-123" }),
    );
  });

  it("calls trackEvent on successful insert", async () => {
    mockAuthenticatedClient();

    await POST(makeRequest(validBody({ type: "feature" })));

    expect(mockedTrackEvent).toHaveBeenCalledWith(
      "feedback.submitted",
      "user-123",
      { metadata: { type: "feature" } },
    );
  });

  it("returns 500 when Supabase insert fails", async () => {
    const mockInsert = vi.fn().mockResolvedValue({
      data: null,
      error: Object.assign(new Error("Insert failed"), {
        code: "23505",
        details: "",
        hint: "",
      }),
    });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
    const mockGetUser = vi
      .fn()
      .mockResolvedValue({ data: { user: { id: "user-123" } } });

    mockedCreateClient.mockResolvedValue({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await POST(makeRequest(validBody()));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to submit feedback");
  });

  it("accepts all valid feedback types", async () => {
    for (const type of ["bug", "feature", "general"]) {
      mockAuthenticatedClient();

      const response = await POST(makeRequest(validBody({ type })));
      expect(response.status).toBe(201);
    }
  });

  it("handles optional fields as null", async () => {
    const { mockInsert } = mockAuthenticatedClient();

    const response = await POST(
      makeRequest({
        type: "general",
        message: "Just a thought",
      }),
    );

    expect(response.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        page_path: null,
        page_title: null,
        screenshot_url: null,
        metadata: null,
      }),
    );
  });

  it("routes transient fetch errors through captureApiError (#856)", async () => {
    const fetchError = new TypeError("fetch failed");
    mockedCreateClient.mockRejectedValue(fetchError);

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(500);
    expect(captureApiErrorMock).toHaveBeenCalledWith(
      fetchError,
      "feedback:submit",
    );
  });

  it("routes non-transient errors through captureApiError (#856)", async () => {
    const unexpectedError = new Error("unexpected failure");
    mockedCreateClient.mockRejectedValue(unexpectedError);

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(500);
    expect(captureApiErrorMock).toHaveBeenCalledWith(
      unexpectedError,
      "feedback:submit",
    );
  });
});
