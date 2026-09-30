/**
 * API client for the C-Address Bridge backend (#498).
 *
 * Handles health checks, transaction submission, and status polling.
 */
import type { BridgeTransactionData, StellarNetwork } from "./types";
import type { FeeTierStatus } from "./feeTiers";
// NOTE(ci-cleanup): without this, `Lock` silently resolved to the DOM Web Locks
// API type from lib.dom, so every lock field access failed to typecheck.
import type { Lock } from "./locks";
import type { ReferralStats } from "./referrals";

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    horizon: 'up' | 'down' | 'degraded';
    soroban_rpc: 'up' | 'down' | 'degraded';
    api: 'up' | 'down' | 'degraded';
  };
  circuitBreakers?: {
    [key: string]: {
      state: 'closed' | 'open' | 'half-open';
      failures: number;
      lastFailure?: string;
    };
  };
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.example.com';

/**
 * Fetch the current health status from the API.
 * Returns null if the request fails.
 */
export async function getHealthStatus(): Promise<HealthStatus | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as HealthStatus;
  } catch (error) {
    console.error('Failed to fetch health status:', error);
    return null;
  }
}

/**
 * Determine if a service is experiencing issues based on health status.
 */
export function isServiceDegraded(health: HealthStatus | null): boolean {
  if (!health) return false;
  return health.status === 'degraded' || health.status === 'unhealthy';
}

/**
 * Get a human-readable message about service status.
 */
export function getStatusMessage(health: HealthStatus | null): string | null {
  if (!health) return null;

  switch (health.status) {
    case 'healthy':
      return null;
    case 'degraded':
      const degradedServices = Object.entries(health.services)
        .filter(([, status]) => status !== 'up')
        .map(([name]) => name.replace(/_/g, ' '));
      return `Service degradation detected: ${degradedServices.join(', ')}. Features may be slower.`;
    case 'unhealthy':
      return 'Service is currently unavailable. Please try again later.';
    default:
      return null;
  }
}

/**
 * Error categories surfaced to the UI so callers can render a targeted
 * message instead of a generic "something went wrong".
 */
export type ErrorCategory = 'wallet' | 'network' | 'service' | 'unknown';

/**
 * Classifies an error into a coarse category for user-facing messaging.
 *
 * Classification is case-insensitive and matches on typed error names/codes
 * first, then on message substrings, so messages like "Freighter's active
 * account…" or "Network changed in Freighter…" are categorized correctly
 * rather than falling through to `unknown`.
 */
export function classifyError(error: unknown): ErrorCategory {
  const name = error instanceof Error ? error.name : '';
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const message = error instanceof Error ? error.message : String(error);
  const haystack = `${name} ${code} ${message}`.toLowerCase();

  // Wallet errors take precedence: a wallet failure can mention "network"
  // (e.g. "Network changed in Freighter") without being a network error.
  if (
    haystack.includes('wallet') ||
    haystack.includes('freighter') ||
    haystack.includes('user rejected') ||
    haystack.includes('user denied') ||
    haystack.includes('rejected by user') ||
    haystack.includes('not connected') ||
    haystack.includes('no account')
  ) {
    return 'wallet';
  }

  if (
    haystack.includes('network') ||
    haystack.includes('timeout') ||
    haystack.includes('timed out') ||
    haystack.includes('offline') ||
    haystack.includes('fetch failed') ||
    haystack.includes('failed to fetch')
  ) {
    return 'network';
  }

  if (
    haystack.includes('service') ||
    haystack.includes('unavailable') ||
    haystack.includes('horizon') ||
    haystack.includes('soroban') ||
    haystack.includes('rpc') ||
    haystack.includes('500') ||
    haystack.includes('502') ||
    haystack.includes('503')
  ) {
    return 'service';
  }

  return 'unknown';
}

export interface BatchFundingRecipient {
  address: string;
  amount: string;
}

export interface BatchFundingRecipientResult extends BatchFundingRecipient {
  success: boolean;
  /** Transaction hash, present when `success` is true. */
  hash?: string;
  /** Failure reason, present when `success` is false. */
  error?: string;
}

export interface BatchFundingResponse {
  results: BatchFundingRecipientResult[];
}

/**
 * Submits a batch of C-address funding recipients to the batch endpoint,
 * which invokes the contract's `batch_fund_c_address` on the backend (#465).
 *
 * Resolves with one result per recipient — including partial failure, where
 * some recipients succeed and others don't — as long as the request itself
 * reaches the API. Throws only when the request as a whole cannot be
 * completed (network failure, non-2xx response), since at that point no
 * per-recipient results exist to report.
 */
export async function submitBatchFunding(
  fromAddress: string,
  recipients: BatchFundingRecipient[],
  network: StellarNetwork
): Promise<BatchFundingResponse> {
  const response = await fetch(`${API_BASE_URL}/batch-fund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: fromAddress, network, recipients }),
  });

  if (!response.ok) {
    let message = `Batch funding request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body && typeof body.error === "string" && body.error) {
        message = body.error;
      }
    } catch {
      // Response body wasn't JSON (or empty) — keep the generic status message.
    }
    throw new Error(message);
  }

  return (await response.json()) as BatchFundingResponse;
}

