"use client";

import { useCallback, useRef, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "@/lib/toast";
import type { FeedbackType } from "@/lib/types";

const MAX_MESSAGE_LENGTH = 500;

const FEEDBACK_TYPES: { value: FeedbackType; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "general", label: "General" },
];

interface FeedbackFormProps {
  /** Override for Storybook — when true, the sheet is open */
  defaultOpen?: boolean;
}

export function FeedbackForm({ defaultOpen = false }: FeedbackFormProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <Button
        variant="ghost"
        className="w-full justify-start gap-2 px-2"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <MessageSquarePlus className="h-4 w-4 shrink-0" />
        <span className="truncate text-sm">Feedback</span>
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex flex-col sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Send feedback</SheetTitle>
            <SheetDescription>
              Help us improve Memo. Your feedback is anonymous to other users.
            </SheetDescription>
          </SheetHeader>
          <FeedbackFormContent onClose={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

interface FeedbackFormContentProps {
  onClose: () => void;
  /** Override initial type for Storybook */
  initialType?: FeedbackType;
  /** Override initial message for Storybook */
  initialMessage?: string;
}

export function FeedbackFormContent({
  onClose,
  initialType = "general",
  initialMessage = "",
}: FeedbackFormContentProps) {
  const [type, setType] = useState<FeedbackType>(initialType);
  const [message, setMessage] = useState(initialMessage);
  const [includePageTitle, setIncludePageTitle] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = message.length;
  const atLimit = charCount >= MAX_MESSAGE_LENGTH;
  const nearLimit = charCount >= MAX_MESSAGE_LENGTH - 50;
  const isValid = message.trim().length > 0 && charCount <= MAX_MESSAGE_LENGTH;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isValid || submitting) return;

      setSubmitting(true);

      const payload = {
        type,
        message: message.trim(),
        page_path:
          typeof window !== "undefined" ? window.location.pathname : null,
        page_title:
          includePageTitle && typeof document !== "undefined"
            ? document.title
            : null,
        metadata: {
          user_agent:
            typeof navigator !== "undefined" ? navigator.userAgent : null,
          viewport:
            typeof window !== "undefined"
              ? { width: window.innerWidth, height: window.innerHeight }
              : null,
        },
      };

      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(data?.error ?? "Failed to submit feedback");
        }

        toast.success("Feedback submitted — thank you", { duration: 4000 });
        setType("general");
        setMessage("");
        setIncludePageTitle(true);
        onClose();
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to submit feedback";
        toast.error(errorMessage, { duration: 8000 });
      } finally {
        setSubmitting(false);
      }
    },
    [type, message, includePageTitle, isValid, submitting, onClose],
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-3 p-4">
      {/* Type selector */}
      <div className="flex flex-col gap-1.5">
        <Label>Type</Label>
        <div className="flex gap-1">
          {FEEDBACK_TYPES.map((ft) => (
            <Button
              key={ft.value}
              type="button"
              variant={type === ft.value ? "secondary" : "ghost"}
              size="sm"
              className={
                type === ft.value
                  ? "flex-1 bg-muted text-foreground"
                  : "flex-1 text-muted-foreground"
              }
              onClick={() => setType(ft.value)}
              aria-pressed={type === ft.value}
            >
              {ft.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Message textarea */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="feedback-message">Message</Label>
        <Textarea
          ref={textareaRef}
          id="feedback-message"
          placeholder="What's on your mind?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={MAX_MESSAGE_LENGTH}
          rows={5}
          className="resize-none"
          required
          aria-describedby="feedback-char-count"
        />
        <div
          id="feedback-char-count"
          className={`text-xs text-right ${
            atLimit
              ? "text-destructive"
              : nearLimit
                ? "text-muted-foreground"
                : "text-muted-foreground"
          }`}
        >
          {charCount}/{MAX_MESSAGE_LENGTH}
        </div>
      </div>

      {/* Include page title checkbox */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="include-page-title"
          checked={includePageTitle}
          onCheckedChange={(checked) => setIncludePageTitle(checked)}
        />
        <Label htmlFor="include-page-title" className="cursor-pointer">
          Include page title
        </Label>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={!isValid || submitting}
        className="mt-auto"
      >
        {submitting ? "Submitting…" : "Submit feedback"}
      </Button>
    </form>
  );
}
