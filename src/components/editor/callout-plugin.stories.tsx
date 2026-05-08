import type { Meta, StoryObj } from "@storybook/react";

// The CalloutPlugin registers the INSERT_CALLOUT_COMMAND and handles inserting
// CalloutNode into the editor. It returns null — stories show the callout node
// visual output (already covered by callout-node.stories.tsx). This file
// documents the plugin's command interface.

const meta: Meta = {
  title: "Editor/CalloutPlugin",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

function StaticCallout({
  emoji,
  variant,
  children,
}: {
  emoji: string;
  variant: "info" | "warning" | "error" | "success";
  children: React.ReactNode;
}) {
  const variantClasses: Record<string, string> = {
    info: "border-accent/30 bg-accent/5",
    warning: "border-yellow-500/30 bg-yellow-500/5",
    error: "border-destructive/30 bg-destructive/5",
    success: "border-green-500/30 bg-green-500/5",
  };

  return (
    <div
      className={`mx-auto max-w-2xl flex gap-3 rounded-sm border p-4 ${variantClasses[variant]}`}
    >
      <span className="text-lg leading-none">{emoji}</span>
      <div className="flex-1 text-sm text-foreground">{children}</div>
    </div>
  );
}

/** Default callout inserted via slash command — info variant with lightbulb emoji. */
export const DefaultInsert: Story = {
  render: () => (
    <StaticCallout emoji="💡" variant="info">
      Type your callout content here. Callouts are inserted via the{" "}
      <code className="rounded bg-muted px-1 text-xs">/callout</code> slash
      command.
    </StaticCallout>
  ),
};

/** Warning variant callout. */
export const WarningVariant: Story = {
  render: () => (
    <StaticCallout emoji="⚠️" variant="warning">
      This is a warning callout. Use it to highlight important caveats.
    </StaticCallout>
  ),
};

/** Error variant callout. */
export const ErrorVariant: Story = {
  render: () => (
    <StaticCallout emoji="🚨" variant="error">
      This is an error callout. Use it for critical information.
    </StaticCallout>
  ),
};

/** Success variant callout. */
export const SuccessVariant: Story = {
  render: () => (
    <StaticCallout emoji="✅" variant="success">
      This is a success callout. Use it for positive confirmations.
    </StaticCallout>
  ),
};
