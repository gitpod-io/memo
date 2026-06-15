"use client";

import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/lib/toast";
import { addRow, addProperty } from "@/lib/database";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
} from "@/lib/sentry";
import { trackEventClient } from "@/lib/track-event";
import { getClient } from "@/lib/supabase/lazy-client";
import {
  type ParsedCSV,
  parseCSV,
  coerceValue,
  inferPropertyType,
} from "@/lib/csv-import";
import {
  CSVImportDialog,
  type CSVImportConfirmData,
} from "@/components/database/csv-import-dialog";
import type { DatabaseProperty, DatabaseRow } from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CSVImportButtonProps {
  pageId: string;
  userId: string;
  workspaceId: string;
  properties: DatabaseProperty[];
  onRowsImported: (newRows: DatabaseRow[]) => void;
  onPropertiesAdded: (newProps: DatabaseProperty[]) => void;
}

// ---------------------------------------------------------------------------
// CSVImportButton
// ---------------------------------------------------------------------------

export function CSVImportButton({
  pageId,
  userId,
  workspaceId,
  properties,
  onRowsImported,
  onPropertiesAdded,
}: CSVImportButtonProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsedCSV, setParsedCSV] = useState<ParsedCSV | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (!file) return;

      if (!file.name.endsWith(".csv")) {
        toast.error("Please select a .csv file", { duration: 8000 });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const parsed = parseCSV(text);

        if (parsed.headers.length === 0) {
          toast.error("CSV file is empty or has no headers", {
            duration: 8000,
          });
          return;
        }

        if (parsed.rows.length === 0) {
          toast.error("CSV file has headers but no data rows", {
            duration: 8000,
          });
          return;
        }

        setParsedCSV(parsed);
        setDialogOpen(true);
      };
      reader.onerror = () => {
        toast.error("Failed to read CSV file", { duration: 8000 });
      };
      reader.readAsText(file);
    },
    [],
  );

  const handleConfirm = useCallback(
    async (data: CSVImportConfirmData) => {
      setImporting(true);

      try {
        // 1. Create new properties for unmatched columns that the user opted in
        const newPropsToCreate = data.mappings.filter(
          (m) => m.property === null && m.createAsNew,
        );
        const createdProps: DatabaseProperty[] = [];

        for (const mapping of newPropsToCreate) {
          const values = data.rows.map(
            (row) => row[mapping.csvIndex] ?? "",
          );
          const inferredType = inferPropertyType(values);

          const { data: newProp, error } = await addProperty(
            pageId,
            mapping.csvHeader,
            inferredType,
          );

          if (error) {
            if (!isInsufficientPrivilegeError(error)) {
              captureSupabaseError(error, "csv-import:add-property");
            }
            // Continue with other properties
            continue;
          }

          if (newProp) {
            createdProps.push(newProp);
            // Update the mapping to reference the new property
            mapping.property = newProp;
            mapping.createAsNew = false;
          }
        }

        if (createdProps.length > 0) {
          onPropertiesAdded(createdProps);
        }

        // 2. Build the effective property list (existing + newly created)
        const effectiveProps = [...properties, ...createdProps];

        // 3. Import rows
        let importedCount = 0;
        let skippedCount = 0;
        const importedRows: DatabaseRow[] = [];

        for (let rowIdx = 0; rowIdx < data.rows.length; rowIdx++) {
          const csvRow = data.rows[rowIdx];
          const title =
            data.titleIndex >= 0
              ? (csvRow[data.titleIndex]?.trim() ?? "")
              : "";

          // Build initial values for this row
          const initialValues: Record<string, Record<string, unknown>> = {};
          let hasRowError = false;

          for (const mapping of data.mappings) {
            if (!mapping.property) continue;

            const raw = csvRow[mapping.csvIndex] ?? "";
            if (raw.trim() === "") continue;

            const prop = effectiveProps.find(
              (p) => p.id === mapping.property?.id,
            );
            if (!prop) continue;

            const { value, error } = coerceValue(raw, prop.type, prop);
            if (error) {
              hasRowError = true;
              // Still try to import what we can
            }
            if (Object.keys(value).length > 0) {
              initialValues[prop.id] = value;
            }
          }

          const { data: rowPage, error } = await addRow(
            pageId,
            userId,
            initialValues,
          );

          if (error || !rowPage) {
            if (error && !isInsufficientPrivilegeError(error)) {
              captureSupabaseError(error, "csv-import:add-row");
            }
            skippedCount++;
            continue;
          }

          // Build the DatabaseRow for optimistic UI update
          const now = new Date().toISOString();
          const rowValues: DatabaseRow["values"] = {};
          for (const [propId, value] of Object.entries(initialValues)) {
            rowValues[propId] = {
              id: "",
              row_id: rowPage.id,
              property_id: propId,
              value,
              created_at: now,
              updated_at: now,
            };
          }

          importedRows.push({
            page: {
              id: rowPage.id,
              title: title || rowPage.title || "",
              icon: null,
              cover_url: null,
              created_at: rowPage.created_at,
              updated_at: rowPage.updated_at,
              created_by: userId,
            },
            values: rowValues,
          });

          // Set the title if provided
          if (title) {
            const supabase = await getClient();
            await supabase
              .from("pages")
              .update({ title })
              .eq("id", rowPage.id);
          }

          importedCount++;
          if (hasRowError) {
            // Count as imported but with partial data
          }
        }

        // Update UI with imported rows
        if (importedRows.length > 0) {
          onRowsImported(importedRows);
        }

        // Show result toast
        if (skippedCount === 0) {
          toast.success(
            `Imported ${importedCount} row${importedCount !== 1 ? "s" : ""}`,
          );
        } else {
          toast.error(
            `Imported ${importedCount} of ${data.rows.length} rows, ${skippedCount} skipped`,
            { duration: 8000 },
          );
        }

        // Track event
        getClient()
          .then((supabase) => {
            trackEventClient(supabase, "database.import_csv", userId, {
              workspaceId,
              metadata: {
                page_id: pageId,
                row_count: importedCount,
                skipped_count: skippedCount,
                new_properties: createdProps.length,
              },
            });
          })
          .catch(() => {
            // Client init failed — skip tracking silently
          });

        setDialogOpen(false);
        setParsedCSV(null);
      } catch (error) {
        captureSupabaseError(
          error instanceof Error ? error : new Error(String(error)),
          "csv-import:import",
        );
        toast.error("CSV import failed", { duration: 8000 });
      } finally {
        setImporting(false);
      }
    },
    [pageId, userId, workspaceId, properties, onRowsImported, onPropertiesAdded],
  );

  const handleDialogClose = useCallback(
    (open: boolean) => {
      if (importing) return;
      setDialogOpen(open);
      if (!open) {
        setParsedCSV(null);
      }
    },
    [importing],
  );

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Import CSV"
              data-testid="csv-import-button"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            />
          }
        >
          <Upload className="size-3.5" />
          Import CSV
        </TooltipTrigger>
        <TooltipContent>Import rows from a CSV file</TooltipContent>
      </Tooltip>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        aria-hidden="true"
        onChange={handleFileChange}
        data-testid="csv-import-file-input"
      />

      <CSVImportDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        parsedCSV={parsedCSV}
        properties={properties}
        onConfirm={handleConfirm}
        importing={importing}
      />
    </>
  );
}
