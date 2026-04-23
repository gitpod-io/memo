"use client";

import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { createPortal } from "react-dom";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $isCodeNode,
  CODE_LANGUAGE_FRIENDLY_NAME_MAP,
  normalizeCodeLang,
  getLanguageFriendlyName,
} from "@lexical/code";
import {
  $getSelection,
  $isRangeSelection,
  $getNodeByKey,
  type NodeKey,
} from "lexical";
import { $findMatchingParent } from "@lexical/utils";
import { ChevronDown } from "lucide-react";

/**
 * Curated list of languages shown in the selector.
 * Keys are the normalized Prism language identifiers used by @lexical/code.
 */
const LANGUAGE_OPTIONS: ReadonlyArray<{ value: string; label: string }> =
  Object.entries(CODE_LANGUAGE_FRIENDLY_NAME_MAP)
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

function LanguageDropdown({
  language,
  onSelect,
}: {
  language: string;
  onSelect: (lang: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const friendlyName = getLanguageFriendlyName(language) || "Plain Text";

  const close = useCallback(() => {
    setIsOpen(false);
    setFocusedIndex(-1);
  }, []);

  // Close on click outside or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        event.target instanceof Node &&
        !dropdownRef.current.contains(event.target)
      ) {
        close();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, close]);

  // Scroll focused item into view
  useEffect(() => {
    if (!isOpen || focusedIndex < 0) return;
    const list = listRef.current;
    if (!list) return;
    const items = list.querySelectorAll("[role='option']");
    const item = items[focusedIndex];
    if (item) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [isOpen, focusedIndex]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isOpen) {
        if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
          event.preventDefault();
          setIsOpen(true);
          // Focus the currently selected language
          const currentIndex = LANGUAGE_OPTIONS.findIndex(
            (opt) => opt.value === language
          );
          setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
        }
        return;
      }

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setFocusedIndex((prev) =>
            prev < LANGUAGE_OPTIONS.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          event.preventDefault();
          setFocusedIndex((prev) =>
            prev > 0 ? prev - 1 : LANGUAGE_OPTIONS.length - 1
          );
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < LANGUAGE_OPTIONS.length) {
            onSelect(LANGUAGE_OPTIONS[focusedIndex].value);
            close();
            triggerRef.current?.focus();
          }
          break;
        case "Home":
          event.preventDefault();
          setFocusedIndex(0);
          break;
        case "End":
          event.preventDefault();
          setFocusedIndex(LANGUAGE_OPTIONS.length - 1);
          break;
      }
    },
    [isOpen, focusedIndex, language, onSelect, close]
  );

  return (
    <div
      ref={dropdownRef}
      className="absolute right-2 top-2 z-10"
      contentEditable={false}
    >
      <button
        ref={triggerRef}
        type="button"
        className="flex items-center gap-1 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-overlay-hover rounded-sm transition-none"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
          if (!isOpen) {
            const currentIndex = LANGUAGE_OPTIONS.findIndex(
              (opt) => opt.value === language
            );
            setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
          }
        }}
        onMouseDown={(e) => e.preventDefault()}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Code language: ${friendlyName}`}
      >
        {friendlyName}
        <ChevronDown className="h-3 w-3" />
      </button>
      {isOpen && (
        <div
          ref={listRef}
          role="listbox"
          aria-label="Select language"
          className="absolute right-0 top-full mt-1 max-h-60 w-40 overflow-y-auto rounded-sm border border-overlay-border bg-popover p-1 shadow-md"
        >
          {LANGUAGE_OPTIONS.map((opt, index) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === language}
              className={`flex w-full items-center px-2 py-1 text-left text-xs ${
                opt.value === language
                  ? "text-foreground bg-overlay-active"
                  : focusedIndex === index
                    ? "text-foreground bg-overlay-hover"
                    : "text-muted-foreground hover:bg-overlay-hover hover:text-foreground"
              }`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(opt.value);
                close();
              }}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setFocusedIndex(index)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CodeLanguageSelectorPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [activeCodeKey, setActiveCodeKey] = useState<NodeKey | null>(null);
  const [language, setLanguage] = useState<string>("");

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          setActiveCodeKey(null);
          return;
        }

        const anchorNode = selection.anchor.getNode();
        const codeNode = $isCodeNode(anchorNode)
          ? anchorNode
          : $findMatchingParent(anchorNode, $isCodeNode);

        if (codeNode) {
          setActiveCodeKey(codeNode.getKey());
          setLanguage(codeNode.getLanguage() || "plain");
        } else {
          setActiveCodeKey(null);
        }
      });
    });
  }, [editor]);

  const handleLanguageSelect = useCallback(
    (lang: string) => {
      if (!activeCodeKey) return;
      editor.update(() => {
        const node = $getNodeByKey(activeCodeKey);
        if ($isCodeNode(node)) {
          const normalized = normalizeCodeLang(lang);
          node.setLanguage(normalized || lang);
        }
      });
      setLanguage(lang);
    },
    [editor, activeCodeKey]
  );

  if (!activeCodeKey) return null;

  const codeDom = editor.getElementByKey(activeCodeKey);
  if (!codeDom) return null;

  return createPortal(
    <LanguageDropdown language={language} onSelect={handleLanguageSelect} />,
    codeDom
  );
}
