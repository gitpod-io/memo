import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { MARKDOWN_TRANSFORMERS } from "./markdown-utils";

function readSource(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

describe("MarkdownShortcutPlugin integration", () => {
  const editorSource = readSource("./editor.tsx");

  it("editor imports MarkdownShortcutPlugin", () => {
    expect(editorSource).toContain(
      'import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin"'
    );
  });

  it("editor renders MarkdownShortcutPlugin with MARKDOWN_TRANSFORMERS", () => {
    expect(editorSource).toContain(
      "<MarkdownShortcutPlugin transformers={MARKDOWN_TRANSFORMERS} />"
    );
  });

  it("editor imports MARKDOWN_TRANSFORMERS from markdown-utils", () => {
    expect(editorSource).toContain(
      'import { MARKDOWN_TRANSFORMERS } from "@/components/editor/markdown-utils"'
    );
  });
});

describe("MARKDOWN_TRANSFORMERS coverage", () => {
  // Verify the transformer array includes all required shortcut types
  const transformerTypes = MARKDOWN_TRANSFORMERS.map((t) => t.type);

  it("includes element transformers for block-level shortcuts", () => {
    // HEADING, QUOTE, CODE, UNORDERED_LIST, ORDERED_LIST, CHECK_LIST,
    // HORIZONTAL_RULE are all element transformers
    const elementCount = transformerTypes.filter(
      (t) => t === "element" || t === "multiline-element"
    ).length;
    expect(elementCount).toBeGreaterThanOrEqual(7);
  });

  it("includes text-format transformers for inline shortcuts", () => {
    const textFormatCount = transformerTypes.filter(
      (t) => t === "text-format"
    ).length;
    expect(textFormatCount).toBeGreaterThanOrEqual(4);
  });

  it("includes text-match transformers for links", () => {
    const textMatchCount = transformerTypes.filter(
      (t) => t === "text-match"
    ).length;
    expect(textMatchCount).toBeGreaterThanOrEqual(1);
  });

  it("HEADING transformer matches # syntax", () => {
    const heading = MARKDOWN_TRANSFORMERS.find(
      (t) => t.type === "element" && "regExp" in t && t.regExp?.source.includes("#")
    );
    expect(heading).toBeDefined();
  });

  it("QUOTE transformer matches > syntax", () => {
    const quote = MARKDOWN_TRANSFORMERS.find(
      (t) => t.type === "element" && "regExp" in t && t.regExp?.source.includes(">")
    );
    expect(quote).toBeDefined();
  });

  it("HORIZONTAL_RULE transformer matches --- syntax", () => {
    const hr = MARKDOWN_TRANSFORMERS.find(
      (t) => t.type === "element" && "regExp" in t && t.regExp?.source.includes("---")
    );
    expect(hr).toBeDefined();
  });

  it("UNORDERED_LIST transformer matches - or * syntax", () => {
    const ul = MARKDOWN_TRANSFORMERS.find(
      (t) =>
        t.type === "element" &&
        "regExp" in t &&
        (t.regExp?.source.includes("-") || t.regExp?.source.includes("*"))
    );
    expect(ul).toBeDefined();
  });

  it("ORDERED_LIST transformer matches 1. syntax", () => {
    const ol = MARKDOWN_TRANSFORMERS.find(
      (t) =>
        t.type === "element" &&
        "regExp" in t &&
        t.regExp?.source.includes("\\d")
    );
    expect(ol).toBeDefined();
  });

  it("includes a CODE multiline-element transformer for ``` syntax", () => {
    const code = MARKDOWN_TRANSFORMERS.find(
      (t) => t.type === "multiline-element"
    );
    expect(code).toBeDefined();
  });
});
