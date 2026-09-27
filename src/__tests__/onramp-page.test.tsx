import { describe, it, expect } from "vitest";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import {
  calculateOnrampFeeAndReceive,
  getProviderFeeRate,
  buildProviderUrl,
} from "../components/routes/onramp-page";

const MOONPAY = {
  id: "moonpay" as const,
  name: "Moonpay",
  description: "Buy with credit/debit card",
  fee: "4.5%",
  limits: "$20 - $10,000",
  currencies: ["USD", "EUR", "GBP"],
  supported: true,
  apiKey: "test-moonpay-key",
  baseUrl: "https://buy.moonpay.com",
};

const TRANSAK = {
  id: "transak" as const,
  name: "Transak",
  description: "Buy with card, Apple Pay, Google Pay",
  fee: "5%",
  limits: "$15 - $25,000",
  currencies: ["USD", "EUR", "GBP", "INR"],
  supported: true,
  apiKey: "test-transak-key",
  baseUrl: "https://global.transak.com",
};

const VALID_FIAT = "100.00";

// Genuinely valid StrKeys constructed via the SDK — not hardcoded lookalikes.
// Mirrors the fixture pattern used in stellar.test.ts.
const keypair = Keypair.random();
const VALID_C_ADDRESS = StrKey.encodeContract(keypair.rawPublicKey());

describe("Onramp fee and estimate calculations", () => {
  it("returns correct fee rate for moonpay and transak", () => {
    expect(getProviderFeeRate("moonpay")).toBe(0.045);
    expect(getProviderFeeRate("transak")).toBe(0.05);
  });

  it("calculates fee and estimated receive correctly for Moonpay ($100)", () => {
    const { feeRate, fee, receive } = calculateOnrampFeeAndReceive(100, "moonpay");
    expect(feeRate).toBe(0.045);
    expect(fee).toBe(4.5);
    expect(receive).toBe(95.5);
    expect(fee.toFixed(2)).toBe("4.50");
    expect(receive.toFixed(2)).toBe("95.50");
  });

  it("calculates fee and estimated receive correctly for Transak ($100)", () => {
    const { feeRate, fee, receive } = calculateOnrampFeeAndReceive(100, "transak");
    expect(feeRate).toBe(0.05);
    expect(fee).toBe(5.0);
    expect(receive).toBe(95.0);
    expect(fee.toFixed(2)).toBe("5.00");
    expect(receive.toFixed(2)).toBe("95.00");
  });
});

