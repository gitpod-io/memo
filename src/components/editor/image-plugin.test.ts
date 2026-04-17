import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
  }),
}));

vi.mock("@/lib/sentry", () => ({
  captureSupabaseError: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

import { uploadImage } from "./image-plugin";

function makeFile(
  name: string,
  type: string,
  sizeBytes: number = 1024,
): File {
  const buffer = new ArrayBuffer(sizeBytes);
  return new File([buffer], name, { type });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("uploadImage", () => {
  it("rejects unsupported image types with an error message", async () => {
    const file = makeFile("doc.pdf", "application/pdf");
    const result = await uploadImage(file);

    expect(result.url).toBeNull();
    expect(result.error).toBe(
      "Unsupported image type. Use PNG, JPEG, GIF, WebP, or SVG.",
    );
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("rejects files exceeding 5 MB", async () => {
    const file = makeFile("big.png", "image/png", 6 * 1024 * 1024);
    const result = await uploadImage(file);

    expect(result.url).toBeNull();
    expect(result.error).toBe("Image is too large. Maximum size is 5 MB.");
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("returns an error when Supabase upload fails", async () => {
    mockUpload.mockResolvedValue({
      error: { message: "Bucket not found", statusCode: "404" },
    });

    const file = makeFile("photo.png", "image/png");
    const result = await uploadImage(file);

    expect(result.url).toBeNull();
    expect(result.error).toBe("Failed to upload image");
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });

  it("returns the public URL on successful upload", async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://storage.example.com/uploads/test.png" },
    });

    const file = makeFile("photo.png", "image/png");
    const result = await uploadImage(file);

    expect(result.error).toBeNull();
    expect(result.url).toBe(
      "https://storage.example.com/uploads/test.png",
    );
  });

  it("accepts all supported image MIME types", async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://storage.example.com/uploads/img.png" },
    });

    const types = [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ];

    for (const type of types) {
      const ext = type.split("/")[1].split("+")[0];
      const file = makeFile(`test.${ext}`, type);
      const result = await uploadImage(file);
      expect(result.error).toBeNull();
      expect(result.url).toBeTruthy();
    }
  });

  it("accepts files exactly at the 5 MB limit", async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://storage.example.com/uploads/exact.png" },
    });

    const file = makeFile("exact.png", "image/png", 5 * 1024 * 1024);
    const result = await uploadImage(file);

    expect(result.error).toBeNull();
    expect(result.url).toBeTruthy();
  });
});
