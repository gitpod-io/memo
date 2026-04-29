"use client";

import { useEffect, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import type { EditorState } from "lexical";

const STORAGE_KEY = "memo-demo-editor-content";
const MAX_SIZE_BYTES = 100 * 1024; // 100KB cap
const SAVE_DEBOUNCE_MS = 500;

/**
 * Reads the saved editor state from sessionStorage.
 * Returns the serialized JSON string or null if nothing is stored / storage is unavailable.
 */
export function loadDemoContent(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Lexical plugin that persists editor state to sessionStorage on every change,
 * debounced to avoid excessive writes. Enforces a size cap to prevent abuse of
 * browser storage quotas.
 */
export function LocalPersistencePlugin(): null {
  const [editor] = useLexicalComposerContext();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const removeListener = editor.registerUpdateListener(
      ({ editorState }: { editorState: EditorState }) => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
          const json = editorState.toJSON();
          const serialized = JSON.stringify(json);

          if (serialized.length > MAX_SIZE_BYTES) {
            // Content exceeds cap — skip saving to avoid filling storage
            return;
          }

          try {
            sessionStorage.setItem(STORAGE_KEY, serialized);
          } catch {
            // Storage full or unavailable — silently ignore
          }
        }, SAVE_DEBOUNCE_MS);
      },
    );

    return () => {
      removeListener();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [editor]);

  return null;
}
