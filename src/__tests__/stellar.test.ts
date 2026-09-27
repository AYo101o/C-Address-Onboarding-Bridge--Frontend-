import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import {
  isValidStellarAddress,
  isCAddress,
  isGAddress,
  isValidStellarAmount,
  getAccountBalances,
  clearAccountBalancesCache,
  fetchRecentTransactions,
} from "@/lib/stellar";

// Real, checksum-valid StrKeys derived from the SDK — not hardcoded strings
// that merely "look" the right length/prefix. The G-address is a genuine
// Ed25519 public key; the C-address is a genuine contract StrKey encoded from
// the same 32-byte body. Both carry a valid base32 alphabet and CRC16 checksum.
const keypair = Keypair.random();
const G_ADDRESS = keypair.publicKey();
const C_ADDRESS = StrKey.encodeContract(keypair.rawPublicKey());

describe("fixtures are genuinely valid StrKeys", () => {
  it("G_ADDRESS is a valid Ed25519 public key", () => {
    expect(StrKey.isValidEd25519PublicKey(G_ADDRESS)).toBe(true);
    expect(G_ADDRESS).toMatch(/^G/);
    expect(G_ADDRESS).toHaveLength(56);
  });

  it("C_ADDRESS is a valid contract StrKey", () => {
    expect(StrKey.isValidContract(C_ADDRESS)).toBe(true);
    expect(C_ADDRESS).toMatch(/^C/);
    expect(C_ADDRESS).toHaveLength(56);
  });
});

