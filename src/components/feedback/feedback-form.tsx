"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, MessageSquarePlus, X } from "lucide-react";
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
import { useScreenshot, uploadScreenshot } from "@/lib/use-screenshot";
import { createClient } from "@/lib/supabase/client";
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
          <FeedbackFormContent onClose={() => setOpen(false)} isOpen={open} />
        </SheetContent>
      </Sheet>
    </>
  );
}

interface FeedbackFormContentProps {
  onClose: () => void;
  /** Whether the form sheet is open — triggers screenshot capture */
  isOpen?: boolean;
  /** Override initial type for Storybook */
  initialType?: FeedbackType;
  /** Override initial message for Storybook */
  initialMessage?: string;
  /** Override screenshot data URL for Storybook */
  initialScreenshot?: string | null;
  /** Override screenshot loading state for Storybook */
  initialScreenshotLoading?: boolean;
}

export function FeedbackFormContent({
  onClose,
  isOpen = false,
  initialType = "general",
  initialMessage = "",
  initialScreenshot,
  initialScreenshotLoading,
}: FeedbackFormContentProps) {
  const [type, setType] = useState<FeedbackType>(initialType);
  const [message, setMessage] = useState(initialMessage);
  const [includePageTitle, setIncludePageTitle] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const screenshot = useScreenshot(isOpen);

  // Allow Storybook overrides
  const screenshotDataUrl =
    initialScreenshot !== undefined ? initialScreenshot : screenshot.dataUrl;
  const screenshotLoading =
    initialScreenshotLoading !== undefined
      ? initialScreenshotLoading
      : screenshot.loading;

  const charCount = message.length;
  const atLimit = charCount >= MAX_MESSAGE_LENGTH;
  const nearLimit = charCount >= MAX_MESSAGE_LENGTH - 50;
  const isValid = message.trim().length > 0 && charCount <= MAX_MESSAGE_LENGTH;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isValid || submitting) return;

      setSubmitting(true);

      // Upload screenshot if present
      let screenshotUrl: string | null = null;
      const blob = screenshot.toBlob();
      if (blob) {
        try {
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            screenshotUrl = await uploadScreenshot(blob, user.id);
            if (!screenshotUrl) {
              toast.error("Screenshot upload failed — submitting without it", {
                duration: 8000,
              });
            }
          }
        } catch (_uploadErr) {
          toast.error("Screenshot upload failed — submitting without it", {
            duration: 8000,
          });
        }
      }

      const payload = {
        type,
        message: message.trim(),
        page_path:
          typeof window !== "undefined" ? window.location.pathname : null,
        page_title:
          includePageTitle && typeof document !== "undefined"
            ? document.title
            : null,
        screenshot_url: screenshotUrl,
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
    [
      type,
      message,
      includePageTitle,
      isValid,
      submitting,
      onClose,
      screenshot,
    ],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        screenshot.replaceWithFile(file);
      }
      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [screenshot],
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

      {/* Screenshot section */}
      <div className="flex flex-col gap-1.5">
        <Label>Screenshot</Label>
        {screenshotLoading ? (
          <div className="h-20 animate-pulse border border-white/[0.06] bg-muted" />
        ) : screenshotDataUrl ? (
          <div className="group relative inline-block">
            <img
              src={screenshotDataUrl}
              alt="Screenshot preview"
              className="h-20 w-auto border border-white/[0.06] object-cover"
            />
            <button
              type="button"
              onClick={screenshot.remove}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center bg-destructive text-destructive-foreground opacity-0 transition-opacity before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] group-hover:opacity-100"
              aria-label="Remove screenshot"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-20 items-center justify-center gap-2 border border-dashed border-white/[0.06] text-muted-foreground transition-colors hover:border-white/[0.12] hover:text-foreground"
          >
            <ImagePlus className="h-4 w-4" />
            <span className="text-xs">Upload screenshot</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload screenshot"
        />
        {screenshotDataUrl && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="self-start text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Replace image
          </button>
        )}
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
