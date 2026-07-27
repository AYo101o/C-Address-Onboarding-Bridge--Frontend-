import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildAndSubmitPayment } from "@/lib/stellar";
import { clearAllSequenceCache } from "@/lib/sequenceManager";
import * as freighter from "@stellar/freighter-api";
import * as stellarLib from "@/lib/stellar";

const G_SOURCE = "GAIUIQ7G3TMN53Z2Y3Y5CJI7Q7ZQJX4W5F5N5Z5Q5Z5Q5Z5Q5Z5Q5Z5A";
const G_DEST = "GBIUIQ7G3TMN53Z2Y3Y5CJI7Q7ZQJX4W5F5N5Z5Q5Z5Q5Z5Q5Z5Q5Z5B";

vi.mock("@stellar/freighter-api", () => ({
  signTransaction: vi.fn(),
  isConnected: vi.fn(),
  getAddress: vi.fn(),
  getNetwork: vi.fn(),
}));

describe("Sequence number consumption end-to-end", () => {
  let networkSequence = "100";
  let submittedSequences: string[] = [];

  beforeEach(() => {
    clearAllSequenceCache();
    networkSequence = "100";
    submittedSequences = [];
    vi.useFakeTimers();

    vi.mocked(freighter.signTransaction).mockImplementation(async (xdr: string) => {
      return { signedTxXdr: xdr };
    });

    const mockHorizonServer = {
      loadAccount: vi.fn().mockImplementation(async () => ({
        sequenceNumber: () => networkSequence,
        balances: [{ asset_type: "native", balance: "1000" }],
      })),
      submitTransaction: vi.fn().mockImplementation(async (tx: any) => {
        submittedSequences.push(String(tx.sequence));
        return { hash: "mock-tx-hash" };
      }),
    };

    vi.spyOn(stellarLib, "getHorizonServer").mockResolvedValue(mockHorizonServer as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("increments sequence number strictly by 1 across consecutive payment calls", async () => {
    // 1st call (cache miss -> fetches networkSequence 100)
    const res1 = await buildAndSubmitPayment(G_SOURCE, G_DEST, "10", "XLM", "TESTNET");
    expect(res1.successful).toBe(true);
    expect(submittedSequences[0]).toBe("100");

    // 2nd call (cache hit -> increments to 101)
    const res2 = await buildAndSubmitPayment(G_SOURCE, G_DEST, "10", "XLM", "TESTNET");
    expect(res2.successful).toBe(true);
    expect(submittedSequences[1]).toBe("101");
  });

  it("handles cache expiration and fetches fresh sequence without collision", async () => {
    // 1st call
    await buildAndSubmitPayment(G_SOURCE, G_DEST, "10", "XLM", "TESTNET");
    expect(submittedSequences[0]).toBe("100");

    // 2nd call (cache hit)
    await buildAndSubmitPayment(G_SOURCE, G_DEST, "10", "XLM", "TESTNET");
    expect(submittedSequences[1]).toBe("101");

    // Advance past TTL (30s)
    vi.advanceTimersByTime(35_000);
    networkSequence = "102"; // Network sequence updated after 2 transactions confirmed

    // 3rd call (cache miss -> fetches networkSequence 102)
    await buildAndSubmitPayment(G_SOURCE, G_DEST, "10", "XLM", "TESTNET");
    expect(submittedSequences[2]).toBe("102");
  });
});