/**
 * Timelocked funding & claims routes (#467).
 *
 * PLACEHOLDER INTERFACE: see `src/lib/locks.ts` for why — no contract source
 * or lock API route exists anywhere in this repo to build against yet. The
 * routes/status codes below (`POST /locks`, `GET /locks?recipient=`,
 * `POST /locks/:id/claim`, a 409 for an already-claimed lock) are a
 * best-guess shape and must be reconciled against the real API once it
 * lands.
 */

/** Thrown by `claimLock` when the lock was already claimed — e.g. from another device. */
export class LockAlreadyClaimedError extends Error {
  constructor(message = "This lock has already been claimed.") {
    super(message);
    this.name = "LockAlreadyClaimedError";
  }
}

async function extractApiErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body && typeof body.error === "string" && body.error) {
      return body.error;
    }
  } catch {
    // Response body wasn't JSON (or empty) — keep the generic status message.
  }
  return fallback;
}

export interface CreateLockParams {
  from: string;
  recipient: string;
  amount: string;
  asset: string;
  /** Epoch milliseconds. */
  unlockTime: number;
  network: StellarNetwork;
}

/** Creates a new timelocked transfer. */
export async function createLock(params: CreateLockParams): Promise<Lock> {
  const response = await fetch(`${API_BASE_URL}/locks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(await extractApiErrorMessage(response, `Lock creation failed (${response.status})`));
  }
  return (await response.json()) as Lock;
}

/** Lists locks incoming to `recipient` — both pending and already-claimed. */
export async function listIncomingLocks(recipient: string, network: StellarNetwork): Promise<Lock[]> {
  const response = await fetch(
    `${API_BASE_URL}/locks?recipient=${encodeURIComponent(recipient)}&network=${encodeURIComponent(network)}`
  );

  if (!response.ok) {
    throw new Error(await extractApiErrorMessage(response, `Failed to load locks (${response.status})`));
  }
  const body = (await response.json()) as { locks: Lock[] };
  return body.locks;
}

/**
 * Claims a matured lock on behalf of `claimant`. Throws
 * {@link LockAlreadyClaimedError} on a 409 response — the shape of
 * "someone else (or another session) already claimed this" — so callers can
 * distinguish it from a generic failure and reconcile their view instead of
 * just showing a retryable error.
 */
export async function claimLock(lockId: string, claimant: string, network: StellarNetwork): Promise<Lock> {
  const response = await fetch(`${API_BASE_URL}/locks/${encodeURIComponent(lockId)}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claimant, network }),
  });

  if (response.status === 409) {
    throw new LockAlreadyClaimedError(await extractApiErrorMessage(response, "This lock has already been claimed."));
  }
  if (!response.ok) {
    throw new Error(await extractApiErrorMessage(response, `Claim failed (${response.status})`));
  }
  return (await response.json()) as Lock;
}

/**
 * Fee tier preview (#468).
 *
 * PLACEHOLDER INTERFACE: see `src/lib/feeTiers.ts` for why — no contract
 * source or tier API route exists anywhere in this repo to build against
 * yet. The route (`GET /fee-tiers/preview?address=&network=`) and response
 * shape are a best-guess and must be reconciled against the real API once it
 * lands.
 *
 * Returns null both when the account has no tier data yet and when the
 * request itself fails — callers treat "no data" as "hide the tier display"
 * either way
 */
export async function getFeeTierPreview(
  address: string,
  network: StellarNetwork
): Promise<FeeTierStatus | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/fee-tiers/preview?address=${encodeURIComponent(address)}&network=${encodeURIComponent(network)}`
    );
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as FeeTierStatus;
  } catch {
    return null;
  }
}

/**
 * Referral stats (#469).
 *
 * PLACEHOLDER INTERFACE: see `src/lib/referrals.ts` for why — no contract
 * source or referral API route exists anywhere in this repo to build against
 * yet. The route (`GET /referrals?address=&network=`) and response shape are
 * a best-guess and must be reconciled against the real API once it lands.
 *
 * Returns null both when the account has no referral data yet and when the
 * request itself fails — callers treat "no data" as "hide the referral
 * display" either way.
 */
export async function getReferralStats(
  address: string,
  network: StellarNetwork
): Promise<ReferralStats | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/referrals?address=${encodeURIComponent(address)}&network=${encodeURIComponent(network)}`
    );
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as ReferralStats;
  } catch {
    return null;
  }
}

/**
 * Submits a signed transaction to the backend for relay to Horizon.
 *
 * PLACEHOLDER INTERFACE: no transaction submission route exists anywhere in
 * this repo to build against yet; the route (`POST /transactions`) and
 * response shape are a best-guess and must be reconciled against the real
 * API once it lands.
 */
export async function submitTransaction(
  signedXdr: string,
  network: StellarNetwork
): Promise<BridgeTransactionData> {
  const response = await fetch(`${API_BASE_URL}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ xdr: signedXdr, network }),
  });

  if (!response.ok) {
    throw new Error(await extractApiErrorMessage(response, `Transaction submission failed (${response.status})`));
  }
  return (await response.json()) as BridgeTransactionData;
}
