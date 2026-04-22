"use client";

import { useCallback, useEffect, useState } from "react";
import { History, RotateCcw } from "lucide-react";
import type { SerializedEditorState } from "lexical";
import { toast } from "@/lib/toast";
import { lazyCaptureException } from "@/lib/capture";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { RelativeTime } from "@/components/relative-time";

interface VersionSummary {
  id: string;
  page_id: string;
  created_at: string;
  created_by: string | null;
}

interface VersionHistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  onPreview: (content: SerializedEditorState) => void;
  onRestore: (content: SerializedEditorState) => void;
  onExitPreview: () => void;
}

export function VersionHistoryPanel({
  open,
  onOpenChange,
  pageId,
  onPreview,
  onRestore,
  onExitPreview,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pages/${pageId}/versions`);
      if (!res.ok) {
        throw new Error(`Failed to fetch versions: ${res.status}`);
      }
      const data = (await res.json()) as { versions: VersionSummary[] };
      setVersions(data.versions);
    } catch (error) {
      lazyCaptureException(error);
      toast.error("Failed to load version history", { duration: 8000 });
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    if (open) {
      fetchVersions();
      setSelectedId(null);
    } else {
      onExitPreview();
    }
  }, [open, fetchVersions, onExitPreview]);

  const handleSelectVersion = useCallback(
    async (versionId: string) => {
      setSelectedId(versionId);
      try {
        const res = await fetch(`/api/pages/${pageId}/versions/${versionId}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch version: ${res.status}`);
        }
        const data = (await res.json()) as {
          version: { content: SerializedEditorState };
        };
        onPreview(data.version.content);
      } catch (error) {
        lazyCaptureException(error);
        toast.error("Failed to load version preview", { duration: 8000 });
        setSelectedId(null);
      }
    },
    [pageId, onPreview],
  );

  const handleRestore = useCallback(async () => {
    if (!selectedId) return;
    setRestoring(true);
    try {
      const res = await fetch(
        `/api/pages/${pageId}/versions/${selectedId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "restore" }),
        },
      );
      if (!res.ok) {
        throw new Error(`Failed to restore version: ${res.status}`);
      }
      const data = (await res.json()) as {
        restored: boolean;
        content: SerializedEditorState;
      };
      onRestore(data.content);
      onOpenChange(false);
      toast.success("Version restored");
    } catch (error) {
      lazyCaptureException(error);
      toast.error("Failed to restore version", { duration: 8000 });
    } finally {
      setRestoring(false);
    }
  }, [selectedId, pageId, onRestore, onOpenChange]);

  const handleDeselect = useCallback(() => {
    setSelectedId(null);
    onExitPreview();
  }, [onExitPreview]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col p-0">
        <SheetHeader className="border-b border-white/[0.06] p-4">
          <SheetTitle className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4" />
            Version history
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {versions.length} version{versions.length !== 1 ? "s" : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse bg-muted" />
              ))}
            </div>
          )}

          {!loading && versions.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
              <History className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No versions yet
              </p>
              <p className="text-xs text-muted-foreground">
                Versions are saved automatically as you edit
              </p>
            </div>
          )}

          {!loading &&
            versions.map((version) => (
              <button
                key={version.id}
                type="button"
                onClick={() =>
                  selectedId === version.id
                    ? handleDeselect()
                    : handleSelectVersion(version.id)
                }
                className={`w-full border-b border-white/[0.06] px-4 py-3 text-left transition-none hover:bg-white/[0.04] ${
                  selectedId === version.id ? "bg-white/[0.08]" : ""
                }`}
              >
                <div className="text-sm">
                  <RelativeTime
                    dateStr={version.created_at}
                    className="text-sm"
                  />
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(version.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </button>
            ))}
        </div>

        {selectedId && (
          <div className="border-t border-white/[0.06] p-4">
            <Button
              onClick={handleRestore}
              disabled={restoring}
              className="w-full"
              size="sm"
            >
              <RotateCcw className="h-4 w-4" />
              {restoring ? "Restoring..." : "Restore this version"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
