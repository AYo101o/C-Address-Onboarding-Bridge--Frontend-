import { describe, it, expect } from "vitest";
import { calculateOnrampFeeAndReceive, getProviderFeeRate } from "../components/routes/onramp-page";

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
