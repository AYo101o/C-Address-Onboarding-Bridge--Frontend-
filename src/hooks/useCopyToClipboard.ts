/**
 * useCopyToClipboard
 *
 * Shared hook for clipboard copy operations. Tracks three distinct states:
 *   - "idle"   — no copy has been attempted or the timeout has elapsed
 *   - "copied" — the text was successfully written to the clipboard
 *   - "error"  — navigator.clipboard.writeText() rejected (e.g. permissions
 *                denied, non-secure context, browser without Clipboard API)
 *
 * Showing "Copy failed" in the error state instead of a success checkmark
 * prevents misleading feedback when the write silently fails. (#300)
 *
 * @example
 *   const { status, copy } = useCopyToClipboard();
 *   // status: "idle" | "copied" | "error"
 *   <button onClick={() => copy(address)}>
 *     {status === "copied" ? "Copied!" : status === "error" ? "Copy failed" : "Copy"}
 *   </button>
 */

"use client";

import { useState, useCallback, useRef } from "react";

export type CopyStatus = "idle" | "copied" | "error";

/** How long to show "copied" or "error" feedback before reverting to "idle". */
const COPY_FEEDBACK_DURATION_MS = 2000;

export interface UseCopyToClipboardReturn {
  /** Current state of the last copy attempt. */
  status: CopyStatus;
  /**
   * Attempt to write `text` to the clipboard.
   * Resolves to `true` on success, `false` on failure.
   */
  copy: (text: string) => Promise<boolean>;
  /** Manually reset the status back to "idle". */
  reset: () => void;
}

/**
 * @param resetAfterMs — how long to show "copied" or "error" before
 *                       reverting to "idle". Pass 0 to disable auto-reset.
 *                       Defaults to 2000ms.
 */
export function useCopyToClipboard(resetAfterMs = COPY_FEEDBACK_DURATION_MS): UseCopyToClipboardReturn {
  throw new Error('Not implemented: useCopyToClipboard');
}
