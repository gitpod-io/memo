import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

// Mock html-to-image so tests don't need a real DOM
vi.mock("html-to-image", () => ({
  toPng: vi.fn(),
}));

import { uploadScreenshot } from "./use-screenshot";
import { createClient } from "@/lib/supabase/client";

const mockedCreateClient = vi.mocked(createClient);

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("uploadScreenshot", () => {
  it("uploads blob and returns public URL on success", async () => {
    const mockUpload = vi.fn().mockResolvedValue({ data: { path: "user-1/123.png" }, error: null });
    const mockGetPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: "https://storage.example.com/feedback-screenshots/user-1/123.png" },
    });
    const mockFrom = vi.fn().mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    });

    mockedCreateClient.mockReturnValue({
      storage: { from: mockFrom },
    } as unknown as ReturnType<typeof createClient>);

    const blob = new Blob(["fake-image"], { type: "image/png" });
    const result = await uploadScreenshot(blob, "user-1");

    expect(mockFrom).toHaveBeenCalledWith("feedback-screenshots");
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/\d+\.png$/),
      blob,
      { contentType: "image/png" },
    );
    expect(result).toBe("https://storage.example.com/feedback-screenshots/user-1/123.png");
  });

  it("returns null when upload fails", async () => {
    const mockUpload = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Upload failed", statusCode: "500" },
    });
    const mockFrom = vi.fn().mockReturnValue({
      upload: mockUpload,
    });

    mockedCreateClient.mockReturnValue({
      storage: { from: mockFrom },
    } as unknown as ReturnType<typeof createClient>);

    const blob = new Blob(["fake-image"], { type: "image/png" });
    const result = await uploadScreenshot(blob, "user-1");

    expect(result).toBeNull();
  });
});
