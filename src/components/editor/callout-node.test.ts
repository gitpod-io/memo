import { describe, it, expect } from "vitest";
import { createHeadlessEditor } from "@lexical/headless";
import { $getRoot } from "lexical";
import {
  CalloutNode,
  $createCalloutNode,
  type CalloutVariant,
} from "./callout-node";

function createEditor() {
  return createHeadlessEditor({ nodes: [CalloutNode] });
}

/**
 * Helper: create a CalloutNode inside a headless editor and return
 * the DOM element produced by createDOM().
 */
function createCalloutDOM(
  emoji?: string,
  variant?: CalloutVariant
): HTMLElement {
  const editor = createEditor();
  let dom!: HTMLElement;
  editor.update(
    () => {
      const node = $createCalloutNode(emoji, variant);
      $getRoot().append(node);
      dom = node.createDOM();
    },
    { discrete: true }
  );
  return dom;
}

describe("CalloutNode ARIA attributes", () => {
  it("createDOM sets role='note' on the container", () => {
    const dom = createCalloutDOM();
    expect(dom.getAttribute("role")).toBe("note");
  });

  it("createDOM sets aria-label matching the variant (default: info)", () => {
    const dom = createCalloutDOM();
    expect(dom.getAttribute("aria-label")).toBe("Info callout");
  });

  it.each([
    ["info", "Info callout"],
    ["warning", "Warning callout"],
    ["success", "Success callout"],
    ["error", "Error callout"],
  ] as const)(
    "createDOM sets aria-label='%s' for variant %s",
    (variant, expectedLabel) => {
      const dom = createCalloutDOM("💡", variant);
      expect(dom.getAttribute("aria-label")).toBe(expectedLabel);
    }
  );

  it("emoji span has aria-hidden='true'", () => {
    const dom = createCalloutDOM();
    const emojiSpan = dom.querySelector(".callout-emoji");
    expect(emojiSpan).not.toBeNull();
    expect(emojiSpan!.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("CalloutNode updateDOM updates aria-label on variant change", () => {
  it("updates aria-label when variant changes", () => {
    const editor = createEditor();
    let dom!: HTMLElement;
    let prevNode!: CalloutNode;

    // Create initial node with variant "info"
    editor.update(
      () => {
        const node = $createCalloutNode("💡", "info");
        $getRoot().append(node);
        dom = node.createDOM();
        prevNode = node;
      },
      { discrete: true }
    );

    expect(dom.getAttribute("aria-label")).toBe("Info callout");

    // Update variant to "warning"
    editor.update(
      () => {
        const node = $createCalloutNode("⚠️", "warning");
        $getRoot().append(node);
        node.updateDOM(prevNode, dom);
      },
      { discrete: true }
    );

    expect(dom.getAttribute("aria-label")).toBe("Warning callout");
  });

  it("does not change aria-label when only emoji changes", () => {
    const editor = createEditor();
    let dom!: HTMLElement;
    let prevNode!: CalloutNode;

    editor.update(
      () => {
        const node = $createCalloutNode("💡", "success");
        $getRoot().append(node);
        dom = node.createDOM();
        prevNode = node;
      },
      { discrete: true }
    );

    expect(dom.getAttribute("aria-label")).toBe("Success callout");

    editor.update(
      () => {
        const node = $createCalloutNode("✅", "success");
        $getRoot().append(node);
        node.updateDOM(prevNode, dom);
      },
      { discrete: true }
    );

    // aria-label should remain the same since variant didn't change
    expect(dom.getAttribute("aria-label")).toBe("Success callout");
  });
});
