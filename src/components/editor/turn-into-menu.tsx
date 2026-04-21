"use client";

import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import { mergeRegister } from "@lexical/utils";
import {
  $getActiveBlockType,
  getTargetOptions,
  TURN_INTO_COMMAND,
  type BlockType,
  type TurnIntoOption,
} from "@/components/editor/turn-into-plugin";

interface TurnIntoMenuProps {
  /** Called after a transformation is applied so the parent can close. */
  onClose: () => void;
  /** Additional CSS class for positioning. */
  className?: string;
}

export function TurnIntoMenu({
  onClose,
  className = "",
}: TurnIntoMenuProps): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [activeType, setActiveType] = useState<BlockType | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Detect the current block type
  useEffect(() => {
    const update = () => {
      editor.read(() => {
        const type = $getActiveBlockType();
        setActiveType(type);
      });
    };
    update();
    return mergeRegister(
      editor.registerUpdateListener(() => update()),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          update();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor]);

  const options = useMemo(
    () => (activeType ? getTargetOptions(activeType) : []),
    [activeType],
  );

  const handleSelect = useCallback(
    (option: TurnIntoOption) => {
      editor.update(() => {
        editor.dispatchCommand(TURN_INTO_COMMAND, {
          targetType: option.type,
        });
      });
      onClose();
    },
    [editor, onClose],
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (options.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < options.length - 1 ? prev + 1 : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : options.length - 1,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSelect(options[highlightedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [options, highlightedIndex, handleSelect, onClose]);

  // Reset highlighted index when the active block type changes.
  // Derived state: track which activeType the current index belongs to,
  // and reset when it diverges — avoids setState-in-effect.
  const [highlightedForType, setHighlightedForType] = useState(activeType);
  if (highlightedForType !== activeType) {
    setHighlightedForType(activeType);
    setHighlightedIndex(0);
  }

  // Scroll highlighted item into view
  useEffect(() => {
    const container = menuRef.current;
    if (!container) return;
    const item = container.children[highlightedIndex];
    if (item instanceof HTMLElement) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  if (options.length === 0) {
    return (
      <div
        className={`max-h-[300px] w-56 overflow-y-auto rounded-sm border border-white/[0.06] bg-popover p-1 shadow-md ${className}`}
      >
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          No transformations available
        </div>
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className={`max-h-[300px] w-56 overflow-y-auto rounded-sm border border-white/[0.06] bg-popover p-1 shadow-md ${className}`}
      role="listbox"
      aria-label="Turn into"
    >
      {options.map((option, index) => (
        <button
          key={option.type}
          type="button"
          className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm outline-none ${
            highlightedIndex === index
              ? "bg-white/[0.08] text-foreground"
              : "text-muted-foreground hover:bg-white/[0.04]"
          }`}
          onClick={() => handleSelect(option)}
          onMouseEnter={() => setHighlightedIndex(index)}
          role="option"
          aria-selected={highlightedIndex === index}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground">
            {option.icon}
          </span>
          <span className="text-sm font-medium text-foreground">
            {option.label}
          </span>
        </button>
      ))}
    </div>
  );
}
