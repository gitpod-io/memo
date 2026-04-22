import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Regression tests for issue #206: toggle blocks not functioning as toggles.
 *
 * The root cause was threefold:
 * 1. No visual toggle indicator (chevron) — list-none removed the browser
 *    disclosure triangle with no replacement.
 * 2. select-none on <summary> prevented text editing in the title.
 * 3. Native <summary> click toggled <details>, conflicting with Lexical
 *    text editing — clicking to place cursor collapsed the section.
 *
 * These static tests verify the structural fixes remain in place.
 */

function readSource(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

describe("collapsible-node toggle affordance", () => {
  const source = readSource("./collapsible-node.tsx");

  it("summary does not use select-none (title must be editable)", () => {
    // select-none prevents cursor placement and text selection in the
    // title, breaking inline editing.
    const summaryClass = source.match(/summary\.className\s*=\s*\n?\s*"([^"]*)"/);
    expect(summaryClass).not.toBeNull();
    expect(summaryClass![1]).not.toContain("select-none");
  });

  it("summary includes a toggle chevron button", () => {
    // A dedicated button with class collapsible-toggle must be created
    // as the visual affordance for expand/collapse.
    expect(source).toContain("collapsible-toggle");
    expect(source).toContain('aria-label", "Toggle section"');
  });

  it("chevron button is not contentEditable", () => {
    // The chevron must be excluded from Lexical's editable content
    // so it doesn't interfere with text editing.
    expect(source).toContain('contentEditable = "false"');
  });

  it("summary uses flex layout for chevron + text alignment", () => {
    const summaryClass = source.match(/summary\.className\s*=\s*\n?\s*"([^"]*)"/);
    expect(summaryClass).not.toBeNull();
    expect(summaryClass![1]).toContain("flex");
    expect(summaryClass![1]).toContain("items-center");
  });
});

describe("collapsible-plugin toggle handling", () => {
  const source = readSource("./collapsible-plugin.tsx");

  it("prevents native summary click from toggling details", () => {
    // The plugin must call preventDefault on summary clicks (except
    // on the chevron) to stop the native <details> toggle from
    // conflicting with Lexical text editing.
    expect(source).toContain("e.preventDefault()");
    expect(source).toContain("handleSummaryClick");
  });

  it("toggles via chevron button click only", () => {
    // A dedicated chevron click handler must toggle the node state
    // and sync the DOM.
    expect(source).toContain("handleChevronClick");
    expect(source).toContain("collapsible-toggle");
  });

  it("syncs DOM open state when toggling via chevron", () => {
    // After updating the Lexical node, the DOM must be synced since
    // we prevented the native toggle behavior.
    expect(source).toContain("dom.open = newOpen");
  });
});

describe("collapsible chevron CSS rotation", () => {
  const css = readFileSync(
    resolve(__dirname, "../../app/globals.css"),
    "utf-8"
  );

  it("rotates chevron when details is open", () => {
    expect(css).toContain("details[open] > summary > .collapsible-toggle");
    expect(css).toContain("rotate(90deg)");
  });
});

/**
 * Regression tests for issue #540: Enter key does not create a new line
 * after toggle blocks.
 *
 * Root cause: CollapsibleTitleNode did not implement insertNewAfter, so
 * Lexical's insertParagraph received null and did nothing. Additionally,
 * there was no KEY_ENTER_COMMAND handler to let users escape the content
 * area by pressing Enter on an empty trailing paragraph.
 */
describe("collapsible Enter key handling (#540)", () => {
  const nodeSource = readSource("./collapsible-node.tsx");
  const pluginSource = readSource("./collapsible-plugin.tsx");

  it("CollapsibleTitleNode implements insertNewAfter", () => {
    // Without insertNewAfter, pressing Enter in the title does nothing
    // because ElementNode.insertNewAfter returns null by default.
    expect(nodeSource).toContain("insertNewAfter(");
    // Must reference CollapsibleContentNode to move cursor into content
    expect(nodeSource).toMatch(
      /insertNewAfter[\s\S]*CollapsibleContentNode/
    );
  });

  it("CollapsibleTitleNode opens the container when entering content", () => {
    // If the toggle is closed, entering the content area must open it
    // so the user can see where the cursor moved.
    expect(nodeSource).toMatch(
      /insertNewAfter[\s\S]*setOpen\(true\)/
    );
  });

  it("plugin registers KEY_ENTER_COMMAND for escaping content", () => {
    // A KEY_ENTER_COMMAND handler must exist to let users break out of
    // the collapsible content by pressing Enter on an empty last paragraph.
    expect(pluginSource).toContain("KEY_ENTER_COMMAND");
    expect(pluginSource).toContain("$isCollapsibleContentNode");
    expect(pluginSource).toContain("$isCollapsibleContainerNode");
  });

  it("escape handler only triggers on empty last paragraph", () => {
    // The handler must check that the paragraph is empty and is the
    // last child of the content node to avoid interfering with normal
    // paragraph creation inside the content area.
    expect(pluginSource).toContain("getTextContentSize() !== 0");
    expect(pluginSource).toContain("getLastChild()");
  });
});
