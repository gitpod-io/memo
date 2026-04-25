import type { Meta, StoryObj } from "@storybook/react";
import { editorTheme } from "./theme";

const meta: Meta = {
  title: "Editor/Theme",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

export const Typography: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl space-y-1">
      <h1 className={editorTheme.heading?.h1}>Heading 1</h1>
      <h2 className={editorTheme.heading?.h2}>Heading 2</h2>
      <h3 className={editorTheme.heading?.h3}>Heading 3</h3>
      <p className={editorTheme.paragraph}>
        This is a paragraph with{" "}
        <strong className={editorTheme.text?.bold}>bold text</strong>,{" "}
        <em className={editorTheme.text?.italic}>italic text</em>,{" "}
        <span className={editorTheme.text?.underline}>underlined text</span>,{" "}
        <span className={editorTheme.text?.strikethrough}>
          strikethrough text
        </span>
        , and <code className={editorTheme.text?.code}>inline code</code>.
      </p>
      <p className={editorTheme.paragraph}>
        Here is a{" "}
        <a href="#" className={editorTheme.link}>
          link example
        </a>{" "}
        within a paragraph.
      </p>
    </div>
  ),
};

export const Blockquote: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl">
      <blockquote className={editorTheme.quote}>
        The best way to predict the future is to invent it. — Alan Kay
      </blockquote>
    </div>
  ),
};

export const Lists: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl space-y-4">
      <ul className={editorTheme.list?.ul}>
        <li className={editorTheme.list?.listitem}>First unordered item</li>
        <li className={editorTheme.list?.listitem}>Second unordered item</li>
        <li className={editorTheme.list?.listitem}>Third unordered item</li>
      </ul>
      <ol className={editorTheme.list?.ol}>
        <li className={editorTheme.list?.listitem}>First ordered item</li>
        <li className={editorTheme.list?.listitem}>Second ordered item</li>
        <li className={editorTheme.list?.listitem}>Third ordered item</li>
      </ol>
    </div>
  ),
};

export const Checklist: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl">
      <ul className="mt-0.5 pl-0 text-sm">
        <li className={editorTheme.list?.listitemUnchecked}>
          Unchecked task item
        </li>
        <li className={editorTheme.list?.listitemChecked}>
          Checked task item
        </li>
        <li className={editorTheme.list?.listitemUnchecked}>
          Another unchecked item
        </li>
      </ul>
    </div>
  ),
};

export const CodeBlock: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl">
      <pre className={editorTheme.code}>
        <code>
          <span className={editorTheme.codeHighlight?.keyword}>const</span>{" "}
          <span className={editorTheme.codeHighlight?.variable}>greeting</span>{" "}
          <span className={editorTheme.codeHighlight?.operator}>=</span>{" "}
          <span className={editorTheme.codeHighlight?.string}>
            &quot;Hello, world&quot;
          </span>
          <span className={editorTheme.codeHighlight?.punctuation}>;</span>
          {"\n"}
          <span className={editorTheme.codeHighlight?.builtin}>console</span>
          <span className={editorTheme.codeHighlight?.punctuation}>.</span>
          <span className={editorTheme.codeHighlight?.function}>log</span>
          <span className={editorTheme.codeHighlight?.punctuation}>(</span>
          <span className={editorTheme.codeHighlight?.variable}>greeting</span>
          <span className={editorTheme.codeHighlight?.punctuation}>)</span>
          <span className={editorTheme.codeHighlight?.punctuation}>;</span>
          {"\n"}
          {"\n"}
          <span className={editorTheme.codeHighlight?.comment}>
            {"// A function example"}
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

export const HorizontalRule: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl">
      <p className={editorTheme.paragraph}>Content above the rule.</p>
      <hr className={editorTheme.horizontalRule} />
      <p className={editorTheme.paragraph}>Content below the rule.</p>
    </div>
  ),
};

