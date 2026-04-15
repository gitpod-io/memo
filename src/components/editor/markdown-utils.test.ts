import { describe, it, expect } from "vitest";
import { parseMarkdownToEditorState } from "./markdown-utils";

describe("parseMarkdownToEditorState", () => {
  it("parses a heading into editor state", () => {
    const state = parseMarkdownToEditorState("# Hello World");
    const root = state.root;
    expect(root.children.length).toBeGreaterThanOrEqual(1);
    const firstChild = root.children[0] as Record<string, unknown>;
    expect(firstChild.type).toBe("heading");
    expect(firstChild.tag).toBe("h1");
  });

  it("parses multiple block types", () => {
    const markdown = [
      "# Heading 1",
      "",
      "A paragraph of text.",
      "",
      "- Item one",
      "- Item two",
      "",
      "> A blockquote",
      "",
      "```",
      "const x = 1;",
      "```",
    ].join("\n");

    const state = parseMarkdownToEditorState(markdown);
    const root = state.root;
    const types = root.children.map(
      (c: Record<string, unknown>) => c.type as string
    );

    expect(types).toContain("heading");
    expect(types).toContain("paragraph");
    expect(types).toContain("list");
    expect(types).toContain("quote");
    expect(types).toContain("code");
  });

  it("preserves bold and italic formatting", () => {
    const state = parseMarkdownToEditorState(
      "This is **bold** and *italic* text."
    );
    const root = state.root;
    const paragraph = root.children[0] as Record<string, unknown>;
    expect(paragraph.type).toBe("paragraph");

    // The paragraph should have children with format flags
    const children = paragraph.children as Record<string, unknown>[];
    expect(children.length).toBeGreaterThan(1);

    const boldChild = children.find(
      (c) => typeof c.format === "number" && (c.format as number) & 1
    );
    expect(boldChild).toBeDefined();
  });

  it("returns an empty paragraph for empty input", () => {
    const state = parseMarkdownToEditorState("");
    const root = state.root;
    expect(root.children.length).toBe(1);
    const firstChild = root.children[0] as Record<string, unknown>;
    expect(firstChild.type).toBe("paragraph");
  });

  it("parses links", () => {
    const state = parseMarkdownToEditorState(
      "Visit [Memo](https://example.com) for more."
    );
    const root = state.root;
    const paragraph = root.children[0] as Record<string, unknown>;
    const children = paragraph.children as Record<string, unknown>[];
    const linkChild = children.find((c) => c.type === "link");
    expect(linkChild).toBeDefined();
    expect((linkChild as Record<string, unknown>).url).toBe(
      "https://example.com"
    );
  });

  it("parses strikethrough text", () => {
    const state = parseMarkdownToEditorState("This is ~~deleted~~ text.");
    const root = state.root;
    const paragraph = root.children[0] as Record<string, unknown>;
    const children = paragraph.children as Record<string, unknown>[];
    // Strikethrough format flag is 4
    const strikeChild = children.find(
      (c) => typeof c.format === "number" && (c.format as number) & 4
    );
    expect(strikeChild).toBeDefined();
  });

  it("parses ordered lists", () => {
    const markdown = ["1. First", "2. Second", "3. Third"].join("\n");
    const state = parseMarkdownToEditorState(markdown);
    const root = state.root;
    const list = root.children[0] as Record<string, unknown>;
    expect(list.type).toBe("list");
    expect(list.listType).toBe("number");
  });

  it("parses horizontal rules", () => {
    const markdown = ["Above", "", "---", "", "Below"].join("\n");
    const state = parseMarkdownToEditorState(markdown);
    const root = state.root;
    const types = root.children.map(
      (c: Record<string, unknown>) => c.type as string
    );
    expect(types).toContain("horizontalrule");
  });
});
