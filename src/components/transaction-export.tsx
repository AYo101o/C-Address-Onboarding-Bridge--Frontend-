"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { BridgeTransactionData, StellarNetwork } from "@/lib/types";
import { fetchTransactionExportPage, type ExportFormat } from "@/lib/api";
import {
  buildExportContent,
  buildExportFilename,
  downloadTextFile,
  validateExportRange,
} from "@/lib/transactionExport";
import LiveRegion from "@/components/live-region";

type ExportStatus = "idle" | "exporting" | "done" | "empty" | "error";

interface ExportProgress {
  loaded: number;
  total: number | null;
}

export interface TransactionExportControlProps {
  /** No export can run without an address to scope it to — the button is disabled without one. */
  address?: string;
  network: StellarNetwork;
}

/**
 * Date-ranged CSV/JSON export of transaction history (#470).
 *
 * Walks the (placeholder) export endpoint page by page rather than fetching
 * everything at once — each page's `await` yields back to React, so the tab
 * stays responsive and the progress indicator below actually updates as
 * pages arrive, instead of the UI freezing until one giant response lands.
 * The file is only built and downloaded once every page has been collected;
 * a zero-row result is reported as an explicit empty state instead of
 * downloading a broken/empty file (#470 requirement 5).
 */
export default function TransactionExportControl({ address, network }: TransactionExportControlProps) {
  const [open, setOpen] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [progress, setProgress] = useState<ExportProgress>({ loaded: 0, total: null });
  const [exportError, setExportError] = useState<string | null>(null);
  const panelId = useId();

  // Guards state updates after unmount — a slow page fetch shouldn't try to
  // setState on a component the user has already navigated away from.
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const handleExport = async () => {
    const validation = validateExportRange(fromDate, toDate);
    if (!validation.ok) {
      setRangeError(validation.error);
      return;
    }
    if (!address) {
      setRangeError("Connect a wallet to export transactions.");
      return;
    }

    setRangeError(null);
    setExportError(null);
    setStatus("exporting");
    setProgress({ loaded: 0, total: null });

    const rows: BridgeTransactionData[] = [];
    let cursor: string | undefined;

    try {
      do {
        const page = await fetchTransactionExportPage({
          address,
          network,
          from: validation.fromMs,
          to: validation.toMs,
          cursor,
        });
        if (cancelledRef.current) return;

        rows.push(...page.rows);
        cursor = page.nextCursor ?? undefined;
        setProgress({ loaded: rows.length, total: page.totalCount });
      } while (cursor);

      if (cancelledRef.current) return;

      if (rows.length === 0) {
        setStatus("empty");
        return;
      }

      const content = buildExportContent(rows, format);
      const filename = buildExportFilename(fromDate, toDate, format);
      downloadTextFile(
        content,
        filename,
        format === "csv" ? "text/csv;charset=utf-8;" : "application/json;charset=utf-8;"
      );
      setStatus("done");
    } catch (e: unknown) {
      if (cancelledRef.current) return;
      setStatus("error");
      setExportError(e instanceof Error ? e.message : "Export failed. Please try again.");
    }
  };

  const isExporting = status === "exporting";
  const percent =
    progress.total !== null && progress.total > 0
      ? Math.min(100, Math.round((progress.loaded / progress.total) * 100))
      : null;

  const statusMessage =
    status === "done"
      ? `Exported ${progress.loaded} transaction${progress.loaded === 1 ? "" : "s"}.`
      : status === "empty"
        ? "No transactions found in this date range — nothing to export."
        : status === "error"
          ? (exportError ?? "Export failed. Please try again.")
          : "";

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        data-testid="export-toggle"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Export
      </button>

      {open && (
        <div
          id={panelId}
          data-testid="export-panel"
          className="mt-2 p-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] space-y-3"
        >
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="export-from" className="block text-xs text-[var(--text-muted)] mb-1">
                From
              </label>
              <input
                id="export-from"
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setRangeError(null);
                }}
                aria-label="Export start date"
                className="px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>
            <div>
              <label htmlFor="export-to" className="block text-xs text-[var(--text-muted)] mb-1">
                To
              </label>
              <input
                id="export-to"
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setRangeError(null);
                }}
                aria-label="Export end date"
                className="px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>
            <div>
              <label htmlFor="export-format" className="block text-xs text-[var(--text-muted)] mb-1">
                Format
              </label>
              <select
                id="export-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                aria-label="Export format"
                className="px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              data-testid="export-submit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
                  Exporting...
                </>
              ) : (
                "Export"
              )}
            </button>
          </div>

          {rangeError && (
            <p role="alert" className="text-xs text-[var(--error)]" data-testid="export-range-error">
              {rangeError}
            </p>
          )}

          {isExporting && (
            <div data-testid="export-progress">
              <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
                <span>{percent !== null ? `${percent}%` : `${progress.loaded} rows loaded…`}</span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={percent ?? undefined}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Export progress"
                className="h-1.5 rounded-full bg-[var(--surface)] overflow-hidden"
              >
                <div
                  className={`h-full bg-[var(--primary)] transition-[width] ${percent === null ? "animate-pulse motion-reduce:animate-none" : ""}`}
                  style={{ width: percent !== null ? `${percent}%` : "100%" }}
                />
              </div>
            </div>
          )}

          {status === "empty" && (
            <p className="text-xs text-[var(--text-muted)]" data-testid="export-empty">
              {statusMessage}
            </p>
          )}
          {status === "done" && (
            <p className="text-xs text-[var(--success)]" data-testid="export-success">
              {statusMessage}
            </p>
          )}
          {status === "error" && (
            <p role="alert" className="text-xs text-[var(--error)]" data-testid="export-error">
              {statusMessage}
            </p>
          )}

          <LiveRegion message={statusMessage} />
        </div>
      )}
    </div>
  );
}
