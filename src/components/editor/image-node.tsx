"use client";

import type { JSX } from "react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  DOMExportOutput,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import {
  $applyNodeReplacement,
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  DecoratorNode,
  KEY_ESCAPE_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import { mergeRegister } from "@lexical/utils";

export type ImageAlignment = "left" | "center" | "right";

export interface ImagePayload {
  src: string;
  altText: string;
  caption?: string;
  width?: number;
  height?: number;
  alignment?: ImageAlignment;
  key?: NodeKey;
}

export type SerializedImageNode = Spread<
  {
    src: string;
    altText: string;
    caption: string;
    width: number | undefined;
    height: number | undefined;
    alignment: ImageAlignment;
  },
  SerializedLexicalNode
>;

const ALIGNMENT_CLASSES: Record<ImageAlignment, string> = {
  left: "items-start",
  center: "items-center",
  right: "items-end",
};

const MIN_IMAGE_WIDTH = 100;

function ImageComponent({
  src,
  altText,
  caption,
  width,
  height,
  alignment,
  nodeKey,
  editor,
}: {
  src: string;
  altText: string;
  caption: string;
  width: number | undefined;
  height: number | undefined;
  alignment: ImageAlignment;
  nodeKey: NodeKey;
  editor: LexicalEditor;
}): JSX.Element {
  const [currentCaption, setCurrentCaption] = useState(caption);
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey);
  const [currentWidth, setCurrentWidth] = useState(width);
  const [currentHeight, setCurrentHeight] = useState(height);
  const isResizingRef = useRef(false);

  // Sync props when node updates externally (e.g. crop replaces src)
  useEffect(() => {
    setCurrentWidth(width);
    setCurrentHeight(height);
  }, [width, height]);

  useEffect(() => {
    setCurrentCaption(caption);
  }, [caption]);

  const handleCaptionSave = useCallback(() => {
    setIsEditingCaption(false);
    editor.update(() => {
      const node = $getImageNodeByKey(nodeKey);
      if (node) {
        node.setCaption(currentCaption);
      }
    });
  }, [editor, nodeKey, currentCaption]);

  // Click to select image node
  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (event: MouseEvent) => {
          if (isResizingRef.current) return true;
          const imgElem = imageRef.current;
          const target = event.target;
          if (
            imgElem &&
            (target === imgElem ||
              (target instanceof Node && imgElem.contains(target)))
          ) {
            if (!event.shiftKey) {
              clearSelection();
            }
            setSelected(true);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          if (isSelected) {
            clearSelection();
            setSelected(false);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          const selection = $getSelection();
          if (!$isNodeSelection(selection)) {
            setSelected(false);
          }
          return false;
        },
        COMMAND_PRIORITY_LOW
      )
    );
  }, [editor, isSelected, setSelected, clearSelection]);

  // Resize handler
  const handleResizeStart = useCallback(
    (event: React.MouseEvent, corner: string) => {
      event.preventDefault();
      event.stopPropagation();
      isResizingRef.current = true;

      const img = imageRef.current;
      if (!img) return;

      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = currentWidth ?? img.offsetWidth;
      const startHeight = currentHeight ?? img.offsetHeight;
      const aspectRatio = startWidth / startHeight;

      const handleMouseMove = (e: MouseEvent) => {
        let deltaX = e.clientX - startX;
        if (corner === "top-left" || corner === "bottom-left") {
          deltaX = -deltaX;
        }

        const newWidth = Math.max(MIN_IMAGE_WIDTH, startWidth + deltaX);

        if (!e.shiftKey) {
          // Preserve aspect ratio by default
          const newHeight = newWidth / aspectRatio;
          setCurrentWidth(Math.round(newWidth));
          setCurrentHeight(Math.round(newHeight));
        } else {
          // Shift unlocks aspect ratio
          let deltaY = e.clientY - startY;
          if (corner === "top-left" || corner === "top-right") {
            deltaY = -deltaY;
          }
          const newHeight = Math.max(50, startHeight + deltaY);
          setCurrentWidth(Math.round(newWidth));
          setCurrentHeight(Math.round(newHeight));
        }
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        // Persist final dimensions to node
        const finalWidth = currentWidth;
        const finalHeight = currentHeight;
        editor.update(() => {
          const node = $getImageNodeByKey(nodeKey);
          if (node && finalWidth !== undefined && finalHeight !== undefined) {
            node.setWidthAndHeight(finalWidth, finalHeight);
          }
        });

        requestAnimationFrame(() => {
          isResizingRef.current = false;
        });
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [editor, nodeKey, currentWidth, currentHeight]
  );

  // Debounced persist during resize so the node stays in sync
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isResizingRef.current) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      editor.update(() => {
        const node = $getImageNodeByKey(nodeKey);
        if (node && currentWidth !== undefined && currentHeight !== undefined) {
          node.setWidthAndHeight(currentWidth, currentHeight);
        }
      });
    }, 100);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [currentWidth, currentHeight, editor, nodeKey]);

  const resizeHandles = isSelected ? (
    <>
      {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map(
        (corner) => (
          <div
            key={corner}
            className={`absolute h-3 w-3 bg-accent ${
              corner === "top-left"
                ? "-top-1.5 -left-1.5 cursor-nw-resize"
                : corner === "top-right"
                  ? "-top-1.5 -right-1.5 cursor-ne-resize"
                  : corner === "bottom-left"
                    ? "-bottom-1.5 -left-1.5 cursor-sw-resize"
                    : "-bottom-1.5 -right-1.5 cursor-se-resize"
            }`}
            onMouseDown={(e) => handleResizeStart(e, corner)}
            role="separator"
            aria-orientation={
              corner.includes("left") ? "vertical" : "horizontal"
            }
          />
        )
      )}
    </>
  ) : null;

  return (
    <figure
      className={`mt-3 flex flex-col ${ALIGNMENT_CLASSES[alignment]}`}
      data-image-node-key={nodeKey}
      data-testid="editor-image"
    >
      <div className="relative inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element -- Lexical DecoratorNode with user-uploaded dynamic URLs */}
        <img
          ref={imageRef}
          src={src}
          alt={altText}
          width={currentWidth}
          height={currentHeight}
          className={`max-w-full ${isSelected ? "ring-2 ring-accent" : ""}`}
          draggable={false}
        />
        {resizeHandles}
      </div>
      {isEditingCaption ? (
        <input
          ref={inputRef}
          type="text"
          value={currentCaption}
          onChange={(e) => setCurrentCaption(e.target.value)}
          onBlur={handleCaptionSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCaptionSave();
            }
          }}
          className="mt-2 w-full max-w-md bg-transparent text-center text-xs text-muted-foreground outline-none placeholder:text-muted-foreground"
          placeholder="Add a caption..."
          autoFocus
        />
      ) : (
        <figcaption
          className="mt-2 cursor-pointer text-center text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setIsEditingCaption(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") setIsEditingCaption(true);
          }}
        >
          {currentCaption || "Add a caption..."}
        </figcaption>
      )}
    </figure>
  );
}

