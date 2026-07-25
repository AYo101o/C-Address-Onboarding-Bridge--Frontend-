import { describe, it, expect } from "vitest";
import { isValidStellarAddress, isValidStellarAmount, isCAddress, isGAddress } from "@/lib/stellar";

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
