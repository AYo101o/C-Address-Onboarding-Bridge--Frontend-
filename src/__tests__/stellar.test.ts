import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isValidStellarAddress,
  isCAddress,
  isGAddress,
  getAccountBalances,
  clearAccountBalancesCache,
} from "@/lib/stellar";

// Shared mock for the Horizon server's loadAccount. Hoisted so the vi.mock
// factory (itself hoisted above the imports) can reference it safely.
const { loadAccount } = vi.hoisted(() => ({ loadAccount: vi.fn() }));

vi.mock("@stellar/stellar-sdk", () => {
  class Server {
    loadAccount = loadAccount;
  }
  return { Horizon: { Server } };
});

const G_ADDRESS = "GAIUIQ7G3TMN53Z2Y3Y5CJI7Q7ZQJX4W5F5N5Z5Q5Z5Q5Z5Q5Z5Q5Z5A";
const C_ADDRESS = "CAIUIQ7G3TMN53Z2Y3Y5CJI7Q7ZQJX4W5F5N5Z5Q5Z5Q5Z5Q5Z5Q5Z5A";

describe("isValidStellarAddress", () => {
  it("accepts valid G-address", () => {
    expect(isValidStellarAddress(G_ADDRESS)).toBe(true);
  });

  it("accepts valid C-address", () => {
    expect(isValidStellarAddress(C_ADDRESS)).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidStellarAddress("")).toBe(false);
  });

  it("rejects too-short address", () => {
    expect(isValidStellarAddress("GABC")).toBe(false);
  });

  it("rejects invalid prefix", () => {
    const addr = "X" + G_ADDRESS.slice(1);
    expect(isValidStellarAddress(addr)).toBe(false);
  });
});

describe("isCAddress", () => {
  it("detects C-address", () => {
    expect(isCAddress(C_ADDRESS)).toBe(true);
  });

  it("rejects G-address", () => {
    expect(isCAddress(G_ADDRESS)).toBe(false);
  });

  it("rejects short address", () => {
    expect(isCAddress("CABC")).toBe(false);
  });
});

describe("isGAddress", () => {
  it("detects G-address", () => {
    expect(isGAddress(G_ADDRESS)).toBe(true);
  });

  it("rejects C-address", () => {
    expect(isGAddress(C_ADDRESS)).toBe(false);
  });
});

describe("getAccountBalances cache", () => {
  const account = (xlm: string) => ({
    balances: [{ asset_type: "native", balance: xlm }],
  });

  beforeEach(() => {
    clearAccountBalancesCache();
    loadAccount.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses the native balance into total", async () => {
    loadAccount.mockResolvedValue(account("100.5"));

    const result = await getAccountBalances(G_ADDRESS, "TESTNET");

    expect(result.total).toBe("100.5");
    expect(result.balances).toEqual([{ asset: "XLM", amount: "100.5" }]);
  });

  it("serves back-to-back calls within the TTL from cache", async () => {
    loadAccount.mockResolvedValue(account("100"));

    const first = await getAccountBalances(G_ADDRESS, "TESTNET");
    const second = await getAccountBalances(G_ADDRESS, "TESTNET");

    expect(first.total).toBe("100");
    expect(second.total).toBe("100");
    expect(loadAccount).toHaveBeenCalledTimes(1);
  });

  it("refetches once the TTL has elapsed", async () => {
    loadAccount.mockResolvedValue(account("100"));
    await getAccountBalances(G_ADDRESS, "TESTNET");

    vi.advanceTimersByTime(11_000);
    loadAccount.mockResolvedValue(account("200"));
    const result = await getAccountBalances(G_ADDRESS, "TESTNET");

    expect(result.total).toBe("200");
    expect(loadAccount).toHaveBeenCalledTimes(2);
  });

  it("caches per address:network key", async () => {
    loadAccount.mockResolvedValue(account("100"));

    await getAccountBalances(G_ADDRESS, "TESTNET");
    await getAccountBalances(G_ADDRESS, "PUBLIC");

    // Same address, different network -> distinct cache entries.
    expect(loadAccount).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent in-flight requests", async () => {
    let resolve!: (value: unknown) => void;
    loadAccount.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );

    const p1 = getAccountBalances(G_ADDRESS, "TESTNET");
    const p2 = getAccountBalances(G_ADDRESS, "TESTNET");
    resolve(account("77"));
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1.total).toBe("77");
    expect(r2.total).toBe("77");
    expect(loadAccount).toHaveBeenCalledTimes(1);
  });

  it("returns the fallback and does not cache failures", async () => {
    loadAccount.mockRejectedValueOnce(new Error("network down"));

    const failed = await getAccountBalances(G_ADDRESS, "TESTNET");
    expect(failed).toEqual({ total: "0", balances: [] });

    // Next call within the TTL must retry rather than serve the fallback.
    loadAccount.mockResolvedValue(account("50"));
    const recovered = await getAccountBalances(G_ADDRESS, "TESTNET");

    expect(recovered.total).toBe("50");
    expect(loadAccount).toHaveBeenCalledTimes(2);
  });

  it("clearAccountBalancesCache forces a refetch", async () => {
    loadAccount.mockResolvedValue(account("100"));
    await getAccountBalances(G_ADDRESS, "TESTNET");

    clearAccountBalancesCache();
    await getAccountBalances(G_ADDRESS, "TESTNET");

    expect(loadAccount).toHaveBeenCalledTimes(2);
  });
});
