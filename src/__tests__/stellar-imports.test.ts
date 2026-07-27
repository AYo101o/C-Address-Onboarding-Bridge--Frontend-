// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { getHorizonServer, getSorobanRpcServer, getNetworkPassphrase } from "@/lib/stellar";

describe("Stellar SDK Imports Unification", () => {
  it("does not contain redundant dynamic import('@stellar/stellar-sdk') calls in source", () => {
    const stellarFilePath = path.resolve(__dirname, "../lib/stellar.ts");
    const sourceCode = fs.readFileSync(stellarFilePath, "utf-8");

    // Verify no internal functions dynamically import @stellar/stellar-sdk
    expect(sourceCode).not.toContain('await import("@stellar/stellar-sdk")');
    expect(sourceCode).not.toContain("await import('@stellar/stellar-sdk')");
  });

  it("returns Horizon server instance correctly", async () => {
    const server = await getHorizonServer("TESTNET");
    expect(server).toBeDefined();
    expect(server.serverURL.toString()).toContain("horizon-testnet.stellar.org");
  });

  it("returns Soroban RPC server instance correctly", async () => {
    const rpcServer = await getSorobanRpcServer("TESTNET");
    expect(rpcServer).toBeDefined();
    expect(rpcServer.serverURL.toString()).toContain("soroban-rpc-testnet.stellar.org");
  });

  it("returns network passphrase correctly", async () => {
    const publicPassphrase = await getNetworkPassphrase("PUBLIC");
    const testnetPassphrase = await getNetworkPassphrase("TESTNET");

    expect(publicPassphrase).toBe("Public Global Stellar Network ; September 2015");
    expect(testnetPassphrase).toBe("Test SDF Network ; September 2015");
  });
});
