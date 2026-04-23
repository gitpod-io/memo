import type { Meta, StoryObj } from "@storybook/react";
import { ImagePlus, MessageSquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

// FeedbackForm depends on fetch, sonner toast, and html-to-image.
// These stories render the visual appearance with static data.

const meta: Meta = {
  title: "Feedback/FeedbackForm",
};

export { meta as default };

type Story = StoryObj;

const TYPES = [
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "general", label: "General" },
] as const;

// 1x1 blue PNG data URL for screenshot thumbnail previews in stories
const PLACEHOLDER_SCREENSHOT =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAAOklEQVR4nO3BAQEAAACCIP+vbkhAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB8GXHmAAFMqLKZAAAAAElFTkSuQmCC";

function TypeSelector({ selected }: { selected: string }) {
  return (
    <div className="flex gap-1">
      {TYPES.map((ft) => (
        <Button
          key={ft.value}
          type="button"
          variant={selected === ft.value ? "secondary" : "ghost"}
          size="sm"
          className={
            selected === ft.value
              ? "flex-1 bg-muted text-foreground"
              : "flex-1 text-muted-foreground"
          }
          aria-pressed={selected === ft.value}
        >
          {ft.label}
        </Button>
      ))}
    </div>
  );
}

function ScreenshotSection({
  screenshot,
  loading,
}: {
  screenshot: string | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="h-20 animate-pulse border border-overlay-border bg-muted" />
    );
  }

  if (screenshot) {
    return (
      <>
        <div className="group relative inline-block">
          <img
            src={screenshot}
            alt="Screenshot preview"
            className="h-20 w-auto border border-overlay-border object-cover"
          />
          <button
            type="button"
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center bg-destructive text-destructive-foreground opacity-100 before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
            aria-label="Remove screenshot"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <button
          type="button"
          className="self-start text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Replace image
        </button>
      </>
    );
  }

  return (
    <button
      type="button"
      className="flex h-20 items-center justify-center gap-2 border border-dashed border-overlay-border text-muted-foreground transition-colors hover:border-overlay-strong hover:text-foreground"
    >
      <ImagePlus className="h-4 w-4" />
      <span className="text-xs">Upload screenshot</span>
    </button>
  );
}

function FormShell({
  selectedType = "general",
  message = "",
  includeTitle = true,
  submitting = false,
  screenshot = null,
  screenshotLoading = false,
}: {
  selectedType?: string;
  message?: string;
  includeTitle?: boolean;
  submitting?: boolean;
  screenshot?: string | null;
  screenshotLoading?: boolean;
}) {
  const charCount = message.length;
  const atLimit = charCount >= 500;
  const isValid = message.trim().length > 0 && charCount <= 500;

  return (
    <div className="flex w-80 flex-col gap-3 bg-popover p-4">
      <div className="flex flex-col gap-0.5 pb-1">
        <p className="text-base font-medium text-foreground">Send feedback</p>
        <p className="text-sm text-muted-foreground">
          Help us improve Memo. Your feedback is anonymous to other users.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Type</Label>
        <TypeSelector selected={selectedType} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Message</Label>
        <Textarea
          placeholder="What's on your mind?"
          value={message}
          rows={5}
          className="resize-none"
          readOnly
        />
        <div
          className={`text-right text-xs ${
            atLimit ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {charCount}/500
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Screenshot</Label>
        <ScreenshotSection
          screenshot={screenshot}
          loading={screenshotLoading}
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox defaultChecked={includeTitle} />
        <Label className="cursor-pointer">Include page title</Label>
      </div>

      <Button disabled={!isValid || submitting}>
        {submitting ? "Submitting…" : "Submit feedback"}
      </Button>
    </div>
  );
}

/** Trigger button as it appears in the sidebar footer */
export const TriggerButton: Story = {
  render: () => (
    <div className="w-56 bg-muted p-2">
      <Button
        variant="ghost"
        className="w-full justify-start gap-2 px-2"
        size="sm"
      >
        <MessageSquarePlus className="h-4 w-4 shrink-0" />
        <span className="truncate text-sm">Feedback</span>
      </Button>
    </div>
  ),
};

/** Default empty form state with General type selected */
export const Default: Story = {
  render: () => <FormShell />,
};

/** Form with Bug type selected */
export const BugTypeSelected: Story = {
  render: () => <FormShell selectedType="bug" />,
};

/** Form with Feature type selected */
export const FeatureTypeSelected: Story = {
  render: () => <FormShell selectedType="feature" />,
};

/** Form with a screenshot thumbnail displayed */
export const WithScreenshot: Story = {
  render: () => (
    <FormShell
      message="The sidebar overlaps the editor on narrow viewports."
      selectedType="bug"
      screenshot={PLACEHOLDER_SCREENSHOT}
    />
  ),
};

/** Form without a screenshot — shows upload placeholder */
export const WithoutScreenshot: Story = {
  render: () => (
    <FormShell
      message="Would love a dark mode toggle."
      selectedType="feature"
      screenshot={null}
    />
  ),
};

/** Form while screenshot capture is in progress */
export const ScreenshotCapturing: Story = {
  render: () => (
    <FormShell
      message=""
      screenshotLoading
    />
  ),
};

/** Character counter near the 500-char limit */
export const NearCharacterLimit: Story = {
  render: () => (
    <FormShell
      message={"A".repeat(470)}
    />
  ),
};

/** Character counter at the 500-char limit — counter turns destructive */
export const AtCharacterLimit: Story = {
  render: () => (
    <FormShell
      message={"A".repeat(500)}
    />
  ),
};

/** Form in submitting state — button disabled with loading text */
export const Submitting: Story = {
  render: () => (
    <FormShell
      message="The editor crashes when I paste a large table from Google Sheets."
      selectedType="bug"
      screenshot={PLACEHOLDER_SCREENSHOT}
      submitting
    />
  ),
};