describe("isValidStellarAddress", () => {
  it("accepts a real, checksum-valid G-address", () => {
    expect(isValidStellarAddress(G_ADDRESS)).toBe(true);
  });

  it("accepts a real, checksum-valid C-address", () => {
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

  // Regression: the old /^[G|C].../ character class treated '|' as an allowed
  // first character, so a pipe-prefixed 56-char string wrongly validated.
  it("rejects a pipe-prefixed 56-character string", () => {
    const piped = "|" + G_ADDRESS.slice(1);
    expect(piped).toHaveLength(56);
    expect(isValidStellarAddress(piped)).toBe(false);
  });

  // Regression: the old [A-Z0-9] body class accepted 0/1/8/9, which are NOT in
  // the Stellar base32 alphabet (RFC 4648 uses A-Z and 2-7).
  it.each(["0", "1", "8", "9"])(
    "rejects an address containing invalid base32 char '%s' in the body",
    (badChar) => {
      const corrupted = G_ADDRESS.slice(0, 10) + badChar + G_ADDRESS.slice(11);
      expect(corrupted).toHaveLength(56);
      expect(isValidStellarAddress(corrupted)).toBe(false);
    },
  );

  // Regression: the old regex performed no checksum verification at all, so a
  // single-character corruption that stays within the alphabet slipped through.
  it("rejects a checksum-corrupted address (last character flipped)", () => {
    const last = G_ADDRESS.slice(-1);
    const flipped = last === "A" ? "B" : "A";
    const corrupted = G_ADDRESS.slice(0, -1) + flipped;
    expect(corrupted).toHaveLength(56);
    expect(corrupted).not.toBe(G_ADDRESS);
    expect(isValidStellarAddress(corrupted)).toBe(false);
  });
});

describe("isValidStellarAmount", () => {
  it("accepts valid integers", () => {
    expect(isValidStellarAmount("100")).toBe(true);
    expect(isValidStellarAmount("1")).toBe(true);
  });

  it("accepts amounts with up to 7 decimal places", () => {
    expect(isValidStellarAmount("0.1")).toBe(true);
    expect(isValidStellarAmount("0.1234567")).toBe(true);
    expect(isValidStellarAmount("10.0000001")).toBe(true);
  });

  it("rejects amounts with more than 7 decimal places", () => {
    expect(isValidStellarAmount("0.12345678")).toBe(false);
    expect(isValidStellarAmount("1.000000001")).toBe(false);
  });

  it("rejects zero and negative amounts", () => {
    expect(isValidStellarAmount("0")).toBe(false);
    expect(isValidStellarAmount("0.0000000")).toBe(false);
    expect(isValidStellarAmount("-5")).toBe(false);
  });

  it("rejects invalid formats", () => {
    expect(isValidStellarAmount("")).toBe(false);
    expect(isValidStellarAmount("abc")).toBe(false);
    expect(isValidStellarAmount("1.2.3")).toBe(false);
    expect(isValidStellarAmount("1.")).toBe(false);
  });
});

describe("isCAddress", () => {
  it("detects a valid C-address", () => {
    expect(isCAddress(C_ADDRESS)).toBe(true);
  });

  it("rejects a G-address", () => {
    expect(isCAddress(G_ADDRESS)).toBe(false);
  });

  it("rejects a short address", () => {
    expect(isCAddress("CABC")).toBe(false);
  });

  it("rejects a C-prefixed string that fails the checksum", () => {
    const corrupted = C_ADDRESS.slice(0, -1) + (C_ADDRESS.slice(-1) === "A" ? "B" : "A");
    expect(isCAddress(corrupted)).toBe(false);
  });
});

describe("isGAddress", () => {
  it("detects a valid G-address", () => {
    expect(isGAddress(G_ADDRESS)).toBe(true);
  });

  it("rejects a C-address", () => {
    expect(isGAddress(C_ADDRESS)).toBe(false);
  });

  it("rejects a G-prefixed string that fails the checksum", () => {
    const corrupted = G_ADDRESS.slice(0, -1) + (G_ADDRESS.slice(-1) === "A" ? "B" : "A");
    expect(isGAddress(corrupted)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Shared mock for Horizon.Server used by getAccountBalances and
// fetchRecentTransactions tests. We mock Horizon.Server so the real SDK
// network is never contacted; each describe block resets the relevant mock fn.
// ---------------------------------------------------------------------------
const loadAccount = vi.fn();
const paymentsCall = vi.fn();

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: vi.fn().mockImplementation(function MockHorizonServer(this: {
        loadAccount: typeof loadAccount;
        payments: () => unknown;
      }) {
        this.loadAccount = loadAccount;
        this.payments = () => ({
          forAccount: () => ({
            limit: () => ({
              order: () => ({
                call: paymentsCall,
              }),
            }),
          }),
        });
      }),
    },
  };
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

describe("fetchRecentTransactions", () => {
  beforeEach(() => {
    paymentsCall.mockReset();
  });

  it("maps a payment operation to BridgeTransactionData", async () => {
    paymentsCall.mockResolvedValue({
      records: [
        {
          id: "tx1",
          type: "payment",
          from: G_ADDRESS,
          to: C_ADDRESS,
          amount: "50.0",
          asset_type: "native",
          transaction_successful: true,
          created_at: "2024-01-01T00:00:00Z",
          transaction_hash: "abc123",
        },
      ],
    });

    const results = await fetchRecentTransactions(G_ADDRESS, "TESTNET", 10);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "tx1",
      fromAddress: G_ADDRESS,
      toAddress: C_ADDRESS,
      amount: "50.0",
      asset: "XLM",
      status: "confirmed",
      type: "g-to-c",
      hash: "abc123",
    });
    expect(typeof results[0].timestamp).toBe("number");
  });

  it("maps a create_account operation using funder/account/starting_balance", async () => {
    paymentsCall.mockResolvedValue({
      records: [
        {
          id: "tx2",
          type: "create_account",
          funder: G_ADDRESS,
          account: C_ADDRESS,
          starting_balance: "1.5",
          transaction_successful: true,
          created_at: "2024-01-02T00:00:00Z",
          transaction_hash: "def456",
        },
      ],
    });

    const results = await fetchRecentTransactions(G_ADDRESS, "TESTNET", 10);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "tx2",
      fromAddress: G_ADDRESS,
      toAddress: C_ADDRESS,
      amount: "1.5",
      asset: "XLM",
      status: "confirmed",
    });
  });

  it("sets status to failed when transaction_successful is false", async () => {
    paymentsCall.mockResolvedValue({
      records: [
        {
          id: "tx3",
          type: "payment",
          from: G_ADDRESS,
          to: C_ADDRESS,
          amount: "10",
          asset_type: "native",
          transaction_successful: false,
          created_at: "2024-01-03T00:00:00Z",
          transaction_hash: "ghi789",
        },
      ],
    });

    const results = await fetchRecentTransactions(G_ADDRESS, "TESTNET", 10);

    expect(results[0].status).toBe("failed");
  });

  it("sets status to pending when transaction_successful is absent", async () => {
    paymentsCall.mockResolvedValue({
      records: [
        {
          id: "tx4",
          type: "payment",
          from: G_ADDRESS,
          to: C_ADDRESS,
          amount: "5",
          asset_type: "native",
          // transaction_successful intentionally omitted
          created_at: "2024-01-04T00:00:00Z",
          transaction_hash: "jkl000",
        },
      ],
    });

    const results = await fetchRecentTransactions(G_ADDRESS, "TESTNET", 10);

    expect(results[0].status).toBe("pending");
  });

  it("uses asset_code for non-native payment assets", async () => {
    paymentsCall.mockResolvedValue({
      records: [
        {
          id: "tx5",
          type: "payment",
          from: G_ADDRESS,
          to: C_ADDRESS,
          amount: "100",
          asset_type: "credit_alphanum4",
          asset_code: "USDC",
          transaction_successful: true,
          created_at: "2024-01-05T00:00:00Z",
          transaction_hash: "mno111",
        },
      ],
    });

    const results = await fetchRecentTransactions(G_ADDRESS, "TESTNET", 10);

    expect(results[0].asset).toBe("USDC");
  });

  it("returns empty array when Horizon call throws", async () => {
    paymentsCall.mockRejectedValue(new Error("network error"));

    const results = await fetchRecentTransactions(G_ADDRESS, "TESTNET", 10);

    expect(results).toEqual([]);
  });

  it("returns multiple records in the order Horizon returns them", async () => {
    paymentsCall.mockResolvedValue({
      records: [
        {
          id: "tx-a",
          type: "payment",
          from: G_ADDRESS,
          to: C_ADDRESS,
          amount: "1",
          asset_type: "native",
          transaction_successful: true,
          created_at: "2024-01-06T00:00:00Z",
          transaction_hash: "aaa",
        },
        {
          id: "tx-b",
          type: "payment",
          from: G_ADDRESS,
          to: C_ADDRESS,
          amount: "2",
          asset_type: "native",
          transaction_successful: true,
          created_at: "2024-01-05T00:00:00Z",
          transaction_hash: "bbb",
        },
      ],
    });

    const results = await fetchRecentTransactions(G_ADDRESS, "TESTNET", 2);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("tx-a");
    expect(results[1].id).toBe("tx-b");
  });
});
