"use client";

import type { JSX, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  KEY_ESCAPE_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import {
  $isLinkNode,
  $toggleLink,
  LinkNode,
  TOGGLE_LINK_COMMAND,
} from "@lexical/link";
import { mergeRegister } from "@lexical/utils";
import { computePosition, offset, flip, shift } from "@floating-ui/react";
import { Check, ExternalLink, Pencil, Trash2, X } from "lucide-react";

interface FloatingLinkEditorPluginProps {
  anchorElem: HTMLElement;
}

function getSelectedLinkNode(): LinkNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;

  const node = selection.anchor.getNode();
  const parent = node.getParent();

  if ($isLinkNode(parent)) return parent;
  if ($isLinkNode(node)) return node;
  return null;
}

export function FloatingLinkEditorPlugin({
  anchorElem,
}: FloatingLinkEditorPluginProps): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const editorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [editedUrl, setEditedUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [linkDomNode, setLinkDomNode] = useState<HTMLElement | null>(null);

  const updateLinkEditor = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      setIsVisible(false);
      return;
    }

    const linkNode = getSelectedLinkNode();
    if (!linkNode) {
      setIsVisible(false);
      setIsEditing(false);
      return;
    }

    const url = linkNode.getURL();
    setLinkUrl(url);
    setEditedUrl(url);

    const domNode = editor.getElementByKey(linkNode.getKey());
    setLinkDomNode(domNode);
    setIsVisible(true);
  }, [editor]);

  const updatePosition = useCallback(() => {
    const editorElem = editorRef.current;
    if (!editorElem || !isVisible || !linkDomNode) return;

    const virtualEl = {
      getBoundingClientRect: () => linkDomNode.getBoundingClientRect(),
    };

    computePosition(virtualEl, editorElem, {
      placement: "bottom-start",
      middleware: [offset(4), flip(), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      editorElem.style.left = `${x}px`;
      editorElem.style.top = `${y}px`;
    });
  }, [isVisible, linkDomNode]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateLinkEditor();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateLinkEditor();
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          if (isVisible) {
            setIsVisible(false);
            setIsEditing(false);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH
      )
    );
  }, [editor, updateLinkEditor, isVisible]);

  useEffect(() => {
    updatePosition();
  }, [isVisible, linkDomNode, updatePosition]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    if (editedUrl.trim()) {
      // Wrap in editor.update() so the LinkPlugin command listener runs in a
      // writable context. Without this, if dispatchCommand fires while an
      // editorState.read() is active (e.g. from the update listener),
      // $toggleLink's mutations hit Lexical's read-only guard.
      editor.update(() => {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, editedUrl.trim());
      });
    }
    setIsEditing(false);
  }, [editor, editedUrl]);

  const handleRemove = useCallback(() => {
    editor.update(() => {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    });
    setIsVisible(false);
    setIsEditing(false);
  }, [editor]);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsEditing(false);
        setEditedUrl(linkUrl);
      }
    },
    [handleSave, linkUrl]
  );

  // Register ⌘+K shortcut to open link editor
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        editor.update(() => {
          const linkNode = getSelectedLinkNode();
          if (linkNode) {
            setIsEditing(true);
          } else {
            const selection = $getSelection();
            if ($isRangeSelection(selection) && !selection.isCollapsed()) {
              $toggleLink("https://");
              // After the link is created in this update, the update listener
              // will set isVisible. Use rAF to set editing after React renders.
              requestAnimationFrame(() => {
                setIsEditing(true);
              });
            }
          }
        });
      }
    };

    document.addEventListener("keydown", handleKeyboard);
    return () => document.removeEventListener("keydown", handleKeyboard);
  }, [editor]);

  if (!isVisible) return null;

  return createPortal(
    <div
      ref={editorRef}
      className="fixed z-50 flex items-center gap-1 border border-white/[0.06] bg-popover px-2 py-1.5 shadow-md rounded-sm"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {isEditing ? (
        <>
          <input
            ref={inputRef}
            type="url"
            value={editedUrl}
            onChange={(e) => setEditedUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-6 w-48 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Enter URL..."
          />
          <button
            type="button"
            className="flex h-11 w-11 sm:h-6 sm:w-6 items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={handleSave}
            aria-label="Save link"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="flex h-11 w-11 sm:h-6 sm:w-6 items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => {
              setIsEditing(false);
              setEditedUrl(linkUrl);
            }}
            aria-label="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <>
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="max-w-[200px] truncate text-xs text-accent hover:underline"
          >
            {linkUrl}
          </a>
          <button
            type="button"
            className="flex h-11 w-11 sm:h-6 sm:w-6 items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => window.open(linkUrl, "_blank", "noopener")}
            aria-label="Open link"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="flex h-11 w-11 sm:h-6 sm:w-6 items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => setIsEditing(true)}
            aria-label="Edit link"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="flex h-11 w-11 sm:h-6 sm:w-6 items-center justify-center text-destructive hover:text-destructive/80"
            onClick={handleRemove}
            aria-label="Remove link"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>,
    anchorElem
  );
}
