"use client";

import { useCallback, useState } from "react";
import { SmilePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { captureSupabaseError } from "@/lib/sentry";
import { EmojiPicker } from "@/components/emoji-picker";

interface PageIconProps {
  pageId: string;
  initialIcon: string | null;
}

export function PageIcon({ pageId, initialIcon }: PageIconProps) {
  const [icon, setIcon] = useState<string | null>(initialIcon);
  const [open, setOpen] = useState(false);

  const saveIcon = useCallback(
    async (value: string | null) => {
      setIcon(value);
      const supabase = createClient();
      const { error } = await supabase
        .from("pages")
        .update({ icon: value })
        .eq("id", pageId);

      if (error) {
        captureSupabaseError(error, "page.icon.save");
        // Revert on failure
        setIcon(initialIcon);
      }
    },
    [pageId, initialIcon]
  );

  const handleSelect = useCallback(
    (emoji: string) => {
      saveIcon(emoji);
    },
    [saveIcon]
  );

  const handleRemove = useCallback(() => {
    saveIcon(null);
  }, [saveIcon]);

  if (icon) {
    return (
      <div className="mb-2">
        <EmojiPicker
          open={open}
          onOpenChange={setOpen}
          onSelect={handleSelect}
          onRemove={handleRemove}
          hasIcon
        >
          <button
            className="flex min-h-11 min-w-11 items-center justify-center rounded-sm text-4xl leading-none hover:bg-white/[0.04] sm:min-h-10 sm:min-w-10"
            aria-label={`Page icon: ${icon}. Click to change`}
          >
            {icon}
          </button>
        </EmojiPicker>
      </div>
    );
  }

  return (
    <div className="mb-1 max-sm:opacity-100 opacity-0 group-hover/page-header:opacity-100">
      <EmojiPicker
        open={open}
        onOpenChange={setOpen}
        onSelect={handleSelect}
        onRemove={handleRemove}
        hasIcon={false}
      >
        <button
          className="flex min-h-11 items-center gap-1 rounded-sm px-1.5 text-xs text-muted-foreground hover:bg-white/[0.04] sm:min-h-7"
          aria-label="Add page icon"
        >
          <SmilePlus className="h-3.5 w-3.5" />
          <span>Add icon</span>
        </button>
      </EmojiPicker>
    </div>
  );
}
