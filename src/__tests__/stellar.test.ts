import { describe, it, expect } from "vitest";
import { isValidStellarAddress, isCAddress, isGAddress } from "@/lib/stellar";

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

  it("rejects pipe symbol prefix", () => {
    const addr = "|" + G_ADDRESS.slice(1);
    expect(isValidStellarAddress(addr)).toBe(false);
  });

  it("rejects non-Base32 digits (0, 1, 8, 9)", () => {
    const withZero = G_ADDRESS.slice(0, 10) + "0" + G_ADDRESS.slice(11);
    const withOne = G_ADDRESS.slice(0, 10) + "1" + G_ADDRESS.slice(11);
    const withEight = G_ADDRESS.slice(0, 10) + "8" + G_ADDRESS.slice(11);
    const withNine = G_ADDRESS.slice(0, 10) + "9" + G_ADDRESS.slice(11);

    expect(isValidStellarAddress(withZero)).toBe(false);
    expect(isValidStellarAddress(withOne)).toBe(false);
    expect(isValidStellarAddress(withEight)).toBe(false);
    expect(isValidStellarAddress(withNine)).toBe(false);
  });

  it("rejects lowercase letters", () => {
    const lowercase = G_ADDRESS.toLowerCase();
    expect(isValidStellarAddress(lowercase)).toBe(false);
  });
});

describe("isCAddress", () => {
  it("detects valid C-address", () => {
    expect(isCAddress(C_ADDRESS)).toBe(true);
  });

  it("rejects G-address", () => {
    expect(isCAddress(G_ADDRESS)).toBe(false);
  });

  it("rejects short address", () => {
    expect(isCAddress("CABC")).toBe(false);
  });

  it("rejects C-address with non-Base32 digits", () => {
    const withEight = C_ADDRESS.slice(0, 10) + "8" + C_ADDRESS.slice(11);
    expect(isCAddress(withEight)).toBe(false);
  });
});

describe("isGAddress", () => {
  it("detects valid G-address", () => {
    expect(isGAddress(G_ADDRESS)).toBe(true);
  });

  it("rejects C-address", () => {
    expect(isGAddress(C_ADDRESS)).toBe(false);
  });

  it("rejects G-address with non-Base32 digits", () => {
    const withNine = G_ADDRESS.slice(0, 10) + "9" + G_ADDRESS.slice(11);
    expect(isGAddress(withNine)).toBe(false);
  });
});
