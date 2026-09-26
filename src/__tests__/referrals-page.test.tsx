// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ReferralsPage from "@/components/routes/referrals-page";
import type { ReferralStats } from "@/lib/referrals";

/**
 * Tests for the referral dashboard (#469): the referral link/QR, the
 * referred volume/transaction count/accrued fees stats, the volume-over-time
 * chart, and the two required states — a brand new account with zero
 * referrals, and a populated one.
 *
 * `src/lib/api.ts`'s `getReferralStats` is a documented placeholder (no real
 * referral endpoint exists yet), mocked here the same way the fee-tier
 * dashboard tests mock `getFeeTierPreview`.
 */

const ADDRESS = "G" + "A".repeat(55);

vi.mock("@/components/wallet-provider", () => ({
  useWallet: () => ({
    isConnected: true,
    address: ADDRESS,
    network: "TESTNET",
    networkStatus: "TESTNET",
    walletNetworkName: "Testnet",
    isNetworkSupported: true,
    connect: vi.fn(),
    isConnecting: false,
  }),
}));

vi.mock("@/hooks/useCopyToClipboard", () => ({
  useCopyToClipboard: () => ({ status: "idle", copy: copyMock, reset: vi.fn() }),
}));

const getReferralStatsMock = vi.fn();
vi.mock("@/lib/api", () => ({
  getReferralStats: (...args: unknown[]) => getReferralStatsMock(...args),
}));

const qrToStringMock = vi.fn();
vi.mock("qrcode", () => ({
  default: { toString: (...args: unknown[]) => qrToStringMock(...args) },
}));

const copyMock = vi.fn();

afterEach(() => {
  getReferralStatsMock.mockReset();
  qrToStringMock.mockReset();
  copyMock.mockReset();
});

const EMPTY_STATS: ReferralStats = {
  referralCode: "REF-EMPTY",
  referredVolume: 0,
  referredTransactionCount: 0,
  accruedFees: 0,
  volumeOverTime: [],
};

const POPULATED_STATS: ReferralStats = {
  referralCode: "REF-ACTIVE",
  referredVolume: 4250.5,
  referredTransactionCount: 7,
  accruedFees: 12.75,
  volumeOverTime: [
    { date: "2026-08-01", volume: 1000 },
    { date: "2026-08-02", volume: 1500 },
    { date: "2026-08-03", volume: 1750.5 },
  ],
};

describe("ReferralsPage — empty state", () => {
  it("shows a meaningful empty message instead of a blank/broken chart", async () => {
    getReferralStatsMock.mockResolvedValue(EMPTY_STATS);
    qrToStringMock.mockResolvedValue("<svg data-mock-qr=\"true\"></svg>");

    render(<ReferralsPage />);

    await waitFor(() => expect(getReferralStatsMock).toHaveBeenCalledWith(ADDRESS, "TESTNET"));

    expect(await screen.findByTestId("referrals-empty-state")).toHaveTextContent(/no referrals yet/i);
    expect(screen.queryByRole("img", { name: "Referred volume over time" })).not.toBeInTheDocument();

    // Stats still render as zero, and the link/QR are still shown — a new
    // account still has a link worth sharing.
    expect(screen.getByTestId("referred-volume")).toHaveTextContent("0");
    expect(screen.getByTestId("referred-count")).toHaveTextContent("0");
    expect(screen.getByTestId("accrued-fees")).toHaveTextContent("0");
  });
});

describe("ReferralsPage — populated state", () => {
  it("shows stats and a volume-over-time chart", async () => {
    getReferralStatsMock.mockResolvedValue(POPULATED_STATS);
    qrToStringMock.mockResolvedValue("<svg data-mock-qr=\"true\"></svg>");

    render(<ReferralsPage />);

    await waitFor(() => expect(getReferralStatsMock).toHaveBeenCalledWith(ADDRESS, "TESTNET"));

    expect(await screen.findByTestId("referred-volume")).toHaveTextContent("4,250.5");
    expect(screen.getByTestId("referred-count")).toHaveTextContent("7");
    expect(screen.getByTestId("accrued-fees")).toHaveTextContent("12.75");

    expect(screen.getByRole("img", { name: "Referred volume over time" })).toBeInTheDocument();
    expect(screen.queryByTestId("referrals-empty-state")).not.toBeInTheDocument();
  });

  it("builds the referral link from the account's code and renders its QR code", async () => {
    getReferralStatsMock.mockResolvedValue(POPULATED_STATS);
    qrToStringMock.mockResolvedValue('<svg data-mock-qr="true"></svg>');

    render(<ReferralsPage />);

    const expectedLink = `${window.location.origin}/?ref=REF-ACTIVE`;
    expect(await screen.findByText(expectedLink)).toBeInTheDocument();

    await waitFor(() => expect(qrToStringMock).toHaveBeenCalledWith(expectedLink, expect.objectContaining({ type: "svg" })));
    await waitFor(() => expect(screen.getByTestId("referral-qr-svg").innerHTML).toContain("data-mock-qr"));
  });

  it("copies the referral link via the shared clipboard hook", async () => {
    getReferralStatsMock.mockResolvedValue(POPULATED_STATS);
    qrToStringMock.mockResolvedValue("<svg></svg>");

    render(<ReferralsPage />);

    const copyButton = await screen.findByRole("button", { name: "Copy referral link" });
    fireEvent.click(copyButton);

    expect(copyMock).toHaveBeenCalledWith(`${window.location.origin}/?ref=REF-ACTIVE`);
  });
});

describe("ReferralsPage — load failure", () => {
  it("shows a retry control instead of a broken/empty view", async () => {
    getReferralStatsMock.mockResolvedValue(null);

    render(<ReferralsPage />);

    expect(await screen.findByTestId("referrals-load-error")).toBeInTheDocument();

    getReferralStatsMock.mockResolvedValue(POPULATED_STATS);
    qrToStringMock.mockResolvedValue("<svg></svg>");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByTestId("referred-volume")).toHaveTextContent("4,250.5");
    expect(getReferralStatsMock).toHaveBeenCalledTimes(2);
  });
});
