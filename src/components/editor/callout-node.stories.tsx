import type { Meta, StoryObj } from "@storybook/react";
import type { CalloutVariant } from "./callout-node";

// ---------------------------------------------------------------------------
// Static mock of CalloutNode for Storybook (no Lexical runtime)
// Mirrors the DOM structure and classes from CalloutNode.createDOM().
// ---------------------------------------------------------------------------

const VARIANT_CLASSES: Record<CalloutVariant, string> = {
  info: "border-l-accent bg-muted",
  warning: "border-l-code-type bg-muted",
  success: "border-l-code-string bg-muted",
  error: "border-l-destructive bg-muted",
};

const VARIANT_LABELS: Record<CalloutVariant, string> = {
  info: "Info callout",
  warning: "Warning callout",
  success: "Success callout",
  error: "Error callout",
};

const BASE_CLASSES = "mt-3 flex gap-3 border-l-2 p-4 text-sm";

interface CalloutMockProps {
  emoji: string;
  variant: CalloutVariant;
  children: React.ReactNode;
}

function CalloutMock({ emoji, variant, children }: CalloutMockProps) {
  return (
    <div
      className={`${BASE_CLASSES} ${VARIANT_CLASSES[variant]}`}
      role="note"
      aria-label={VARIANT_LABELS[variant]}
    >
      <span
        className="callout-emoji select-none text-lg shrink-0"
        aria-hidden="true"
      >
        {emoji}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Storybook meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof CalloutMock> = {
  title: "Editor/Callout",
  component: CalloutMock,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl bg-background p-6 text-foreground">
        <p className="text-sm">Some editor content above the callout block.</p>
        <Story />
        <p className="text-sm mt-2">
          More editor content below the callout block.
        </p>
      </div>
    ),
  ],
};

export { meta as default };
type Story = StoryObj<typeof CalloutMock>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  args: {
    emoji: "💡",
    variant: "info",
    children: "This is an informational callout with the default emoji and variant.",
  },
};

export const Info: Story = {
  args: {
    emoji: "💡",
    variant: "info",
    children: "Tip: You can use keyboard shortcuts to format text quickly.",
  },
};

export const Warning: Story = {
  args: {
    emoji: "⚠️",
    variant: "warning",
    children: "This action cannot be undone. Please proceed with caution.",
  },
};

export const Success: Story = {
  args: {
    emoji: "✅",
    variant: "success",
    children: "Your changes have been saved successfully.",
  },
};

export const Error: Story = {
  args: {
    emoji: "🚨",
    variant: "error",
    children: "Something went wrong. Please try again or contact support.",
  },
};

export const LongContent: Story = {
  args: {
    emoji: "📝",
    variant: "info",
    children:
      "This callout contains a much longer piece of text to demonstrate how the layout handles wrapping. When the content exceeds a single line, it should wrap naturally within the callout container while the emoji stays aligned to the top-left. The border-left indicator and background should extend to cover the full height of the content area regardless of how many lines the text spans.",
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-0">
      <CalloutMock emoji="💡" variant="info">
        Info — helpful tips and additional context.
      </CalloutMock>
      <CalloutMock emoji="⚠️" variant="warning">
        Warning — something to be aware of before proceeding.
      </CalloutMock>
      <CalloutMock emoji="✅" variant="success">
        Success — the operation completed as expected.
      </CalloutMock>
      <CalloutMock emoji="🚨" variant="error">
        Error — something went wrong and needs attention.
      </CalloutMock>
    </div>
  ),
};