describe("buildProviderUrl injection safety", () => {
  describe("valid inputs produce correctly structured, parsable URLs", () => {
    it("Moonpay round-trips walletAddress and preserves every param slot", () => {
      const url = buildProviderUrl(MOONPAY, VALID_C_ADDRESS, VALID_FIAT);
      const parsed = new URL(url);

      expect(parsed.origin).toBe("https://buy.moonpay.com");
      expect(parsed.protocol).toBe("https:");
      expect(parsed.searchParams.get("walletAddress")).toBe(VALID_C_ADDRESS);
      expect(parsed.searchParams.get("apiKey")).toBe(MOONPAY.apiKey);
      expect(parsed.searchParams.get("currencyCode")).toBe("usdc_xlm");
      expect(parsed.searchParams.get("baseCurrencyAmount")).toBe(VALID_FIAT);
      expect(parsed.searchParams.get("baseCurrencyCode")).toBe("usd");
      // Exactly the five moonpay params — no extras.
      expect([...parsed.searchParams.keys()]).toHaveLength(5);
    });

    it("Transak round-trips walletAddress and preserves every param slot", () => {
      const url = buildProviderUrl(TRANSAK, VALID_C_ADDRESS, VALID_FIAT);
      const parsed = new URL(url);

      expect(parsed.origin).toBe("https://global.transak.com");
      expect(parsed.searchParams.get("walletAddress")).toBe(VALID_C_ADDRESS);
      expect(parsed.searchParams.get("apiKey")).toBe(TRANSAK.apiKey);
      expect(parsed.searchParams.get("network")).toBe("stellar");
      expect(parsed.searchParams.get("defaultCryptoCurrency")).toBe("USDC");
      expect(parsed.searchParams.get("defaultFiatAmount")).toBe(VALID_FIAT);
      expect(parsed.searchParams.get("fiatCurrency")).toBe("USD");
      // Exactly the six transak params — no extras.
      expect([...parsed.searchParams.keys()]).toHaveLength(6);
    });
  });

  describe("defensive isCAddress re-check rejects malformed inputs before params are built", () => {
    // Each malicious input is a 56-char (correct-length) string whose alphabet contains a
    // URL-syntax character that isCAddress (via StrKey.isValidContract) will
    // reject because the base32 alphabet used by StrKey does not include
    // &, =, #, 0, 1, 8, 9. We use exactly the injection characters called out
    // in issue #238.
    const injectionCases: Array<[string, string]> = [
      ["ampersand attempting to inject apiKey override", "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&apiKey=X"],
      ["equals attempting to redefine walletAddress slot", "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=hacked"],
      ["hash fragment injection", "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA#fragment"],
      ["extra params injected via ampersand chaining", "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&extra=1&other=2"],
      ["percent-encoded ampersand still decoded via isCAddress rejects non-base32", "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA%26"],
    ];

    it.each(injectionCases)("Moonpay: rejects cAddress with %s", (_, bad) => {
      expect(() => buildProviderUrl(MOONPAY, bad, VALID_FIAT)).toThrow(/Invalid C-address/);
    });

    it.each(injectionCases)("Transak: rejects cAddress with %s", (_, bad) => {
      expect(() => buildProviderUrl(TRANSAK, bad, VALID_FIAT)).toThrow(/Invalid C-address/);
    });

    it("rejects a G-address (Ed25519 pubkey) instead of a C-address", () => {
      const gAddr = keypair.publicKey();
      expect(() => buildProviderUrl(MOONPAY, gAddr, VALID_FIAT)).toThrow(/Invalid C-address/);
      expect(() => buildProviderUrl(TRANSAK, gAddr, VALID_FIAT)).toThrow(/Invalid C-address/);
    });

    it("rejects a short C-prefixed string", () => {
      expect(() => buildProviderUrl(MOONPAY, "CABC", VALID_FIAT)).toThrow(/Invalid C-address/);
    });
  });

  describe("defensive fiat-amount re-check rejects malformed amounts", () => {
    it("rejects non-numeric and overly-precise amounts", () => {
      const badAmounts = ["", "abc", "1.234", "-5", "1.", "1,00", "1e2"];
      for (const bad of badAmounts) {
        expect(() => buildProviderUrl(MOONPAY, VALID_C_ADDRESS, bad)).toThrow(/Invalid amount format/);
        expect(() => buildProviderUrl(TRANSAK, VALID_C_ADDRESS, bad)).toThrow(/Invalid amount format/);
      }
    });
  });

  describe("URLSearchParams encoding safety (belt-and-suspenders)", () => {
    // Even if a future change relaxed the validation above, URLSearchParams
    // must keep a malicious value confined to its own slot. This asserts
    // the encoding behaviour the inline comment documents.
    it("encodes &, =, # in values without altering other query params", () => {
      const injection = "VALID_C_ADDRESS_PLACEHOLDER&apiKey=OVERRIDE&x=y";
      const params = new URLSearchParams({
        apiKey: MOONPAY.apiKey,
        walletAddress: injection,
        currencyCode: "usdc_xlm",
        baseCurrencyAmount: VALID_FIAT,
        baseCurrencyCode: "usd",
      });

      // The walletAddress param still reads back EXACTLY the original injection — it
      // was never split or interpreted.
      expect(params.get("walletAddress")).toBe(injection);
      // apiKey still reads the original safe value — not the override attempt.
      expect(params.get("apiKey")).toBe(MOONPAY.apiKey);
      // No extra named params sprung into existence despite the injection string
      // containing `&x=y` / `&apiKey=OVERRIDE`.
      expect(params.getAll("x")).toEqual([]);
      expect(params.getAll("apiKey")).toEqual([MOONPAY.apiKey]);
      // & and = inside the value are percent-encoded in the serialized form.
      const serialized = params.toString();
      expect(serialized).toContain("%26");
      expect(serialized).not.toContain("apiKey=OVERRIDE");
    });
  });
});
