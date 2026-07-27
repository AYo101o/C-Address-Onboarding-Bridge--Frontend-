import { describe, it, expect } from "vitest";
import { useWallet } from "../components/wallet-provider";

describe("useWallet", () => {
  it("throws an error when called outside of WalletProvider", () => {
    expect(() => {
      useWallet();
    }).toThrow("useWallet must be used within a WalletProvider");
  });
});
