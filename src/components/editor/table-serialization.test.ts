/**
 * Test table cell content serialization round-trip.
 *
 * Reproduces the bug from #402: table cell text content is lost after
 * save and reload. The table structure (rows, columns, header/body
 * distinction) is preserved, but all cell text content is empty after
 * deserialization.
 */
import { describe, it, expect } from "vitest";
import { createHeadlessEditor } from "@lexical/headless";
import {
  TableNode,
  TableRowNode,
  TableCellNode,
  $createTableNodeWithDimensions,
  registerTablePlugin,
} from "@lexical/table";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import {
  $getRoot,
  $createTextNode,
  $isTextNode,
  $isElementNode,
  type SerializedEditorState,
} from "lexical";

const EDITOR_NODES = [
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

/**
 * Create a headless editor with the same node set as the real editor,
 * insert a 3×3 table, type text into the first header cell, and return
 * the serialized editor state (what `editorState.toJSON()` produces).
 */
function createTableWithContent(cellText: string): SerializedEditorState {
  const editor = createHeadlessEditor({ nodes: EDITOR_NODES });
  registerTablePlugin(editor);

  editor.update(
    () => {
      const root = $getRoot();
      root.clear();
      const table = $createTableNodeWithDimensions(3, 3, {
        rows: true,
        columns: false,
      });
      root.append(table);

      // Type text into the first header cell's text node
      const firstTextNode = table.getFirstDescendant();
      if ($isTextNode(firstTextNode)) {
        firstTextNode.setTextContent(cellText);
      }
    },
    { discrete: true },
  );

  return editor.getEditorState().toJSON();
}

/**
 * Simulate the exact load path used by the Editor component:
 *
 * 1. `initialContent` comes from Supabase as a parsed JSON object
 * 2. Editor component does `JSON.stringify(initialContent)` for `editorState`
 * 3. LexicalComposer calls `editor.parseEditorState(string)`
 * 4. Then `editor.setEditorState(parsed)`
 * 5. TablePlugin mounts and registers transforms
 *
 * Returns the final serialized state after all transforms have run.
 */
function loadEditorState(
  savedContent: SerializedEditorState,
): SerializedEditorState {
  // Simulate Supabase round-trip: jsonb stores parsed JSON
  const fromSupabase = JSON.parse(
    JSON.stringify(savedContent),
  ) as SerializedEditorState;

  // Simulate Editor component: JSON.stringify(initialContent)
  const editorStateString = JSON.stringify(fromSupabase);

  // Create a fresh editor (simulating page reload)
  const editor = createHeadlessEditor({ nodes: EDITOR_NODES });

  // Simulate LexicalComposer's initializeEditor for string type
  const parsedState = editor.parseEditorState(editorStateString);
  editor.setEditorState(parsedState, { tag: "history-merge" });

  // Simulate TablePlugin mounting after setEditorState
  registerTablePlugin(editor);

  return editor.getEditorState().toJSON();
}

/** Walk the serialized state tree and extract text from the first table cell. */
function getFirstCellText(state: SerializedEditorState): string {
  const root = state.root;
  // root > table > row > cell > paragraph > text
  const table = root.children[0] as Record<string, unknown>;
  const row = (table.children as Record<string, unknown>[])[0];
  const cell = (row.children as Record<string, unknown>[])[0];
  const paragraph = (cell.children as Record<string, unknown>[])[0];
  const children = paragraph.children as Record<string, unknown>[];
  if (children.length === 0) return "";
  return (children[0].text as string) ?? "";
}

describe("Table cell content serialization (#402)", () => {
  it("serializes table cell text content", () => {
    const saved = createTableWithContent("Hello");
    expect(getFirstCellText(saved)).toBe("Hello");
  });

  it("preserves table cell text after JSON round-trip", () => {
    const saved = createTableWithContent("Hello");
    const stringified = JSON.stringify(saved);
    const parsed = JSON.parse(stringified) as SerializedEditorState;
    expect(getFirstCellText(parsed)).toBe("Hello");
  });

  it("preserves table cell text after full save/load cycle", () => {
    const saved = createTableWithContent("Hello");
    const loaded = loadEditorState(saved);
    expect(getFirstCellText(loaded)).toBe("Hello");
  });

  it("preserves table cell text with special characters", () => {
    const saved = createTableWithContent('Hello "World" & <Friends>');
    const loaded = loadEditorState(saved);
    expect(getFirstCellText(loaded)).toBe('Hello "World" & <Friends>');
  });

  it("preserves table structure after save/load cycle", () => {
    const saved = createTableWithContent("Hello");
    const loaded = loadEditorState(saved);

    const table = loaded.root.children[0] as Record<string, unknown>;
    expect(table.type).toBe("table");

    const rows = table.children as Record<string, unknown>[];
    expect(rows).toHaveLength(3);

    const firstRow = rows[0];
    const cells = firstRow.children as Record<string, unknown>[];
    expect(cells).toHaveLength(3);
    expect(cells[0].type).toBe("tablecell");
    expect((cells[0] as { headerState: number }).headerState).toBe(1);
  });

  it("preserves multiple cells with content", () => {
    const editor = createHeadlessEditor({ nodes: EDITOR_NODES });
    registerTablePlugin(editor);

    editor.update(
      () => {
        const root = $getRoot();
        root.clear();
        const table = $createTableNodeWithDimensions(3, 3, {
          rows: true,
          columns: false,
        });
        root.append(table);

        // Fill multiple cells
        const rows = table.getChildren();
        for (let r = 0; r < rows.length; r++) {
          const row = rows[r];
          if (!$isElementNode(row)) continue;
          const cells = row.getChildren();
          for (let c = 0; c < cells.length; c++) {
            const cell = cells[c];
            if (!$isElementNode(cell)) continue;
            const paragraph = cell.getFirstChild();
            if ($isElementNode(paragraph)) {
              const textNode = paragraph.getFirstChild();
              if ($isTextNode(textNode)) {
                textNode.setTextContent(`R${r}C${c}`);
              } else {
                paragraph.append($createTextNode(`R${r}C${c}`));
              }
            }
          }
        }
      },
      { discrete: true },
    );

    const saved = editor.getEditorState().toJSON();
    const loaded = loadEditorState(saved);

    // Verify all cells have content
    const table = loaded.root.children[0] as Record<string, unknown>;
    const rows = table.children as Record<string, unknown>[];
    for (let r = 0; r < 3; r++) {
      const cells = rows[r].children as Record<string, unknown>[];
      for (let c = 0; c < 3; c++) {
        const paragraph = (cells[c].children as Record<string, unknown>[])[0];
        const textNodes = paragraph.children as Record<string, unknown>[];
        expect(textNodes.length).toBeGreaterThan(0);
        expect(textNodes[0].text).toBe(`R${r}C${c}`);
      }
    }
  });
});
