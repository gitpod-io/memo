"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { lazyCaptureException } from "@/lib/capture";
import { getClient } from "@/lib/supabase/lazy-client";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
  isSchemaNotFoundError,
} from "@/lib/sentry";
import type { RendererProps, EditorProps } from "./index";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileEntry {
  name: string;
  url: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "avif",
  "ico",
  "bmp",
]);

const ACCEPTED_FILE_TYPES =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.json,.md";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.has(getExtension(filename));
}

function parseFiles(value: Record<string, unknown>): FileEntry[] {
  const raw = value.files;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (f): f is FileEntry =>
      typeof f === "object" &&
      f !== null &&
      typeof (f as Record<string, unknown>).name === "string" &&
      typeof (f as Record<string, unknown>).url === "string",
  );
}

async function uploadFile(file: File): Promise<FileEntry | null> {
  if (file.size > MAX_FILE_SIZE) {
    toast.error("File is too large. Maximum size is 10 MB.", { duration: 8000 });
    return null;
  }

  try {
    const supabase = await getClient();
    const ext = getExtension(file.name) || "bin";
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const filePath = `uploads/${fileName}`;

    const { error } = await supabase.storage
      .from("page-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      if (!isSchemaNotFoundError(error) && !isInsufficientPrivilegeError(error)) {
        captureSupabaseError(error, "files-property:upload");
      }
      toast.error("Failed to upload file", { duration: 8000 });
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("page-images")
      .getPublicUrl(filePath);

    return { name: file.name, url: urlData.publicUrl };
  } catch (err) {
    lazyCaptureException(err);
    toast.error("Failed to upload file", { duration: 8000 });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

function FileThumbnail({ file }: { file: FileEntry }) {
  if (isImageFile(file.name)) {
    return (
      <img
        src={file.url}
        alt={file.name}
        className="h-6 w-auto max-w-12 object-cover"
      />
    );
  }
  return <FileText className="size-4 shrink-0 text-muted-foreground" />;
}

export function FilesRenderer({ value }: RendererProps) {
  const files = parseFiles(value);
  if (files.length === 0) return null;

  const maxVisible = 3;
  const visible = files.slice(0, maxVisible);
  const overflow = files.length - maxVisible;

  return (
    <div className="flex items-center gap-1.5">
      {visible.map((file, i) => (
        <FileThumbnail key={`${file.url}-${i}`} file={file} />
      ))}
      {overflow > 0 && (
        <span className="text-xs text-muted-foreground">+{overflow}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

function FileListItem({
  file,
  onRemove,
}: {
  file: FileEntry;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-overlay-hover">
      <div className="shrink-0">
        {isImageFile(file.name) ? (
          <img
            src={file.url}
            alt={file.name}
            className="h-8 w-8 object-cover"
          />
        ) : (
          <FileText className="size-4 text-muted-foreground" />
        )}
      </div>
      <span className="min-w-0 flex-1 truncate text-xs">{file.name}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={`Remove ${file.name}`}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export function FilesEditor({ value, onChange, onBlur }: EditorProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const files = parseFiles(value);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target;
      if (
        containerRef.current &&
        target instanceof Node &&
        !containerRef.current.contains(target)
      ) {
        onBlur();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onBlur]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onBlur();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onBlur]);

  const handleUpload = useCallback(
    async (fileList: FileList | File[]) => {
      const toUpload = Array.from(fileList);
      if (toUpload.length === 0) return;

      setUploading(true);
      const newEntries: FileEntry[] = [];

      for (const file of toUpload) {
        const entry = await uploadFile(file);
        if (entry) newEntries.push(entry);
      }

      if (newEntries.length > 0) {
        onChange({ files: [...files, ...newEntries] });
      }
      setUploading(false);
    },
    [files, onChange],
  );

  const handleRemove = useCallback(
    (index: number) => {
      const updated = files.filter((_, i) => i !== index);
      onChange({ files: updated });
    },
    [files, onChange],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const droppedFiles = e.dataTransfer?.files;
      if (droppedFiles && droppedFiles.length > 0) {
        void handleUpload(droppedFiles);
      }
    },
    [handleUpload],
  );

  return (
    <div
      ref={containerRef}
      className="w-64 rounded-sm border border-border bg-background shadow-md"
    >
      {/* File list */}
      {files.length > 0 && (
        <div className="max-h-48 overflow-y-auto border-b border-border">
          {files.map((file, i) => (
            <FileListItem
              key={`${file.url}-${i}`}
              file={file}
              onRemove={() => handleRemove(i)}
            />
          ))}
        </div>
      )}

      {/* Upload area */}
      <div
        className={cn(
          "p-3",
          dragOver && "bg-accent/10",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              void handleUpload(e.target.files);
              e.target.value = "";
            }
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="mr-1.5 size-3.5" />
          {uploading ? "Uploading…" : "Upload file"}
        </Button>
        <p className="mt-1.5 text-center text-xs text-muted-foreground/60">
          or drag and drop
        </p>
      </div>
    </div>
  );
}
