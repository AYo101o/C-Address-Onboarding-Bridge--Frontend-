import { describe, it, expect } from "vitest";
import { CEX_LIST, STELLAR_NETWORK, SOROBAN_RPC_URL, HORIZON_URL } from "@/lib/types";

describe("CEX_LIST", () => {
  it("has three exchanges", () => {
    expect(CEX_LIST).toHaveLength(3);
  });

  it("each exchange has required fields", () => {
    for (const cex of CEX_LIST) {
      expect(cex.name).toBeTruthy();
      expect(cex.logo).toBeTruthy();
      expect(cex.supportedNetworks.length).toBeGreaterThan(0);
      expect(cex.minWithdrawal).toBeTruthy();
      expect(cex.fee).toBeTruthy();
      expect(cex.withdrawalUrl).toBeTruthy();
    }
  });
});

describe("Network constants", () => {
  it("has PUBLIC and TESTNET", () => {
    expect(STELLAR_NETWORK.PUBLIC).toBe("PUBLIC");
    expect(STELLAR_NETWORK.TESTNET).toBe("TESTNET");
  });

  it("TESTNET Soroban RPC defaults to the real SDF endpoint", () => {
    // Regression: this used to be "soroban-rpc-testnet.stellar.org", a
    // hostname that never resolved. See issue #286.
    expect(SOROBAN_RPC_URL.TESTNET).toBe("https://soroban-testnet.stellar.org");
  });

  it("PUBLIC Soroban RPC is empty unless explicitly configured", () => {
    // SDF does not operate a free public mainnet Soroban RPC; getSorobanRpcServer
    // throws a clear configuration error rather than resolving to a fake hostname.
    expect(SOROBAN_RPC_URL.PUBLIC).toBe("");
  });

  it("Horizon URLs are valid", () => {
    expect(HORIZON_URL.PUBLIC).toContain("horizon.stellar.org");
    expect(HORIZON_URL.TESTNET).toContain("testnet");
  });
});
