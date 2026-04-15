"use client";

import type { JSX } from "react";
import { useCallback, useRef, useState } from "react";
import type {
  DOMExportOutput,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import { $applyNodeReplacement, $getNodeByKey, DecoratorNode } from "lexical";

export interface ImagePayload {
  src: string;
  altText: string;
  caption?: string;
  width?: number;
  height?: number;
  key?: NodeKey;
}

export type SerializedImageNode = Spread<
  {
    src: string;
    altText: string;
    caption: string;
    width: number | undefined;
    height: number | undefined;
  },
  SerializedLexicalNode
>;

function ImageComponent({
  src,
  altText,
  caption,
  width,
  height,
  nodeKey,
  editor,
}: {
  src: string;
  altText: string;
  caption: string;
  width: number | undefined;
  height: number | undefined;
  nodeKey: NodeKey;
  editor: LexicalEditor;
}): JSX.Element {
  const [currentCaption, setCurrentCaption] = useState(caption);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCaptionSave = useCallback(() => {
    setIsEditing(false);
    editor.update(() => {
      const node = $getImageNodeByKey(nodeKey);
      if (node) {
        node.setCaption(currentCaption);
      }
    });
  }, [editor, nodeKey, currentCaption]);

  return (
    <figure className="mt-3 flex flex-col items-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- Lexical DecoratorNode with user-uploaded dynamic URLs */}
      <img
        src={src}
        alt={altText}
        width={width}
        height={height}
        className="max-w-full"
        draggable={false}
      />
      {isEditing ? (
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
          onClick={() => setIsEditing(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") setIsEditing(true);
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
    });
  }

  constructor(
    src: string,
    altText: string,
    caption?: string,
    width?: number,
    height?: number,
    key?: NodeKey
  ) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__caption = caption ?? "";
    this.__width = width;
    this.__height = height;
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

  setCaption(caption: string): void {
    const writable = this.getWritable();
    writable.__caption = caption;
  }

  decorate(editor: LexicalEditor): JSX.Element {
    return (
      <ImageComponent
        src={this.__src}
        altText={this.__altText}
        caption={this.__caption}
        width={this.__width}
        height={this.__height}
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
      payload.key
    )
  );
}

export function $isImageNode(
  node: LexicalNode | null | undefined
): node is ImageNode {
  return node instanceof ImageNode;
}