export const Callouts: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Callout blocks use `role=\"note\"` and `aria-label` with the variant name " +
          "(e.g. \"Info callout\") so screen readers can distinguish them from regular " +
          "content. The emoji span has `aria-hidden=\"true\"` to avoid redundant output.",
      },
    },
  },
  render: () => (
    <div className="mx-auto max-w-2xl space-y-2">
      <div
        className="mt-3 flex gap-3 border-l-2 border-l-accent bg-muted p-4 text-sm"
        role="note"
        aria-label="Info callout"
      >
        <span className="shrink-0 text-lg" aria-hidden="true">
          💡
        </span>
        <span>Info callout — useful tips and information.</span>
      </div>
      <div
        className="mt-3 flex gap-3 border-l-2 border-l-code-type bg-muted p-4 text-sm"
        role="note"
        aria-label="Warning callout"
      >
        <span className="shrink-0 text-lg" aria-hidden="true">
          ⚠️
        </span>
        <span>Warning callout — proceed with caution.</span>
      </div>
      <div
        className="mt-3 flex gap-3 border-l-2 border-l-code-string bg-muted p-4 text-sm"
        role="note"
        aria-label="Success callout"
      >
        <span className="shrink-0 text-lg" aria-hidden="true">
          ✅
        </span>
        <span>Success callout — operation completed.</span>
      </div>
      <div
        className="mt-3 flex gap-3 border-l-2 border-l-destructive bg-muted p-4 text-sm"
        role="note"
        aria-label="Error callout"
      >
        <span className="shrink-0 text-lg" aria-hidden="true">
          ❌
        </span>
        <span>Error callout — something went wrong.</span>
      </div>
    </div>
  ),
};

export const Collapsible: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl">
      <details className="mt-3 border border-overlay-border text-sm rounded-sm" open>
        <summary className="flex items-center gap-1.5 p-3 text-sm font-medium text-foreground hover:bg-overlay-hover list-none cursor-pointer">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground transition-transform duration-150"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          Click to expand
        </summary>
        <div className="border-t border-overlay-border p-3 text-sm">
          <p className={editorTheme.paragraph}>
            This is the collapsible content area. It can contain any editor
            content including paragraphs, lists, and code blocks.
          </p>
        </div>
      </details>

      <details className="mt-3 border border-overlay-border text-sm rounded-sm">
        <summary className="flex items-center gap-1.5 p-3 text-sm font-medium text-foreground hover:bg-overlay-hover list-none cursor-pointer">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground transition-transform duration-150"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          Collapsed section
        </summary>
        <div className="border-t border-overlay-border p-3 text-sm">
          <p className={editorTheme.paragraph}>Hidden content.</p>
        </div>
      </details>
    </div>
  ),
};

export const Table: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl">
      <table className={editorTheme.table}>
        <thead>
          <tr className={editorTheme.tableRow}>
            <th className={editorTheme.tableCellHeader}>Feature</th>
            <th className={editorTheme.tableCellHeader}>Status</th>
            <th className={editorTheme.tableCellHeader}>Priority</th>
          </tr>
        </thead>
        <tbody>
          <tr className={editorTheme.tableRow}>
            <td className={editorTheme.tableCell}>Rich text editor</td>
            <td className={editorTheme.tableCell}>Done</td>
            <td className={editorTheme.tableCell}>P1</td>
          </tr>
          <tr className={editorTheme.tableRow}>
            <td className={editorTheme.tableCell}>
              <strong className={editorTheme.text?.bold}>Table blocks</strong>
            </td>
            <td className={editorTheme.tableCell}>
              <em className={editorTheme.text?.italic}>In progress</em>
            </td>
            <td className={editorTheme.tableCell}>
              <code className={editorTheme.text?.code}>P2</code>
            </td>
          </tr>
          <tr className={editorTheme.tableRow}>
            <td className={editorTheme.tableCell}>Realtime collab</td>
            <td className={editorTheme.tableCell}>Planned</td>
            <td className={editorTheme.tableCell}>P3</td>
          </tr>
        </tbody>
      </table>
    </div>
  ),
};

export const TableMinimal: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl">
      <table className={editorTheme.table}>
        <tbody>
          <tr className={editorTheme.tableRow}>
            <td className={editorTheme.tableCell}>Cell 1</td>
            <td className={editorTheme.tableCell}>Cell 2</td>
          </tr>
          <tr className={editorTheme.tableRow}>
            <td className={editorTheme.tableCell}>Cell 3</td>
            <td className={editorTheme.tableCell}>Cell 4</td>
          </tr>
        </tbody>
      </table>
    </div>
  ),
};

