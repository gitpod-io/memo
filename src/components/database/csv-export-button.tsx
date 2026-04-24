"use client";

import { useCallback, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/lib/toast";
import { lazyCaptureException } from "@/lib/capture";
import { getClient } from "@/lib/supabase/lazy-client";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
} from "@/lib/sentry";
import { trackEventClient } from "@/lib/track-event";
import {
  serializeRowsToCSV,
  downloadCSV,
  collectRelationPageIds,
} from "@/lib/csv-export";
import type { DatabaseProperty, DatabaseRow } from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CSVExportButtonProps {
  rows: DatabaseRow[];
  properties: DatabaseProperty[];
  databaseTitle: string;
  userId: string;
  workspaceId: string;
  pageId: string;
}

// ---------------------------------------------------------------------------
// Resolve relation page IDs to titles via Supabase
// ---------------------------------------------------------------------------

async function resolveRelationTitles(
  pageIds: string[],
): Promise<Record<string, string>> {
  if (pageIds.length === 0) return {};

  const supabase = await getClient();
  const { data, error } = await supabase
    .from("pages")
    .select("id, title")
    .in("id", pageIds);

  if (error) {
    if (!isInsufficientPrivilegeError(error)) {
      captureSupabaseError(error, "csv-export:resolve-relations");
    }
    return {};
  }

  const titles: Record<string, string> = {};
  if (data) {
    for (const page of data) {
      titles[page.id] = page.title || "Untitled";
    }
  }
  return titles;
}

// ---------------------------------------------------------------------------
// CSVExportButton
// ---------------------------------------------------------------------------

export function CSVExportButton({
  rows,
  properties,
  databaseTitle,
  userId,
  workspaceId,
  pageId,
}: CSVExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);

    try {
      // Resolve relation page titles before serialization
      const relationPageIds = collectRelationPageIds(rows, properties);
      const resolvedRelationTitles =
        await resolveRelationTitles(relationPageIds);

      const csv = serializeRowsToCSV(rows, properties, {
        resolvedRelationTitles,
      });

      const filename = (databaseTitle.trim() || "Untitled") + ".csv";
      downloadCSV(csv, filename);

      toast.success("CSV exported");

      getClient()
        .then((supabase) => {
          trackEventClient(supabase, "database.export_csv", userId, {
            workspaceId,
            metadata: { page_id: pageId, row_count: rows.length },
          });
        })
        .catch(() => {
          // Client init failed — skip tracking silently
        });
    } catch (error) {
      lazyCaptureException(error);
      toast.error("CSV export failed", { duration: 8000 });
    } finally {
      setExporting(false);
    }
  }, [
    exporting,
    rows,
    properties,
    databaseTitle,
    userId,
    workspaceId,
    pageId,
  ]);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
            aria-label="Download CSV"
            data-testid="csv-export-button"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          />
        }
      >
        <Download className="size-3.5" />
        {exporting ? "Exporting…" : "Download CSV"}
      </TooltipTrigger>
      <TooltipContent>
        Export {rows.length} {rows.length === 1 ? "row" : "rows"} as CSV
      </TooltipContent>
    </Tooltip>
  );
}
