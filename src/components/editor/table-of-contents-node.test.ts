import { describe, it, expect } from "vitest";
import { createHeadlessEditor } from "@lexical/headless";
import { $getRoot } from "lexical";
import { HeadingNode } from "@lexical/rich-text";
import {
  TableOfContentsNode,
  $createTableOfContentsNode,
  $isTableOfContentsNode,
} from "./table-of-contents-node";

function createEditor() {
  return createHeadlessEditor({
    nodes: [TableOfContentsNode, HeadingNode],
  });
}

describe("TableOfContentsNode", () => {
  it("has type 'table-of-contents'", () => {
    expect(TableOfContentsNode.getType()).toBe("table-of-contents");
  });

  it("creates a node via $createTableOfContentsNode", () => {
    const editor = createEditor();
    editor.update(
      () => {
        const node = $createTableOfContentsNode();
        expect($isTableOfContentsNode(node)).toBe(true);
        expect(node.getType()).toBe("table-of-contents");
      },
      { discrete: true },
    );
  });

  it("serializes to JSON and back", () => {
    const editor = createEditor();
    let json: ReturnType<TableOfContentsNode["exportJSON"]>;

    editor.update(
      () => {
        const node = $createTableOfContentsNode();
        $getRoot().append(node);
        json = node.exportJSON();
      },
      { discrete: true },
    );

    expect(json!.type).toBe("table-of-contents");
    expect(json!.version).toBe(1);

    // Import from JSON
    editor.update(
      () => {
        const imported = TableOfContentsNode.importJSON(json!);
        expect($isTableOfContentsNode(imported)).toBe(true);
      },
      { discrete: true },
    );
  });

  it("createDOM returns a div with class 'editor-toc'", () => {
    const editor = createEditor();
    let dom!: HTMLElement;

    editor.update(
      () => {
        const node = $createTableOfContentsNode();
        $getRoot().append(node);
        dom = node.createDOM();
      },
      { discrete: true },
    );

    expect(dom.tagName).toBe("DIV");
    expect(dom.className).toBe("editor-toc");
  });

  it("exportDOM returns a div with data-type attribute", () => {
    const editor = createEditor();
    let output!: { element: HTMLElement };

    editor.update(
      () => {
        const node = $createTableOfContentsNode();
        $getRoot().append(node);
        output = node.exportDOM() as { element: HTMLElement };
      },
      { discrete: true },
    );

    expect(output.element.getAttribute("data-type")).toBe(
      "table-of-contents",
    );
    expect(output.element.textContent).toBe("[Table of Contents]");
  });

  it("isInline returns false", () => {
    const editor = createEditor();

    editor.update(
      () => {
        const node = $createTableOfContentsNode();
        expect(node.isInline()).toBe(false);
      },
      { discrete: true },
    );
  });

  it("$isTableOfContentsNode returns false for null/undefined", () => {
    expect($isTableOfContentsNode(null)).toBe(false);
    expect($isTableOfContentsNode(undefined)).toBe(false);
  });

  it("clone produces an equivalent node", () => {
    const editor = createEditor();

    editor.update(
      () => {
        const node = $createTableOfContentsNode();
        $getRoot().append(node);
        const cloned = TableOfContentsNode.clone(node);
        expect(cloned.getType()).toBe("table-of-contents");
        expect(cloned.getKey()).toBe(node.getKey());
      },
      { discrete: true },
    );
  });

  it("round-trips through editor state serialization", () => {
    const editor = createEditor();

    editor.update(
      () => {
        const node = $createTableOfContentsNode();
        $getRoot().append(node);
      },
      { discrete: true },
    );

    const stateJson = editor.getEditorState().toJSON();
    const rootChildren = stateJson.root.children as Array<{ type: string }>;
    const tocNodes = rootChildren.filter(
      (c) => c.type === "table-of-contents",
    );
    expect(tocNodes).toHaveLength(1);

    // Parse back
    const editor2 = createEditor();
    const parsed = editor2.parseEditorState(JSON.stringify(stateJson));
    editor2.setEditorState(parsed);

    editor2.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      const tocChild = children.find((c) => $isTableOfContentsNode(c));
      expect(tocChild).toBeDefined();
    });
  });
});
