import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const imageNodeSource = readFileSync(
  join(process.cwd(), "src/components/editor/image-node.tsx"),
  "utf-8"
);

describe("ImageNode — alignment field", () => {
  it("exports ImageAlignment type", () => {
    expect(imageNodeSource).toContain(
      'export type ImageAlignment = "left" | "center" | "right"'
    );
  });

  it("includes alignment in SerializedImageNode", () => {
    expect(imageNodeSource).toContain("alignment: ImageAlignment");
  });

  it("defaults alignment to center in constructor", () => {
    expect(imageNodeSource).toContain('this.__alignment = alignment ?? "center"');
  });

  it("handles backward compat in importJSON (missing alignment)", () => {
    expect(imageNodeSource).toContain(
      'alignment: serializedNode.alignment ?? "center"'
    );
  });

  it("includes alignment in exportJSON", () => {
    expect(imageNodeSource).toContain("alignment: this.__alignment");
  });

  it("has setAlignment method", () => {
    expect(imageNodeSource).toContain("setAlignment(alignment: ImageAlignment)");
  });

  it("has setSrc method for crop updates", () => {
    expect(imageNodeSource).toContain("setSrc(src: string)");
  });

  it("has setWidthAndHeight method that accepts undefined for dimension reset", () => {
    expect(imageNodeSource).toContain(
      "setWidthAndHeight("
    );
    expect(imageNodeSource).toContain("width: number | undefined");
    expect(imageNodeSource).toContain("height: number | undefined");
  });
});

describe("ImageNode — crop dimension reset (#279)", () => {
  it("setWidthAndHeight accepts undefined to reset to natural size", () => {
    // Passing 0 instead of undefined causes the image to render at 0x0 (invisible)
    expect(imageNodeSource).toContain("width: number | undefined");
    expect(imageNodeSource).toContain("height: number | undefined");
  });

  it("does not set width/height to 0 in setWidthAndHeight", () => {
    // The method body should assign the parameter directly, not coerce to 0
    const methodMatch = imageNodeSource.match(
      /setWidthAndHeight\([^)]+\)[^{]*\{([\s\S]*?)\n  \}/
    );
    expect(methodMatch).not.toBeNull();
    const methodBody = methodMatch![1];
    // Ensure the method doesn't hardcode 0
    expect(methodBody).not.toMatch(/=\s*0/);
  });
});

describe("ImageNode — selection and resize", () => {
  it("uses useLexicalNodeSelection for selection tracking", () => {
    expect(imageNodeSource).toContain("useLexicalNodeSelection");
  });

  it("registers CLICK_COMMAND for image selection", () => {
    expect(imageNodeSource).toContain("CLICK_COMMAND");
  });

  it("registers KEY_ESCAPE_COMMAND to deselect", () => {
    expect(imageNodeSource).toContain("KEY_ESCAPE_COMMAND");
  });

  it("renders resize handles when selected", () => {
    expect(imageNodeSource).toContain("cursor-nw-resize");
    expect(imageNodeSource).toContain("cursor-ne-resize");
    expect(imageNodeSource).toContain("cursor-sw-resize");
    expect(imageNodeSource).toContain("cursor-se-resize");
  });

  it("shows ring-2 ring-accent when selected", () => {
    expect(imageNodeSource).toContain("ring-2 ring-accent");
  });

  it("applies alignment classes to figure", () => {
    expect(imageNodeSource).toContain("items-start");
    expect(imageNodeSource).toContain("items-center");
    expect(imageNodeSource).toContain("items-end");
  });

  it("sets data-image-node-key attribute for toolbar positioning", () => {
    expect(imageNodeSource).toContain("data-image-node-key={nodeKey}");
  });

  it("enforces minimum image width during resize", () => {
    expect(imageNodeSource).toContain("MIN_IMAGE_WIDTH");
    expect(imageNodeSource).toMatch(/MIN_IMAGE_WIDTH\s*=\s*100/);
  });

  it("does not use unsafe as Node cast on event targets", () => {
    // The node-contains-safety test covers this globally, but verify here too
    expect(imageNodeSource).not.toMatch(/\.target\s+as\s+Node/);
    expect(imageNodeSource).toContain("target instanceof Node");
  });
});
