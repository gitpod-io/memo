import type { Meta, StoryObj } from "@storybook/react";
import { editorTheme } from "./theme";

// The CodeHighlightPlugin registers Prism-based syntax highlighting and handles
// paste inside code blocks (inserting line breaks instead of paragraphs).
// It returns null — stories show the visual result of highlighted code.

const meta: Meta = {
  title: "Editor/CodeHighlightPlugin",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

/** JavaScript code with syntax highlighting applied by the plugin. */
export const JavaScriptHighlighting: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl">
      <pre className={editorTheme.code}>
        <code>
          <span className={editorTheme.codeHighlight?.keyword}>const</span>{" "}
          <span className={editorTheme.codeHighlight?.function}>fetchData</span>{" "}
          <span className={editorTheme.codeHighlight?.operator}>=</span>{" "}
          <span className={editorTheme.codeHighlight?.keyword}>async</span>{" "}
          <span className={editorTheme.codeHighlight?.punctuation}>(</span>
          <span className={editorTheme.codeHighlight?.variable}>url</span>
          <span className={editorTheme.codeHighlight?.punctuation}>)</span>{" "}
          <span className={editorTheme.codeHighlight?.operator}>=&gt;</span>{" "}
          <span className={editorTheme.codeHighlight?.punctuation}>{"{"}</span>
          {"\n"}
          {"  "}
          <span className={editorTheme.codeHighlight?.keyword}>const</span>{" "}
          <span className={editorTheme.codeHighlight?.variable}>response</span>{" "}
          <span className={editorTheme.codeHighlight?.operator}>=</span>{" "}
          <span className={editorTheme.codeHighlight?.keyword}>await</span>{" "}
          <span className={editorTheme.codeHighlight?.function}>fetch</span>
          <span className={editorTheme.codeHighlight?.punctuation}>(</span>
          <span className={editorTheme.codeHighlight?.variable}>url</span>
          <span className={editorTheme.codeHighlight?.punctuation}>)</span>
          <span className={editorTheme.codeHighlight?.punctuation}>;</span>
          {"\n"}
          {"  "}
          <span className={editorTheme.codeHighlight?.keyword}>return</span>{" "}
          <span className={editorTheme.codeHighlight?.variable}>response</span>
          <span className={editorTheme.codeHighlight?.punctuation}>.</span>
          <span className={editorTheme.codeHighlight?.function}>json</span>
          <span className={editorTheme.codeHighlight?.punctuation}>(</span>
          <span className={editorTheme.codeHighlight?.punctuation}>)</span>
          <span className={editorTheme.codeHighlight?.punctuation}>;</span>
          {"\n"}
          <span className={editorTheme.codeHighlight?.punctuation}>{"}"}</span>
          <span className={editorTheme.codeHighlight?.punctuation}>;</span>
        </code>
      </pre>
    </div>
  ),
};

/** Multi-line paste result — lines stay inside the code block as line breaks. */
export const MultiLinePaste: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl">
      <pre className={editorTheme.code}>
        <code>
          <span className={editorTheme.codeHighlight?.comment}>
            {"// Pasted multi-line content stays inside the code block"}
          </span>
          {"\n"}
          <span className={editorTheme.codeHighlight?.keyword}>function</span>{" "}
          <span className={editorTheme.codeHighlight?.function}>add</span>
          <span className={editorTheme.codeHighlight?.punctuation}>(</span>
          <span className={editorTheme.codeHighlight?.variable}>a</span>
          <span className={editorTheme.codeHighlight?.punctuation}>,</span>{" "}
          <span className={editorTheme.codeHighlight?.variable}>b</span>
          <span className={editorTheme.codeHighlight?.punctuation}>)</span>{" "}
          <span className={editorTheme.codeHighlight?.punctuation}>{"{"}</span>
          {"\n"}
          {"  "}
          <span className={editorTheme.codeHighlight?.keyword}>return</span>{" "}
          <span className={editorTheme.codeHighlight?.variable}>a</span>{" "}
          <span className={editorTheme.codeHighlight?.operator}>+</span>{" "}
          <span className={editorTheme.codeHighlight?.variable}>b</span>
          <span className={editorTheme.codeHighlight?.punctuation}>;</span>
          {"\n"}
          <span className={editorTheme.codeHighlight?.punctuation}>{"}"}</span>
        </code>
      </pre>
    </div>
  ),
};

/** Plain text code block — no highlighting tokens applied. */
export const PlainTextBlock: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl">
      <pre className={editorTheme.code}>
        <code>
          This is a plain text code block.{"\n"}
          No syntax highlighting is applied.{"\n"}
          All text uses the default code foreground color.
        </code>
      </pre>
    </div>
  ),
};
