"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  computePosition,
  offset,
  flip,
  shift,
  autoUpdate,
} from "@floating-ui/react";

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂",
      "🙂", "😊", "😇", "🥰", "😍", "🤩", "😘", "😎",
    ],
  },
  {
    label: "Gestures",
    emojis: [
      "👋", "🤚", "✋", "🖖", "👌", "🤌", "✌️", "🤞",
      "👍", "👎", "👏", "🙌", "🤝", "🙏", "💪", "🫶",
    ],
  },
  {
    label: "Objects",
    emojis: [
      "📄", "📝", "📋", "📌", "📎", "🔗", "📐", "📏",
      "📁", "📂", "🗂️", "📊", "📈", "📉", "🗒️", "🗓️",
    ],
  },
  {
    label: "Symbols",
    emojis: [
      "⭐", "🌟", "💡", "🔥", "❤️", "💎", "🎯", "🏆",
      "✅", "❌", "⚠️", "💬", "🔔", "🚀", "⚡", "🎉",
    ],
  },
  {
    label: "Nature",
    emojis: [
      "🌱", "🌿", "🍀", "🌸", "🌺", "🌻", "🌈", "☀️",
      "🌙", "⛅", "🌊", "🍎", "🍊", "🍋", "🫐", "🍇",
    ],
  },
  {
    label: "Animals",
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼",
      "🐸", "🐵", "🐔", "🐧", "🐦", "🦅", "🦋", "🐝",
    ],
  },
];

interface EmojiPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (emoji: string) => void;
  onRemove?: () => void;
  hasIcon: boolean;
  children: React.ReactElement;
}

export function EmojiPicker({
  open,
  onOpenChange,
  onSelect,
  onRemove,
  hasIcon,
  children,
}: EmojiPickerProps) {
  const [filter, setFilter] = useState("");
  const referenceRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);

  // Position the floating element
  useEffect(() => {
    if (!open) return;

    const reference = referenceRef.current;
    const floating = floatingRef.current;
    if (!reference || !floating) return;

    const cleanup = autoUpdate(reference, floating, () => {
      computePosition(reference, floating, {
        placement: "bottom-start",
        middleware: [offset(4), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        Object.assign(floating.style, {
          left: `${x}px`,
          top: `${y}px`,
        });
      }).catch(() => {
        // Position computation can fail if elements are removed during update
      });
    });

    return cleanup;
  }, [open]);

  // Focus filter input when opened
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => filterInputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;

    function handleMouseDown(e: MouseEvent) {
      const target = e.target;
      if (!(target instanceof Node)) return;

      const floating = floatingRef.current;
      const reference = referenceRef.current;
      if (
        floating && !floating.contains(target) &&
        reference && !reference.contains(target)
      ) {
        onOpenChange(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open, onOpenChange]);

  const handleSelect = useCallback(
    (emoji: string) => {
      onSelect(emoji);
      onOpenChange(false);
    },
    [onSelect, onOpenChange]
  );

  const handleRemove = useCallback(() => {
    onRemove?.();
    onOpenChange(false);
  }, [onRemove, onOpenChange]);

  const handleToggle = useCallback(() => {
    if (!open) {
      setFilter("");
    }
    onOpenChange(!open);
  }, [open, onOpenChange]);

  const filteredCategories = filter
    ? EMOJI_CATEGORIES.map((cat) => ({
        ...cat,
        emojis: cat.emojis.filter(() =>
          cat.label.toLowerCase().includes(filter.toLowerCase())
        ),
      })).filter((cat) => cat.emojis.length > 0)
    : EMOJI_CATEGORIES;

  return (
    <>
      <div ref={referenceRef} onClick={handleToggle}>
        {children}
      </div>
      {open && (
        <div
          ref={floatingRef}
          className="fixed z-50 w-[calc(100vw-16px)] rounded-sm border border-white/[0.06] bg-popover p-2 shadow-md sm:w-72"
          role="dialog"
          aria-label="Emoji picker"
        >
          <input
            ref={filterInputRef}
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter..."
            className="mb-2 h-9 w-full border border-white/[0.06] bg-muted px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
            aria-label="Filter emojis"
          />
          {hasIcon && onRemove && (
            <button
              onClick={handleRemove}
              className="mb-2 w-full px-2 py-1 text-left text-xs text-muted-foreground hover:bg-white/[0.04]"
            >
              Remove icon
            </button>
          )}
          <div className="max-h-60 overflow-y-auto">
            {filteredCategories.map((category) => (
              <div key={category.label}>
                <div className="px-1 py-1 text-xs tracking-widest uppercase text-white/30">
                  {category.label}
                </div>
                <div className="grid grid-cols-8 gap-0.5">
                  {category.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleSelect(emoji)}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center text-lg hover:bg-white/[0.04] sm:min-h-8 sm:min-w-8"
                      aria-label={`Select ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
