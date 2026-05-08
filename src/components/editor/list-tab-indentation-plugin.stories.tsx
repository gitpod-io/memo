import type { Meta, StoryObj } from "@storybook/react";

// The ListTabIndentationPlugin handles Tab/Shift+Tab for list item nesting.
// It returns null — stories show the visual result of indented/outdented lists.

const meta: Meta = {
  title: "Editor/ListTabIndentationPlugin",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

/** Flat list — no indentation applied. */
export const FlatList: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl text-sm text-foreground">
      <ul className="list-disc space-y-1 pl-6">
        <li>First item</li>
        <li>Second item</li>
        <li>Third item</li>
      </ul>
    </div>
  ),
};

/** Nested list — Tab pressed to indent items. */
export const NestedList: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl text-sm text-foreground">
      <ul className="list-disc space-y-1 pl-6">
        <li>First item</li>
        <li>
          Second item
          <ul className="list-disc space-y-1 pl-6 mt-1">
            <li>Nested item (Tab pressed)</li>
            <li>
              Another nested item
              <ul className="list-disc space-y-1 pl-6 mt-1">
                <li>Deeply nested (Tab pressed twice)</li>
              </ul>
            </li>
          </ul>
        </li>
        <li>Third item (back to top level)</li>
      </ul>
    </div>
  ),
};

/** Numbered list with nesting. */
export const NestedNumberedList: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl text-sm text-foreground">
      <ol className="list-decimal space-y-1 pl-6">
        <li>First item</li>
        <li>
          Second item
          <ol className="list-decimal space-y-1 pl-6 mt-1">
            <li>Sub-item A</li>
            <li>Sub-item B</li>
          </ol>
        </li>
        <li>Third item</li>
      </ol>
    </div>
  ),
};

/** Maximum nesting depth (7 levels). */
export const MaxDepth: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl text-sm text-foreground">
      <ul className="list-disc space-y-1 pl-6">
        <li>
          Level 1
          <ul className="list-disc pl-6 mt-1">
            <li>
              Level 2
              <ul className="list-disc pl-6 mt-1">
                <li>
                  Level 3
                  <ul className="list-disc pl-6 mt-1">
                    <li>
                      Level 4
                      <ul className="list-disc pl-6 mt-1">
                        <li>
                          Level 5
                          <ul className="list-disc pl-6 mt-1">
                            <li>
                              Level 6
                              <ul className="list-disc pl-6 mt-1">
                                <li>Level 7 (max depth)</li>
                              </ul>
                            </li>
                          </ul>
                        </li>
                      </ul>
                    </li>
                  </ul>
                </li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
    </div>
  ),
};
