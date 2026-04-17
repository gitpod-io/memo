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

  return (
    <EmojiPicker
      open={open}
      onOpenChange={setOpen}
      onSelect={handleSelect}
      onRemove={handleRemove}
      hasIcon={icon !== null}
    >
      <button
        className="flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground hover:bg-white/[0.04]"
        aria-label={icon ? `Page icon: ${icon}. Click to change` : "Add page icon"}
      >
        {icon ? (
          <span className="text-2xl leading-none">{icon}</span>
        ) : (
          <SmilePlus className="h-5 w-5 opacity-0 group-hover/page-icon:opacity-100" />
        )}
      </button>
    </EmojiPicker>
  );
}
