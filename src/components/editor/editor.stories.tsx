import type { Meta, StoryObj } from "@storybook/react";

// The Editor component is the full Lexical editor with all plugins. It requires
// Supabase context, route params, and browser APIs — stories show the static
// visual output of the editor in different content states.

const meta: Meta = {
  title: "Editor/Editor",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

/** Empty editor — shows placeholder text. */
export const Empty: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl bg-background p-6">
      <div
        className="relative min-h-[200px] text-sm text-foreground outline-none"
        role="textbox"
        aria-multiline="true"
      >
        <p className="text-muted-foreground">
          Press &apos;/&apos; for commands, or start typing…
        </p>
      </div>
      <div className="mt-8 text-xs text-muted-foreground">0 words</div>
    </div>
  ),
};

/** Editor with rich content — headings, paragraphs, lists. */
export const WithContent: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl bg-background p-6">
      <div className="space-y-4 text-sm text-foreground">
        <h1 className="text-2xl font-bold">Project Overview</h1>
        <p>
          This document outlines the key goals and milestones for the project.
          Each section covers a different aspect of the implementation.
        </p>
        <h2 className="text-xl font-semibold">Goals</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Build a performant block editor</li>
          <li>Support nested pages and databases</li>
          <li>Enable real-time collaboration</li>
        </ul>
        <h2 className="text-xl font-semibold">Timeline</h2>
        <ol className="list-decimal space-y-1 pl-6">
          <li>Phase 1: Core editor (Q1)</li>
          <li>Phase 2: Database views (Q2)</li>
          <li>Phase 3: Collaboration (Q3)</li>
        </ol>
        <blockquote className="border-l-2 border-muted-foreground/30 pl-4 italic text-muted-foreground">
          Ship early, iterate often.
        </blockquote>
      </div>
      <div className="mt-8 text-xs text-muted-foreground">
        62 words · 1 min read
      </div>
    </div>
  ),
};

/** Editor with code block and callout. */
export const WithCodeAndCallout: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl bg-background p-6">
      <div className="space-y-4 text-sm text-foreground">
        <h2 className="text-xl font-semibold">Setup Instructions</h2>
        <p>Clone the repository and install dependencies:</p>
        <pre className="rounded-sm bg-muted p-3 text-sm">
          <code>
            git clone https://github.com/example/repo.git{"\n"}
            cd repo{"\n"}
            pnpm install
          </code>
        </pre>
        <div className="flex gap-3 rounded-sm border border-accent/30 bg-accent/5 p-4">
          <span className="text-lg leading-none">💡</span>
          <div className="flex-1 text-sm text-foreground">
            Make sure you have Node.js 22 or higher installed before running
            the install command.
          </div>
        </div>
      </div>
      <div className="mt-8 text-xs text-muted-foreground">
        35 words · 1 min read
      </div>
    </div>
  ),
};

/** Editor with a checklist. */
export const WithChecklist: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl bg-background p-6">
      <div className="space-y-4 text-sm text-foreground">
        <h2 className="text-xl font-semibold">Launch Checklist</h2>
        <div className="space-y-2">
          {[
            { checked: true, text: "Write documentation" },
            { checked: true, text: "Add unit tests" },
            { checked: false, text: "Run E2E tests" },
            { checked: false, text: "Deploy to staging" },
            { checked: false, text: "Get sign-off from team" },
          ].map((item) => (
            <label
              key={item.text}
              className="flex items-center gap-2"
            >
              <input
                type="checkbox"
                defaultChecked={item.checked}
                className="h-4 w-4 rounded border-muted-foreground/30"
              />
              <span
                className={
                  item.checked
                    ? "text-muted-foreground line-through"
                    : "text-foreground"
                }
              >
                {item.text}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="mt-8 text-xs text-muted-foreground">
        16 words · 1 min read
      </div>
    </div>
  ),
};
