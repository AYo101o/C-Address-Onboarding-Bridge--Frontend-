import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Keypair, StrKey, Operation } from "@stellar/stellar-sdk";
import { buildAndSubmitPayment, bridgeViaContract } from "@/lib/stellar";
import * as freighter from "@stellar/freighter-api";

const G_SOURCE = Keypair.random().publicKey();
const G_DEST = Keypair.random().publicKey();
const C_ADDRESS = StrKey.encodeContract(Keypair.random().rawPublicKey());
const USDC_ISSUER = Keypair.random().publicKey();

const loadAccountMock = vi.fn();
const submitTransactionMock = vi.fn();

vi.mock("@stellar/freighter-api", () => ({
  signTransaction: vi.fn(),
  isConnected: vi.fn(),
  getAddress: vi.fn(),
  getNetwork: vi.fn(),
}));

// Replace only Horizon.Server's network calls; every other export (Asset,
// Operation, TransactionBuilder, StrKey, Keypair, ...) stays the real SDK
// implementation so the assertions below exercise real operation-building
// logic, not a hand-rolled stand-in.
vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: vi.fn().mockImplementation(function MockHorizonServer(this: {
        loadAccount: typeof loadAccountMock;
        submitTransaction: typeof submitTransactionMock;
      }) {
        this.loadAccount = loadAccountMock;
        this.submitTransaction = submitTransactionMock;
      }),
    },
  };
});

// Regression coverage for #285: bridgeViaContract (and buildAndSubmitPayment,
// which it delegates to) must build a transaction whose operation asset
// matches the caller's requested assetCode instead of silently substituting
// XLM.
describe("asset resolution honors the requested assetCode (#285)", () => {
  let capturedOperation: { asset: { isNative(): boolean; code?: string; issuer?: string } } | null;

  beforeEach(() => {
    capturedOperation = null;

    vi.mocked(freighter.signTransaction).mockImplementation(async (xdr: string) => ({
      signedTxXdr: xdr,
    }));

    loadAccountMock.mockResolvedValue({
      sequenceNumber: () => "100",
      balances: [
        { asset_type: "native", balance: "1000" },
        {
          asset_type: "credit_alphanum4",
          asset_code: "USDC",
          asset_issuer: USDC_ISSUER,
          balance: "500",
        },
      ],
    });

    submitTransactionMock.mockImplementation(async (tx: { operations: unknown[] }) => {
      capturedOperation = tx.operations[0] as typeof capturedOperation extends infer T ? NonNullable<T> : never;
      return { hash: "mock-hash", successful: true };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    loadAccountMock.mockReset();
    submitTransactionMock.mockReset();
  });

  it("builds a native XLM operation when XLM is selected", async () => {
    await buildAndSubmitPayment(G_SOURCE, G_DEST, "10", "XLM", "TESTNET");

    expect(capturedOperation).not.toBeNull();
    expect(capturedOperation?.asset.isNative()).toBe(true);
  });

  it("builds a USDC operation (not XLM) when USDC is selected", async () => {
    await buildAndSubmitPayment(G_SOURCE, G_DEST, "10", "USDC", "TESTNET");

    expect(capturedOperation).not.toBeNull();
    expect(capturedOperation?.asset.isNative()).toBe(false);
    expect(capturedOperation?.asset.code).toBe("USDC");
    expect(capturedOperation?.asset.issuer).toBe(USDC_ISSUER);
  });

  it("throws instead of substituting an asset when no trustline exists", async () => {
    await expect(
      buildAndSubmitPayment(G_SOURCE, G_DEST, "10", "SHITCOIN", "TESTNET")
    ).rejects.toThrow(/trustline/i);
  });
});

// Regression coverage for #284: classic Stellar payments cannot target a
// Soroban C-address (PaymentOp.destination has no C... encoding). bridgeViaContract
// must fail loudly and specifically instead of handing a C-address to
// Operation.payment and letting the SDK reject it with an opaque error.
describe("bridgeViaContract blocks C-address destinations honestly (#284)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws a descriptive error naming the actual problem", async () => {
    await expect(
      bridgeViaContract(G_SOURCE, C_ADDRESS, "10", "XLM", "TESTNET")
    ).rejects.toThrow(/contract address|Soroban/i);
  });

  it("never calls Operation.payment with the C-address destination", async () => {
    const paymentSpy = vi.spyOn(Operation, "payment");

    await expect(
      bridgeViaContract(G_SOURCE, C_ADDRESS, "10", "XLM", "TESTNET")
    ).rejects.toThrow();

    expect(paymentSpy).not.toHaveBeenCalled();
  });

  it("rejects invalid amounts before evaluating the destination", async () => {
    await expect(
      bridgeViaContract(G_SOURCE, C_ADDRESS, "0", "XLM", "TESTNET")
    ).rejects.toThrow(/Invalid amount/);
  });
});
