import type { Meta, StoryObj } from "@storybook/react";

// The AutoLinkPlugin detects URLs and email addresses in text and converts them
// to clickable links. It requires Lexical context — stories show the visual
// result of auto-linked text.

const meta: Meta = {
  title: "Editor/AutoLinkPlugin",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

function StaticAutoLinkedText({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl text-sm text-foreground leading-relaxed">
      {children}
    </div>
  );
}

/** URL automatically converted to a clickable link. */
export const UrlDetected: Story = {
  render: () => (
    <StaticAutoLinkedText>
      Check out{" "}
      <a
        href="https://example.com"
        className="text-accent underline decoration-accent/50 underline-offset-2"
      >
        https://example.com
      </a>{" "}
      for more details.
    </StaticAutoLinkedText>
  ),
};

/** Email address automatically converted to a mailto link. */
export const EmailDetected: Story = {
  render: () => (
    <StaticAutoLinkedText>
      Contact us at{" "}
      <a
        href="mailto:hello@example.com"
        className="text-accent underline decoration-accent/50 underline-offset-2"
      >
        hello@example.com
      </a>{" "}
      for support.
    </StaticAutoLinkedText>
  ),
};

/** URL without protocol prefix — auto-linked with https:// added. */
export const UrlWithoutProtocol: Story = {
  render: () => (
    <StaticAutoLinkedText>
      Visit{" "}
      <a
        href="https://www.example.com"
        className="text-accent underline decoration-accent/50 underline-offset-2"
      >
        www.example.com
      </a>{" "}
      to learn more.
    </StaticAutoLinkedText>
  ),
};

/** Multiple links detected in the same paragraph. */
export const MultipleLinks: Story = {
  render: () => (
    <StaticAutoLinkedText>
      See{" "}
      <a
        href="https://docs.example.com"
        className="text-accent underline decoration-accent/50 underline-offset-2"
      >
        https://docs.example.com
      </a>{" "}
      and email{" "}
      <a
        href="mailto:team@example.com"
        className="text-accent underline decoration-accent/50 underline-offset-2"
      >
        team@example.com
      </a>{" "}
      for help.
    </StaticAutoLinkedText>
  ),
};