export const FullDocument: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl">
      <h1 className={editorTheme.heading?.h1}>Project Overview</h1>
      <p className={editorTheme.paragraph}>
        This is a full document example showing how all editor elements look
        together. It uses the actual theme classes from the Lexical editor.
      </p>

      <h2 className={editorTheme.heading?.h2}>Getting Started</h2>
      <p className={editorTheme.paragraph}>
        Follow these steps to set up the project. You&apos;ll need{" "}
        <code className={editorTheme.text?.code}>Node.js 18+</code> and{" "}
        <code className={editorTheme.text?.code}>pnpm</code>.
      </p>
      <ol className={editorTheme.list?.ol}>
        <li className={editorTheme.list?.listitem}>Clone the repository</li>
        <li className={editorTheme.list?.listitem}>
          Run <code className={editorTheme.text?.code}>pnpm install</code>
        </li>
        <li className={editorTheme.list?.listitem}>
          Start the dev server with{" "}
          <code className={editorTheme.text?.code}>pnpm dev</code>
        </li>
      </ol>

      <h2 className={editorTheme.heading?.h2}>Key Features</h2>
      <ul className={editorTheme.list?.ul}>
        <li className={editorTheme.list?.listitem}>
          <strong className={editorTheme.text?.bold}>Rich text editing</strong>{" "}
          with Lexical
        </li>
        <li className={editorTheme.list?.listitem}>
          <strong className={editorTheme.text?.bold}>Real-time sync</strong>{" "}
          via Supabase
        </li>
        <li className={editorTheme.list?.listitem}>
          <strong className={editorTheme.text?.bold}>Nested pages</strong> with
          drag-and-drop
        </li>
      </ul>

      <blockquote className={editorTheme.quote}>
        Build something people want. — Paul Graham
      </blockquote>

      <h3 className={editorTheme.heading?.h3}>Code Example</h3>
      <pre className={editorTheme.code}>
        <code>
          <span className={editorTheme.codeHighlight?.keyword}>import</span>{" "}
          {"{ "}
          <span className={editorTheme.codeHighlight?.variable}>
            createClient
          </span>
          {" } "}
          <span className={editorTheme.codeHighlight?.keyword}>from</span>{" "}
          <span className={editorTheme.codeHighlight?.string}>
            &quot;@supabase/supabase-js&quot;
          </span>
        </code>
      </pre>

      <h3 className={editorTheme.heading?.h3}>Comparison Table</h3>
      <table className={editorTheme.table}>
        <thead>
          <tr className={editorTheme.tableRow}>
            <th className={editorTheme.tableCellHeader}>Tool</th>
            <th className={editorTheme.tableCellHeader}>Language</th>
            <th className={editorTheme.tableCellHeader}>License</th>
          </tr>
        </thead>
        <tbody>
          <tr className={editorTheme.tableRow}>
            <td className={editorTheme.tableCell}>Lexical</td>
            <td className={editorTheme.tableCell}>TypeScript</td>
            <td className={editorTheme.tableCell}>MIT</td>
          </tr>
          <tr className={editorTheme.tableRow}>
            <td className={editorTheme.tableCell}>ProseMirror</td>
            <td className={editorTheme.tableCell}>JavaScript</td>
            <td className={editorTheme.tableCell}>MIT</td>
          </tr>
        </tbody>
      </table>

      <hr className={editorTheme.horizontalRule} />

      <p className={editorTheme.paragraph}>
        For more details, see the{" "}
        <a href="#" className={editorTheme.link}>
          documentation
        </a>
        .
      </p>
    </div>
  ),
};

export const AutoLinks: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl space-y-1">
      <h2 className={editorTheme.heading?.h2}>Auto-linked URLs</h2>
      <p className={editorTheme.paragraph}>
        URLs typed in the editor are auto-linked:{" "}
        <a href="https://example.com" className={editorTheme.link}>
          https://example.com
        </a>
      </p>
      <p className={editorTheme.paragraph}>
        URLs with paths and query strings:{" "}
        <a
          href="https://example.com/docs?page=1#intro"
          className={editorTheme.link}
        >
          https://example.com/docs?page=1#intro
        </a>
      </p>
      <p className={editorTheme.paragraph}>
        Bare www URLs are also detected:{" "}
        <a href="https://www.example.com" className={editorTheme.link}>
          www.example.com
        </a>
      </p>
      <h2 className={editorTheme.heading?.h2}>Auto-linked emails</h2>
      <p className={editorTheme.paragraph}>
        Email addresses become mailto links:{" "}
        <a href="mailto:user@example.com" className={editorTheme.link}>
          user@example.com
        </a>
      </p>
      <h2 className={editorTheme.heading?.h2}>Mixed content</h2>
      <p className={editorTheme.paragraph}>
        Visit{" "}
        <a href="https://github.com" className={editorTheme.link}>
          https://github.com
        </a>{" "}
        or email{" "}
        <a href="mailto:support@example.com" className={editorTheme.link}>
          support@example.com
        </a>{" "}
        for help.
      </p>
    </div>
  ),
};
