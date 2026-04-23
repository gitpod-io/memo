"use client";

import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import { mergeRegister } from "@lexical/utils";
import { computePosition, offset, flip, shift } from "@floating-ui/react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  Download,
  Crop,
} from "lucide-react";
import {
  $isImageNode,
  type ImageAlignment,
} from "@/components/editor/image-node";
import { ImageExpandDialog } from "@/components/editor/image-expand-dialog";
import { ImageCropDialog } from "@/components/editor/image-crop-dialog";

interface FloatingImageToolbarPluginProps {
  anchorElem: HTMLElement;
}

export function FloatingImageToolbarPlugin({
  anchorElem,
}: FloatingImageToolbarPluginProps): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [selectedImageNode, setSelectedImageNode] = useState<{
    nodeKey: string;
    src: string;
    alignment: ImageAlignment;
  } | null>(null);
  const [expandOpen, setExpandOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if (!$isNodeSelection(selection)) {
      setSelectedImageNode(null);
      return;
    }

    const nodes = selection.getNodes();
    if (nodes.length !== 1) {
      setSelectedImageNode(null);
      return;
    }

    const node = nodes[0];
    if ($isImageNode(node)) {
      setSelectedImageNode({
        nodeKey: node.getKey(),
        src: node.getSrc(),
        alignment: node.getAlignment(),
      });
    } else {
      setSelectedImageNode(null);
    }
  }, []);

  const updatePosition = useCallback(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar || !selectedImageNode) return;

    // Find the image DOM element via the data attribute
    const figureElem = document.querySelector(
      `[data-image-node-key="${selectedImageNode.nodeKey}"]`
    );
    if (!figureElem) return;

    const imgElem = figureElem.querySelector("img");
    if (!imgElem) return;

    const virtualEl = {
      getBoundingClientRect: () => imgElem.getBoundingClientRect(),
    };

    computePosition(virtualEl, toolbar, {
      placement: "top",
      middleware: [offset(8), flip(), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      toolbar.style.left = `${x}px`;
      toolbar.style.top = `${y}px`;
    });
  }, [selectedImageNode]);

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
  }, [selectedImageNode, updatePosition]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!selectedImageNode) return;

    const handleUpdate = () => updatePosition();
    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);
    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [selectedImageNode, updatePosition]);

  const setAlignment = useCallback(
    (alignment: ImageAlignment) => {
      if (!selectedImageNode) return;
      editor.update(() => {
        const node = $getNodeByKey(selectedImageNode.nodeKey);
        if ($isImageNode(node)) {
          node.setAlignment(alignment);
        }
      });
    },
    [editor, selectedImageNode]
  );

  const handleDownload = useCallback(() => {
    if (!selectedImageNode) return;
    const a = document.createElement("a");
    a.href = selectedImageNode.src;
    a.download = "";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [selectedImageNode]);

  const handleCropComplete = useCallback(
    (newSrc: string) => {
      if (!selectedImageNode) return;
      editor.update(() => {
        const node = $getNodeByKey(selectedImageNode.nodeKey);
        if ($isImageNode(node)) {
          node.setSrc(newSrc);
          // Reset dimensions so the image renders at its new natural size
          node.setWidthAndHeight(undefined, undefined);
        }
      });
      setCropOpen(false);
    },
    [editor, selectedImageNode]
  );

  if (!selectedImageNode) return null;

  return (
    <>
      {createPortal(
        <div
          ref={toolbarRef}
          className="fixed z-50 flex items-center gap-0.5 border border-overlay-border bg-popover p-1 shadow-md"
          role="toolbar"
          aria-label="Image tools"
          onMouseDown={(e) => e.preventDefault()}
        >
          <ToolbarButton
            active={selectedImageNode.alignment === "left"}
            onClick={() => setAlignment("left")}
            label="Align left"
          >
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={selectedImageNode.alignment === "center"}
            onClick={() => setAlignment("center")}
            label="Align center"
          >
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={selectedImageNode.alignment === "right"}
            onClick={() => setAlignment("right")}
            label="Align right"
          >
            <AlignRight className="h-4 w-4" />
          </ToolbarButton>
          <div className="mx-0.5 h-4 w-px bg-overlay-border" />
          <ToolbarButton
            active={false}
            onClick={() => setCropOpen(true)}
            label="Crop image"
          >
            <Crop className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={false}
            onClick={() => setExpandOpen(true)}
            label="Expand image"
          >
            <Maximize2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={false}
            onClick={handleDownload}
            label="Download image"
          >
            <Download className="h-4 w-4" />
          </ToolbarButton>
        </div>,
        anchorElem
      )}
      <ImageExpandDialog
        src={selectedImageNode.src}
        open={expandOpen}
        onOpenChange={setExpandOpen}
      />
      <ImageCropDialog
        src={selectedImageNode.src}
        open={cropOpen}
        onOpenChange={setCropOpen}
        onCropComplete={handleCropComplete}
      />
    </>
  );
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`flex h-7 w-7 items-center justify-center text-xs ${
        active
          ? "bg-overlay-active text-foreground"
          : "text-muted-foreground hover:bg-overlay-hover hover:text-foreground"
      }`}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
