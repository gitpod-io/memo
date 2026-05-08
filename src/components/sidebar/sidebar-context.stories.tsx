import type { Meta, StoryObj } from "@storybook/react";
import { PanelLeft, Search, Keyboard, Maximize2 } from "lucide-react";

// SidebarContext provides sidebar state (open/closed, mobile detection,
// keyboard shortcuts, focus mode) via React context. It has no visual output
// of its own — stories document the context values and keyboard shortcuts.

const meta: Meta = {
  title: "Sidebar/SidebarContext",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

function ShortcutKey({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {keys.map((key, i) => (
        <kbd
          key={`${key}-${i}`}
          className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-overlay-border bg-muted px-1 text-xs font-mono text-muted-foreground"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

/** Context values and keyboard shortcuts provided by SidebarProvider. */
export const ContextValues: Story = {
  render: () => (
    <div className="mx-auto max-w-md space-y-6">
      <div className="rounded-sm border border-overlay-border bg-popover p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">
          Context values
        </h3>
        <div className="space-y-2 text-sm">
          {[
            { label: "open", value: "boolean", desc: "Sidebar visibility" },
            { label: "isMobile", value: "boolean", desc: "Below 768px breakpoint" },
            { label: "isMac", value: "boolean", desc: "macOS platform detection" },
            { label: "focusMode", value: "boolean", desc: "Distraction-free mode" },
            { label: "shortcutsOpen", value: "boolean", desc: "Shortcuts dialog state" },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                {item.label}
              </code>
              <span className="text-xs text-muted-foreground">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-sm border border-overlay-border bg-popover p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">
          Keyboard shortcuts
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <PanelLeft className="h-4 w-4 text-muted-foreground" />
              Toggle sidebar
            </div>
            <ShortcutKey keys={["⌘", "\\"]} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Search className="h-4 w-4 text-muted-foreground" />
              Focus search
            </div>
            <ShortcutKey keys={["⌘", "K"]} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Maximize2 className="h-4 w-4 text-muted-foreground" />
              Toggle focus mode
            </div>
            <ShortcutKey keys={["⌘", "⇧", "F"]} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Keyboard className="h-4 w-4 text-muted-foreground" />
              Keyboard shortcuts
            </div>
            <ShortcutKey keys={["?"]} />
          </div>
        </div>
      </div>
    </div>
  ),
};

/** Focus mode active — sidebar hidden, content centered. */
export const FocusModeActive: Story = {
  render: () => (
    <div className="h-[400px] overflow-hidden bg-background">
      <main className="flex h-full items-start justify-center overflow-y-auto p-6">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold text-foreground">
            Focus Mode Active
          </h1>
          <p className="mt-4 text-sm text-foreground">
            The sidebar is hidden and the content area takes the full width.
            Press <ShortcutKey keys={["⌘", "⇧", "F"]} /> or{" "}
            <ShortcutKey keys={["Esc"]} /> to exit focus mode.
          </p>
        </div>
      </main>
      {/* Focus mode hint */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-sm border border-overlay-border bg-popover px-3 py-1.5 text-xs text-muted-foreground shadow-md">
        Press <ShortcutKey keys={["Esc"]} /> to exit focus mode
      </div>
    </div>
  ),
};

/** Mobile state — sidebar renders as a sheet overlay. */
export const MobileState: Story = {
  render: () => (
    <div className="mx-auto max-w-md">
      <div className="rounded-sm border border-overlay-border bg-popover p-4">
        <h3 className="text-sm font-medium text-foreground mb-2">
          Mobile behavior
        </h3>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>• Sidebar renders as a Sheet overlay (not inline)</li>
          <li>• Closes automatically on route change</li>
          <li>• Opens via hamburger menu in the header</li>
          <li>• Breakpoint: 768px</li>
        </ul>
      </div>
    </div>
  ),
};
