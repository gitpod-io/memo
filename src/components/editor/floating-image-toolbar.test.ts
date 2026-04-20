import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const toolbarSource = readFileSync(
  join(
    process.cwd(),
    "src/components/editor/floating-image-toolbar-plugin.tsx"
  ),
  "utf-8"
);

const expandSource = readFileSync(
  join(process.cwd(), "src/components/editor/image-expand-dialog.tsx"),
  "utf-8"
);

const cropSource = readFileSync(
  join(process.cwd(), "src/components/editor/image-crop-dialog.tsx"),
  "utf-8"
);

describe("Floating image toolbar — design spec", () => {
  it("uses rounded-lg per issue spec", () => {
    expect(toolbarSource).toContain("rounded-lg");
  });

  it("uses shadow-lg per issue spec", () => {
    expect(toolbarSource).toContain("shadow-lg");
  });

  it("uses dark surface (bg-popover)", () => {
    expect(toolbarSource).toContain("bg-popover");
  });

  it("uses text-xs icon buttons", () => {
    expect(toolbarSource).toContain("text-xs");
  });

  it("has no transition on hover (instant state change)", () => {
    expect(toolbarSource).not.toMatch(/transition/i);
  });

  it("renders all required toolbar buttons", () => {
    expect(toolbarSource).toContain("Align left");
    expect(toolbarSource).toContain("Align center");
    expect(toolbarSource).toContain("Align right");
    expect(toolbarSource).toContain("Crop image");
    expect(toolbarSource).toContain("Expand image");
    expect(toolbarSource).toContain("Download image");
  });

  it("uses @floating-ui/react for positioning", () => {
    expect(toolbarSource).toContain("computePosition");
    expect(toolbarSource).toContain("@floating-ui/react");
  });

  it("uses createPortal for rendering", () => {
    expect(toolbarSource).toContain("createPortal");
  });

  it("uses lucide-react icons", () => {
    expect(toolbarSource).toContain("lucide-react");
    expect(toolbarSource).toContain("AlignLeft");
    expect(toolbarSource).toContain("AlignCenter");
    expect(toolbarSource).toContain("AlignRight");
    expect(toolbarSource).toContain("Maximize2");
    expect(toolbarSource).toContain("Download");
    expect(toolbarSource).toContain("Crop");
  });

  it("has role=toolbar and aria-label", () => {
    expect(toolbarSource).toContain('role="toolbar"');
    expect(toolbarSource).toContain('aria-label="Image tools"');
  });
});

describe("Image expand dialog", () => {
  it("uses shadcn Dialog component", () => {
    expect(expandSource).toContain("@/components/ui/dialog");
  });

  it("shows image at full resolution with max constraints", () => {
    expect(expandSource).toContain("max-h-[85vh]");
    expect(expandSource).toContain("max-w-full");
    expect(expandSource).toContain("object-contain");
  });

  it("has close button", () => {
    expect(expandSource).toContain("showCloseButton");
  });
});

describe("Image crop dialog", () => {
  it("uses canvas-based crop approach", () => {
    expect(cropSource).toContain("<canvas");
    expect(cropSource).toContain("getContext");
  });

  it("uploads cropped image via uploadImage", () => {
    expect(cropSource).toContain("uploadImage");
  });

  it("uses shadcn Dialog component", () => {
    expect(cropSource).toContain("@/components/ui/dialog");
  });

  it("has Apply Crop and Cancel buttons", () => {
    expect(cropSource).toContain("Apply Crop");
    expect(cropSource).toContain("Cancel");
  });

  it("shows loading state while saving", () => {
    expect(cropSource).toContain("Saving...");
    expect(cropSource).toContain("isSaving");
  });

  it("handles image load errors gracefully", () => {
    expect(cropSource).toContain("Failed to load image for cropping");
  });

  it("reports errors to Sentry", () => {
    expect(cropSource).toContain("Sentry.captureException");
  });
});
