import type { Meta, StoryObj } from "@storybook/react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

// FeedbackForm depends on fetch and sonner toast.
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

function FormShell({
  selectedType = "general",
  message = "",
  includeTitle = true,
  submitting = false,
}: {
  selectedType?: string;
  message?: string;
  includeTitle?: boolean;
  submitting?: boolean;
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
      submitting
    />
  ),
};
