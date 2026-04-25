"use client";

import type { JSX, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { mergeRegister } from "@lexical/utils";
import { computePosition, offset, flip, shift } from "@floating-ui/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link,
} from "lucide-react";

interface FloatingToolbarPluginProps {
  anchorElem: HTMLElement;
}

function getSelectedNode(selection: ReturnType<typeof $getSelection>) {
  if (!$isRangeSelection(selection)) return null;
  const anchor = selection.anchor;
  const focus = selection.focus;
  const anchorNode = selection.anchor.getNode();
  const focusNode = selection.focus.getNode();
  if (anchorNode === focusNode) {
    return anchorNode;
  }
  const isBackward = selection.isBackward();
  if (isBackward) {
    return focus.type === "text" ? focusNode : focusNode.getParentOrThrow();
  }
  return anchor.type === "text" ? anchorNode : anchorNode.getParentOrThrow();
}

export function FloatingToolbarPlugin({
  anchorElem,
}: FloatingToolbarPluginProps): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [isLink, setIsLink] = useState(false);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || selection.isCollapsed()) {
      setIsVisible(false);
      return;
    }

    const nativeSelection = window.getSelection();
    if (!nativeSelection || nativeSelection.rangeCount === 0) {
      setIsVisible(false);
      return;
    }

    setIsBold(selection.hasFormat("bold"));
    setIsItalic(selection.hasFormat("italic"));
    setIsUnderline(selection.hasFormat("underline"));
    setIsStrikethrough(selection.hasFormat("strikethrough"));
    setIsCode(selection.hasFormat("code"));

    const node = getSelectedNode(selection);
    const parent = node?.getParent();
    setIsLink($isLinkNode(parent) || $isLinkNode(node));

    setIsVisible(true);
  }, []);

  const updatePosition = useCallback(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar || !isVisible) return;

    const nativeSelection = window.getSelection();
    if (!nativeSelection || nativeSelection.rangeCount === 0) return;

    const range = nativeSelection.getRangeAt(0);
    const virtualEl = {
      getBoundingClientRect: () => range.getBoundingClientRect(),
    };

    computePosition(virtualEl, toolbar, {
      placement: "top",
      middleware: [offset(8), flip(), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      toolbar.style.left = `${x}px`;
      toolbar.style.top = `${y}px`;
    });
  }, [isVisible]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateToolbar();
          return false;
        },
        COMMAND_PRIORITY_LOW
      )
    );
  }, [editor, updateToolbar]);

  useEffect(() => {
    updatePosition();
  }, [isVisible, updatePosition]);

  // Also update position on scroll/resize
  useEffect(() => {
    if (!isVisible) return;

    const handleUpdate = () => updatePosition();
    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);
    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [isVisible, updatePosition]);

  // All dispatchCommand calls are wrapped in editor.update() so command
  // listeners that mutate state run in a writable context. See MEMO-5.
  const formatBold = () =>
    editor.update(() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold"));
  const formatItalic = () =>
    editor.update(() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic"));
  const formatUnderline = () =>
    editor.update(() =>
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")
    );
  const formatStrikethrough = () =>
    editor.update(() =>
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")
    );
  const formatCode = () =>
    editor.update(() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code"));
  const toggleLink = () => {
    editor.update(() => {
      if (isLink) {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      } else {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, "https://");
      }
    });
  };

  if (!isVisible) return null;

  return createPortal(
    <div
      ref={toolbarRef}
      className="fixed z-50 flex items-center gap-0.5 border border-overlay-border bg-popover p-1 shadow-md"
      role="toolbar"
      aria-label="Text formatting"
      data-testid="editor-toolbar"
    >
      <ToolbarButton
        active={isBold}
        onClick={formatBold}
        label="Bold (⌘+B)"
        testId="editor-toolbar-bold"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        active={isItalic}
        onClick={formatItalic}
        label="Italic (⌘+I)"
        testId="editor-toolbar-italic"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        active={isUnderline}
        onClick={formatUnderline}
        label="Underline (⌘+U)"
        testId="editor-toolbar-underline"
      >
        <Underline className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        active={isStrikethrough}
        onClick={formatStrikethrough}
        label="Strikethrough"
        testId="editor-toolbar-strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        active={isCode}
        onClick={formatCode}
        label="Inline code"
        testId="editor-toolbar-code"
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        active={isLink}
        onClick={toggleLink}
        label="Link (⌘+K)"
        testId="editor-toolbar-link"
      >
        <Link className="h-4 w-4" />
      </ToolbarButton>
    </div>,
    anchorElem
  );
}

function ToolbarButton({
  active,
  onClick,
  label,
  testId,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      className={`flex h-11 w-11 sm:h-7 sm:w-7 items-center justify-center text-sm ${
        active
          ? "bg-overlay-active text-foreground"
          : "text-muted-foreground hover:bg-overlay-hover hover:text-foreground"
      }`}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      data-testid={testId}
    >
      {children}
    </button>
  );
}
