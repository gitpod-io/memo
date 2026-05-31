import type { Meta, StoryObj } from "@storybook/react";
import { List } from "lucide-react";

// ---------------------------------------------------------------------------
// Static mock of TableOfContentsComponent for Storybook (no Lexical context)
// ---------------------------------------------------------------------------

interface HeadingEntry {
  key: string;
  tag: "h1" | "h2" | "h3";
  text: string;
}

const INDENT: Record<string, string> = {
  h1: "",
  h2: "pl-4",
  h3: "pl-8",
};

interface TableOfContentsMockProps {
  headings: HeadingEntry[];
}

function TableOfContentsMock({ headings }: TableOfContentsMockProps) {
  if (headings.length === 0) {
    return (
      <div
        className="my-2 flex items-center gap-2 border border-overlay-border px-3 py-3 text-sm text-muted-foreground"
        data-testid="toc-empty"
      >
        <List className="h-4 w-4 shrink-0" />
        Add headings to see a table of contents
      </div>
    );
  }

  return (
    <div
      className="my-2 border border-overlay-border px-3 py-2"
      data-testid="toc-block"
    >
      <div className="mb-1 text-xs font-medium uppercase tracking-widest text-label-faint">
        Table of Contents
      </div>
      <nav aria-label="Table of contents">
        <ul className="space-y-0.5">
          {headings.map((entry) => (
            <li key={entry.key} className={INDENT[entry.tag]}>
              <button
                type="button"
                className="w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors py-0.5"
                data-testid={`toc-entry-${entry.tag}`}
              >
                {entry.text || "Untitled"}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Storybook meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof TableOfContentsMock> = {
  title: "Editor/TableOfContents",
  component: TableOfContentsMock,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl bg-background p-6 text-foreground">
        <p className="text-sm mb-2">
          Some editor content above the table of contents block.
        </p>
        <Story />
        <p className="text-sm mt-2">
          More editor content below the table of contents block.
        </p>
      </div>
    ),
  ],
};

export { meta as default };

type Story = StoryObj<typeof TableOfContentsMock>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  args: {
    headings: [
      { key: "1", tag: "h1", text: "Introduction" },
      { key: "2", tag: "h2", text: "Getting Started" },
      { key: "3", tag: "h3", text: "Prerequisites" },
      { key: "4", tag: "h3", text: "Installation" },
      { key: "5", tag: "h2", text: "Configuration" },
      { key: "6", tag: "h3", text: "Environment Variables" },
      { key: "7", tag: "h3", text: "Database Setup" },
      { key: "8", tag: "h1", text: "API Reference" },
      { key: "9", tag: "h2", text: "Authentication" },
      { key: "10", tag: "h2", text: "Endpoints" },
    ],
  },
};

export const Empty: Story = {
  args: {
    headings: [],
  },
};

export const SingleHeading: Story = {
  args: {
    headings: [{ key: "1", tag: "h1", text: "My Document" }],
  },
};

export const FlatH1Only: Story = {
  args: {
    headings: [
      { key: "1", tag: "h1", text: "Chapter 1" },
      { key: "2", tag: "h1", text: "Chapter 2" },
      { key: "3", tag: "h1", text: "Chapter 3" },
    ],
  },
};

export const DeeplyNested: Story = {
  args: {
    headings: [
      { key: "1", tag: "h1", text: "Project Overview" },
      { key: "2", tag: "h2", text: "Architecture" },
      { key: "3", tag: "h3", text: "Frontend" },
      { key: "4", tag: "h3", text: "Backend" },
      { key: "5", tag: "h3", text: "Database" },
      { key: "6", tag: "h2", text: "Deployment" },
      { key: "7", tag: "h3", text: "CI/CD Pipeline" },
      { key: "8", tag: "h3", text: "Infrastructure" },
      { key: "9", tag: "h1", text: "Contributing" },
      { key: "10", tag: "h2", text: "Code Style" },
      { key: "11", tag: "h2", text: "Pull Requests" },
    ],
  },
};
