/**
 * Referral program — types and pure display logic (#469).
 *
 * PLACEHOLDER INTERFACE: this repo vendors neither the referral-attribution
 * contract bindings nor a real API client for referral statistics yet (no
 * contract source, no referral-related route, nothing in docs — checked
 * before writing this, the same way #465's batch cap, #467's lock/claim
 * shape, #468's fee-tier preview, and #470's export endpoint were). Field
 * names and the API route in `src/lib/api.ts` are a best-guess shape and
 * MUST be reconciled against the real contract/API once available.
 *
 * The shareable referral link is built client-side from `referralCode`
 * rather than returned whole by the API — that keeps the placeholder
 * endpoint from needing to know the frontend's own origin.
 */
export interface ReferralVolumePoint {
  /** ISO date, e.g. "2026-08-01". */
  date: string;
  /** Referred volume attributed to this account on this day, in the quoted asset. */
  volume: number;
}

export interface ReferralStats {
  /** This account's referral code; combined with the app origin to build the shareable link. */
  referralCode: string;
  /** Cumulative volume referred by this account, in the quoted asset. */
  referredVolume: number;
  /** Number of referred transactions. */
  referredTransactionCount: number;
  /** Cumulative referral fees accrued to this account, in the quoted asset. */
  accruedFees: number;
  /** Daily referred-volume series, ascending by date, for the dashboard chart. */
  volumeOverTime: ReferralVolumePoint[];
}

/**
 * True once the account has at least one referred transaction. A brand new
 * account's `volumeOverTime` is all zeros, so this — not an empty array
 * check — is what the empty state renders on (#469 requirement 5: show a
 * meaningful message instead of a blank/broken chart).
 */
export function hasReferralActivity(stats: Pick<ReferralStats, "referredTransactionCount">): boolean {
  return stats.referredTransactionCount > 0;
}

/** Builds the shareable referral link from the account's code and the app's own origin. */
export function buildReferralLink(referralCode: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}/?ref=${encodeURIComponent(referralCode)}`;
}

/** Compact amount display, e.g. "1,234.56". */
export function formatReferralAmount(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Short display label for a volume point's date, e.g. "Aug 1". */
export function formatReferralDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
