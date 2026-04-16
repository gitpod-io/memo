"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $insertNodes,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_HIGH,
  createCommand,
  DRAGOVER_COMMAND,
  DROP_COMMAND,
  type LexicalCommand,
} from "lexical";
import { $createImageNode, type ImagePayload } from "@/components/editor/image-node";
import { createClient } from "@/lib/supabase/client";
import { captureSupabaseError } from "@/lib/sentry";

export const INSERT_IMAGE_COMMAND: LexicalCommand<ImagePayload> =
  createCommand("INSERT_IMAGE_COMMAND");

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

async function uploadImage(file: File): Promise<string | null> {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) return null;
  if (file.size > MAX_FILE_SIZE) return null;

  const supabase = createClient();
  const ext = file.name.split(".").pop() ?? "png";
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const filePath = `uploads/${fileName}`;

  const { error } = await supabase.storage
    .from("page-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    captureSupabaseError(error, "image-plugin:upload");
    return null;
  }

  const { data: urlData } = supabase.storage
    .from("page-images")
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

export function ImagePlugin(): null {
  const [editor] = useLexicalComposerContext();

  // Register INSERT_IMAGE_COMMAND
  useEffect(() => {
    return editor.registerCommand(
      INSERT_IMAGE_COMMAND,
      (payload: ImagePayload) => {
        editor.update(() => {
          const imageNode = $createImageNode(payload);
          $insertNodes([imageNode]);

          // Add a paragraph after the image so the user can continue typing
          const paragraphNode = $createParagraphNode();
          imageNode.insertAfter(paragraphNode);
          paragraphNode.selectEnd();
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );
  }, [editor]);

  // Handle file drop onto the editor (image files only)
  useEffect(() => {
    return editor.registerCommand(
      DROP_COMMAND,
      (event: DragEvent) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;

        const imageFiles = Array.from(files).filter((f) =>
          ACCEPTED_IMAGE_TYPES.has(f.type)
        );
        if (imageFiles.length === 0) return false;

        event.preventDefault();

        for (const file of imageFiles) {
          void uploadImage(file).then((url) => {
            if (url) {
              editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
                src: url,
                altText: file.name,
              });
            }
          });
        }

        return true;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor]);

  // Handle dragover for image files to show drop cursor
  useEffect(() => {
    return editor.registerCommand(
      DRAGOVER_COMMAND,
      (event: DragEvent) => {
        const hasFiles = event.dataTransfer?.types.includes("Files");
        if (hasFiles) {
          event.preventDefault();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor]);

  return null;
}

/** Opens a file picker and dispatches INSERT_IMAGE_COMMAND for the selected file. */
export function openImagePicker(editor: ReturnType<typeof useLexicalComposerContext>[0]): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;

    const url = await uploadImage(file);
    if (url) {
      editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
        src: url,
        altText: file.name,
      });
    }
  };
  input.click();
}
