"use client";

import { useCallback, useMemo, useState } from "react";
import { Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { DatabaseProperty } from "@/lib/types";
import {
  type ColumnMapping,
  type ParsedCSV,
  buildColumnMappings,
  inferPropertyType,
  processCSVRows,
} from "@/lib/csv-import";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parsedCSV: ParsedCSV | null;
  properties: DatabaseProperty[];
  onConfirm: (data: CSVImportConfirmData) => void;
  importing: boolean;
}

export interface CSVImportConfirmData {
  titleIndex: number;
  mappings: ColumnMapping[];
  rows: ParsedCSV["rows"];
}

// ---------------------------------------------------------------------------
// Preview table (first 5 rows)
// ---------------------------------------------------------------------------

const PREVIEW_ROW_COUNT = 5;

function PreviewTable({
  parsedCSV,
  titleIndex,
  mappings,
}: {
  parsedCSV: ParsedCSV;
  titleIndex: number;
  mappings: ColumnMapping[];
}) {
  const previewRows = parsedCSV.rows.slice(0, PREVIEW_ROW_COUNT);
  const results = processCSVRows(
    { headers: parsedCSV.headers, rows: previewRows },
    titleIndex,
    mappings,
  );

  // Build display columns: Title + mapped columns
  const displayColumns: { header: string; getCell: (rowIdx: number) => string }[] = [];

  // Title column
  displayColumns.push({
    header: "Title",
    getCell: (rowIdx) => results[rowIdx]?.title ?? "",
  });

  // Mapped property columns
  for (const mapping of mappings) {
    if (!mapping.property && !mapping.createAsNew) continue;
    displayColumns.push({
      header: mapping.csvHeader,
      getCell: (rowIdx) => {
        const csvRow = previewRows[rowIdx];
        return csvRow?.[mapping.csvIndex] ?? "";
      },
    });
  }

  return (
    <div className="max-h-64 overflow-auto border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            {displayColumns.map((col, i) => (
              <TableHead key={i} className="text-xs">
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {previewRows.map((_, rowIdx) => (
            <TableRow key={rowIdx}>
              {displayColumns.map((col, colIdx) => (
                <TableCell key={colIdx} className="text-xs">
                  <span className="line-clamp-2">{col.getCell(rowIdx)}</span>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column mapping list
// ---------------------------------------------------------------------------

function MappingList({
  mappings,
  onToggleCreate,
}: {
  mappings: ColumnMapping[];
  onToggleCreate: (csvIndex: number, create: boolean) => void;
}) {
  const unmatchedMappings = mappings.filter((m) => m.property === null);
  if (unmatchedMappings.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        These CSV columns don&apos;t match existing properties. Check the ones
        you want to create as new text properties:
      </p>
      <div className="space-y-1">
        {unmatchedMappings.map((mapping) => (
          <label
            key={mapping.csvIndex}
            className="flex items-center gap-2 text-sm"
          >
            <Checkbox
              checked={mapping.createAsNew}
              onCheckedChange={(checked) =>
                onToggleCreate(mapping.csvIndex, checked === true)
              }
              data-testid={`csv-import-create-${mapping.csvHeader}`}
            />
            <span>{mapping.csvHeader}</span>
            <Badge variant="secondary" className="text-xs">
              new text property
            </Badge>
          </label>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSVImportDialog
// ---------------------------------------------------------------------------

export function CSVImportDialog({
  open,
  onOpenChange,
  parsedCSV,
  properties,
  onConfirm,
  importing,
}: CSVImportDialogProps) {
  // Build initial mappings when parsedCSV changes
  const initialMappings = useMemo(() => {
    if (!parsedCSV) return { titleIndex: -1, mappings: [] as ColumnMapping[] };
    return buildColumnMappings(parsedCSV.headers, properties);
  }, [parsedCSV, properties]);

  const [mappings, setMappings] = useState<ColumnMapping[]>(
    initialMappings.mappings,
  );

  // Sync mappings when parsedCSV changes
  const [lastCSV, setLastCSV] = useState<ParsedCSV | null>(null);
  if (parsedCSV !== lastCSV) {
    setLastCSV(parsedCSV);
    if (parsedCSV) {
      const fresh = buildColumnMappings(parsedCSV.headers, properties);
      setMappings(fresh.mappings);
    }
  }

  const titleIndex = initialMappings.titleIndex;

  const handleToggleCreate = useCallback(
    (csvIndex: number, create: boolean) => {
      setMappings((prev) =>
        prev.map((m) =>
          m.csvIndex === csvIndex ? { ...m, createAsNew: create } : m,
        ),
      );
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    if (!parsedCSV) return;
    onConfirm({ titleIndex, mappings, rows: parsedCSV.rows });
  }, [parsedCSV, titleIndex, mappings, onConfirm]);

  const matchedCount = mappings.filter((m) => m.property !== null).length;
  const newCount = mappings.filter(
    (m) => m.property === null && m.createAsNew,
  ).length;
  const skippedCount = mappings.filter(
    (m) => m.property === null && !m.createAsNew,
  ).length;

  // Infer types for new columns to show in summary
  const newColumnTypes = useMemo(() => {
    if (!parsedCSV) return new Map<number, string>();
    const types = new Map<number, string>();
    for (const mapping of mappings) {
      if (mapping.property === null && mapping.createAsNew) {
        const values = parsedCSV.rows.map(
          (row) => row[mapping.csvIndex] ?? "",
        );
        types.set(mapping.csvIndex, inferPropertyType(values));
      }
    }
    return types;
  }, [parsedCSV, mappings]);

  // Suppress unused variable lint — newColumnTypes is used in the summary
  void newColumnTypes;

  if (!parsedCSV) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl"
        showCloseButton={false}
        data-testid="csv-import-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-4" />
            Import CSV
          </DialogTitle>
          <DialogDescription>
            {parsedCSV.rows.length} row{parsedCSV.rows.length !== 1 ? "s" : ""}{" "}
            found. Review the column mapping and preview below.
          </DialogDescription>
        </DialogHeader>

        {/* Column mapping summary */}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {matchedCount > 0 && (
            <span>
              {matchedCount} column{matchedCount !== 1 ? "s" : ""} matched
            </span>
          )}
          {newCount > 0 && (
            <span>
              · {newCount} new propert{newCount !== 1 ? "ies" : "y"} to create
            </span>
          )}
          {skippedCount > 0 && (
            <span>
              · {skippedCount} column{skippedCount !== 1 ? "s" : ""} skipped
            </span>
          )}
        </div>

        {/* Unmatched column toggles */}
        <MappingList
          mappings={mappings}
          onToggleCreate={handleToggleCreate}
        />

        {/* Preview table */}
        <PreviewTable
          parsedCSV={parsedCSV}
          titleIndex={titleIndex}
          mappings={mappings.filter(
            (m) => m.property !== null || m.createAsNew,
          )}
        />

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importing}
            data-testid="csv-import-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={importing}
            data-testid="csv-import-confirm"
          >
            {importing
              ? "Importing…"
              : `Import ${parsedCSV.rows.length} row${parsedCSV.rows.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