function $getImageNodeByKey(key: NodeKey): ImageNode | null {
  const node = $getNodeByKey(key);
  if (node instanceof ImageNode) return node;
  return null;
}

export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __altText: string;
  __caption: string;
  __width: number | undefined;
  __height: number | undefined;
  __alignment: ImageAlignment;

  static getType(): string {
    return "image";
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__src,
      node.__altText,
      node.__caption,
      node.__width,
      node.__height,
      node.__alignment,
      node.__key
    );
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    return $createImageNode({
      src: serializedNode.src,
      altText: serializedNode.altText,
      caption: serializedNode.caption,
      width: serializedNode.width,
      height: serializedNode.height,
      // Backward compat: old serialized nodes won't have alignment
      alignment: serializedNode.alignment ?? "center",
    });
  }

  constructor(
    src: string,
    altText: string,
    caption?: string,
    width?: number,
    height?: number,
    alignment?: ImageAlignment,
    key?: NodeKey
  ) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__caption = caption ?? "";
    this.__width = width;
    this.__height = height;
    this.__alignment = alignment ?? "center";
  }

  exportJSON(): SerializedImageNode {
    return {
      type: "image",
      version: 1,
      src: this.__src,
      altText: this.__altText,
      caption: this.__caption,
      width: this.__width,
      height: this.__height,
      alignment: this.__alignment,
    };
  }

  createDOM(): HTMLElement {
    const div = document.createElement("div");
    div.className = "editor-image";
    return div;
  }

  updateDOM(): false {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("img");
    element.setAttribute("src", this.__src);
    element.setAttribute("alt", this.__altText);
    if (this.__width) element.setAttribute("width", String(this.__width));
    if (this.__height) element.setAttribute("height", String(this.__height));
    return { element };
  }

  getSrc(): string {
    return this.__src;
  }

  getAlignment(): ImageAlignment {
    return this.__alignment;
  }

  setCaption(caption: string): void {
    const writable = this.getWritable();
    writable.__caption = caption;
  }

  setWidthAndHeight(
    width: number | undefined,
    height: number | undefined,
  ): void {
    const writable = this.getWritable();
    writable.__width = width;
    writable.__height = height;
  }

  setAlignment(alignment: ImageAlignment): void {
    const writable = this.getWritable();
    writable.__alignment = alignment;
  }

  setSrc(src: string): void {
    const writable = this.getWritable();
    writable.__src = src;
  }

  decorate(editor: LexicalEditor): JSX.Element {
    return (
      <ImageComponent
        src={this.__src}
        altText={this.__altText}
        caption={this.__caption}
        width={this.__width}
        height={this.__height}
        alignment={this.__alignment}
        nodeKey={this.getKey()}
        editor={editor}
      />
    );
  }
}

export function $createImageNode(payload: ImagePayload): ImageNode {
  return $applyNodeReplacement(
    new ImageNode(
      payload.src,
      payload.altText,
      payload.caption,
      payload.width,
      payload.height,
      payload.alignment,
      payload.key
    )
  );
}

export function $isImageNode(
  node: LexicalNode | null | undefined
): node is ImageNode {
  return node instanceof ImageNode;
}
