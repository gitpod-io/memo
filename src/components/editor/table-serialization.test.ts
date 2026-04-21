import { describe, it, expect } from "vitest";
import {
  createEditor,
  $getRoot,
  $createTextNode,
  $isElementNode,
  type ElementNode,
} from "lexical";
import {
  TableNode,
  TableRowNode,
  TableCellNode,
  $createTableNodeWithDimensions,
  $isTableNode,
  registerTablePlugin,
} from "@lexical/table";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";

const editorNodes = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  AutoLinkNode,
  LinkNode,
  TableNode,
  TableRowNode,
  TableCellNode,
];

function createTestEditor() {
  const editor = createEditor({ nodes: editorNodes });
  registerTablePlugin(editor);
  return editor;
}

/** Navigate table → row → cell → paragraph, all with type guards. */
function $getTableCellParagraph(
  table: ElementNode,
  rowIndex: number,
  cellIndex: number,
): ElementNode {
  const row = table.getChildren()[rowIndex];
  if (!$isElementNode(row)) throw new Error("Expected row to be ElementNode");
  const cell = row.getChildren()[cellIndex];
  if (!$isElementNode(cell)) throw new Error("Expected cell to be ElementNode");
  const paragraph = cell.getFirstChild();
  if (!$isElementNode(paragraph))
    throw new Error("Expected paragraph to be ElementNode");
  return paragraph;
}

describe("Table cell content serialization roundtrip", () => {
  it("preserves text typed into a header cell", () => {
    const editor = createTestEditor();

    editor.update(
      () => {
        const root = $getRoot();
        root.clear();
        const table = $createTableNodeWithDimensions(3, 3, {
          rows: true,
          columns: false,
        });
        root.append(table);
        $getTableCellParagraph(table, 0, 0).append($createTextNode("Hello"));
      },
      { discrete: true },
    );

    const json = editor.getEditorState().toJSON();
    const serialized = JSON.stringify(json);

    const editor2 = createTestEditor();
    const restored = editor2.parseEditorState(serialized);
    const json2 = restored.toJSON();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = json2.root.children.find((c: any) => c.type === "table") as any;
    expect(table).toBeDefined();

    const firstCellParagraph = table.children[0].children[0].children[0];
    expect(firstCellParagraph.children).toHaveLength(1);
    expect(firstCellParagraph.children[0].text).toBe("Hello");
  });

  it("preserves text added in a separate update (simulates user typing)", () => {
    const editor = createTestEditor();

    // Create table in first update
    editor.update(
      () => {
        const root = $getRoot();
        root.clear();
        const table = $createTableNodeWithDimensions(3, 3, {
          rows: true,
          columns: false,
        });
        root.append(table);
      },
      { discrete: true },
    );

    // Add text in a separate update (like user typing after table creation)
    editor.update(
      () => {
        const root = $getRoot();
        for (const child of root.getChildren()) {
          if ($isTableNode(child)) {
            $getTableCellParagraph(child, 0, 0).append(
              $createTextNode("World"),
            );
            break;
          }
        }
      },
      { discrete: true },
    );

    const json = editor.getEditorState().toJSON();
    const serialized = JSON.stringify(json);

    const editor2 = createTestEditor();
    const restored = editor2.parseEditorState(serialized);
    const json2 = restored.toJSON();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = json2.root.children.find((c: any) => c.type === "table") as any;
    const firstCellParagraph = table.children[0].children[0].children[0];
    expect(firstCellParagraph.children).toHaveLength(1);
    expect(firstCellParagraph.children[0].text).toBe("World");
  });

  it("preserves content in multiple cells across rows", () => {
    const editor = createTestEditor();

    editor.update(
      () => {
        const root = $getRoot();
        root.clear();
        const table = $createTableNodeWithDimensions(3, 3, {
          rows: true,
          columns: false,
        });
        root.append(table);

        $getTableCellParagraph(table, 0, 0).append(
          $createTextNode("Header 1"),
        );
        $getTableCellParagraph(table, 1, 1).append(
          $createTextNode("Body 1-2"),
        );
        $getTableCellParagraph(table, 2, 2).append(
          $createTextNode("Body 2-3"),
        );
      },
      { discrete: true },
    );

    const json = editor.getEditorState().toJSON();
    const serialized = JSON.stringify(json);

    const editor2 = createTestEditor();
    const restored = editor2.parseEditorState(serialized);
    const json2 = restored.toJSON();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = json2.root.children.find((c: any) => c.type === "table") as any;

    expect(table.children[0].children[0].children[0].children[0].text).toBe(
      "Header 1",
    );
    expect(table.children[1].children[1].children[0].children[0].text).toBe(
      "Body 1-2",
    );
    expect(table.children[2].children[2].children[0].children[0].text).toBe(
      "Body 2-3",
    );
  });

  it("onChange listener receives state with table cell content", () => {
    const editor = createTestEditor();
    let capturedState: string | null = null;

    editor.registerUpdateListener(
      ({ editorState, dirtyElements, dirtyLeaves, prevEditorState }) => {
        // Mirror OnChangePlugin's ignoreSelectionChange behavior
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
        if (prevEditorState.isEmpty()) return;
        capturedState = JSON.stringify(editorState.toJSON());
      },
    );

    // Initial table creation (prevEditorState.isEmpty() → skipped)
    editor.update(
      () => {
        const root = $getRoot();
        root.clear();
        const table = $createTableNodeWithDimensions(3, 3, {
          rows: true,
          columns: false,
        });
        root.append(table);
      },
      { discrete: true },
    );

    // Type into cell (this should trigger the listener)
    editor.update(
      () => {
        const root = $getRoot();
        for (const child of root.getChildren()) {
          if ($isTableNode(child)) {
            $getTableCellParagraph(child, 0, 0).append(
              $createTextNode("Captured"),
            );
            break;
          }
        }
      },
      { discrete: true },
    );

    expect(capturedState).not.toBeNull();
    expect(capturedState).toContain("Captured");
  });
});
