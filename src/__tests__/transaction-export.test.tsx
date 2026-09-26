// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import TransactionExportControl from "@/components/transaction-export";
import type { BridgeTransactionData } from "@/lib/types";

/**
 * Tests for the transaction history export control (#470): a date-ranged
 * CSV/JSON export against the placeholder paginated export endpoint in
 * `src/lib/api.ts`. Covers the date range picker (selection + validation)
 * and the zero-row empty state, per the issue's test checklist, plus the
 * paginated happy path and an API failure so the loading state is never
 * left stuck.
 */

const fetchTransactionExportPageMock = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchTransactionExportPage: (...args: unknown[]) => fetchTransactionExportPageMock(...args),
}));

afterEach(() => {
  cleanup();
  fetchTransactionExportPageMock.mockReset();
});

const ADDRESS = "G" + "A".repeat(55);

function makeTx(id: string, timestamp: number): BridgeTransactionData {
  return {
    id,
    fromAddress: ADDRESS,
    toAddress: "C" + "B".repeat(55),
    amount: "10",
    asset: "XLM",
    status: "confirmed",
    timestamp,
    type: "g-to-c",
    hash: `hash-${id}`,
  };
}

function openPanel() {
  render(<TransactionExportControl address={ADDRESS} network="TESTNET" />);
  fireEvent.click(screen.getByTestId("export-toggle"));
}

describe("TransactionExportControl — date range picker", () => {
  it("shows both date inputs and a format choice once opened", () => {
    openPanel();
    expect(screen.getByLabelText("Export start date")).toBeInTheDocument();
    expect(screen.getByLabelText("Export end date")).toBeInTheDocument();
    expect(screen.getByLabelText("Export format")).toBeInTheDocument();
  });

  it("lets the user pick a start and end date", () => {
    openPanel();
    const from = screen.getByLabelText("Export start date") as HTMLInputElement;
    const to = screen.getByLabelText("Export end date") as HTMLInputElement;

    fireEvent.change(from, { target: { value: "2026-01-01" } });
    fireEvent.change(to, { target: { value: "2026-03-01" } });

    expect(from.value).toBe("2026-01-01");
    expect(to.value).toBe("2026-03-01");
  });

  it("requires both dates before exporting", async () => {
    openPanel();
    fireEvent.click(screen.getByTestId("export-submit"));

    expect(await screen.findByTestId("export-range-error")).toHaveTextContent(
      "Select a start and end date."
    );
    expect(fetchTransactionExportPageMock).not.toHaveBeenCalled();
  });

  it("rejects an end date before the start date without calling the API", async () => {
    openPanel();
    fireEvent.change(screen.getByLabelText("Export start date"), { target: { value: "2026-03-01" } });
    fireEvent.change(screen.getByLabelText("Export end date"), { target: { value: "2026-01-01" } });

    fireEvent.click(screen.getByTestId("export-submit"));

    expect(await screen.findByTestId("export-range-error")).toHaveTextContent(
      "End date must be on or after the start date."
    );
    expect(fetchTransactionExportPageMock).not.toHaveBeenCalled();
  });

  it("clears a stale range error once the user edits a date", async () => {
    openPanel();
    fireEvent.click(screen.getByTestId("export-submit"));
    expect(await screen.findByTestId("export-range-error")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Export start date"), { target: { value: "2026-01-01" } });

    expect(screen.queryByTestId("export-range-error")).not.toBeInTheDocument();
  });
});

describe("TransactionExportControl — populated export", () => {
  it("paginates through results, reports progress, and completes with a row count", async () => {
    fetchTransactionExportPageMock
      .mockResolvedValueOnce({
        rows: [makeTx("1", Date.parse("2026-01-05")), makeTx("2", Date.parse("2026-01-06"))],
        nextCursor: "page-2",
        totalCount: 3,
      })
      .mockResolvedValueOnce({
        rows: [makeTx("3", Date.parse("2026-01-07"))],
        nextCursor: null,
        totalCount: 3,
      });

    openPanel();
    fireEvent.change(screen.getByLabelText("Export start date"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("Export end date"), { target: { value: "2026-01-31" } });

    fireEvent.click(screen.getByTestId("export-submit"));

    await waitFor(() => expect(fetchTransactionExportPageMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId("export-success")).toHaveTextContent("Exported 3 transactions.");

    expect(fetchTransactionExportPageMock).toHaveBeenNthCalledWith(1, {
      address: ADDRESS,
      network: "TESTNET",
      from: expect.any(Number),
      to: expect.any(Number),
      cursor: undefined,
    });
    expect(fetchTransactionExportPageMock).toHaveBeenNthCalledWith(2, {
      address: ADDRESS,
      network: "TESTNET",
      from: expect.any(Number),
      to: expect.any(Number),
      cursor: "page-2",
    });
  });
});

describe("TransactionExportControl — empty result", () => {
  it("shows an explicit empty message and does not attempt a download", async () => {
    fetchTransactionExportPageMock.mockResolvedValueOnce({ rows: [], nextCursor: null, totalCount: 0 });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    openPanel();
    fireEvent.change(screen.getByLabelText("Export start date"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("Export end date"), { target: { value: "2026-01-31" } });

    fireEvent.click(screen.getByTestId("export-submit"));

    expect(await screen.findByTestId("export-empty")).toHaveTextContent(
      "No transactions found in this date range — nothing to export."
    );
    expect(clickSpy).not.toHaveBeenCalled();

    clickSpy.mockRestore();
  });

  it("treats an unknown total the same as zero rows once pagination ends", async () => {
    fetchTransactionExportPageMock.mockResolvedValueOnce({ rows: [], nextCursor: null, totalCount: null });

    openPanel();
    fireEvent.change(screen.getByLabelText("Export start date"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("Export end date"), { target: { value: "2026-01-31" } });

    fireEvent.click(screen.getByTestId("export-submit"));

    expect(await screen.findByTestId("export-empty")).toBeInTheDocument();
  });
});

describe("TransactionExportControl — errors", () => {
  it("surfaces an API failure without leaving the button stuck in a loading state", async () => {
    fetchTransactionExportPageMock.mockRejectedValueOnce(new Error("Export request failed (500)"));

    openPanel();
    fireEvent.change(screen.getByLabelText("Export start date"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("Export end date"), { target: { value: "2026-01-31" } });

    fireEvent.click(screen.getByTestId("export-submit"));

    expect(await screen.findByTestId("export-error")).toHaveTextContent("Export request failed (500)");
    expect(screen.getByTestId("export-submit")).not.toBeDisabled();
  });
});
