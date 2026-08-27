/**
 * API client for the C-Address Bridge backend (#498).
 *
 * Handles health checks, transaction submission, and status polling.
 */
import type { StellarNetwork } from "./types";

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
 * Distinguish if an error is service-related, wallet-related, or user error.
 */
export function classifyError(error: unknown, health: HealthStatus | null) {
  const errorStr = String(error);

  // Service errors
  if (isServiceDegraded(health)) {
    if (
      errorStr.includes('timeout') ||
      errorStr.includes('connection') ||
      errorStr.includes('network')
    ) {
      return {
        type: 'service' as const,
        message: 'Service is experiencing issues. Please try again soon.',
      };
    }
  }

  // Wallet errors
  if (
    errorStr.includes('wallet') ||
    errorStr.includes('freighter') ||
    errorStr.includes('not connected')
  ) {
    return {
      type: 'wallet' as const,
      message: 'Please check your wallet connection and try again.',
    };
  }

  // Network errors
  if (errorStr.includes('network') || errorStr.includes('offline')) {
    return {
      type: 'network' as const,
      message: 'Network issue detected. Please check your connection.',
    };
  }

  // User/validation errors
  if (
    errorStr.includes('invalid') ||
    errorStr.includes('insufficient') ||
    errorStr.includes('balance')
  ) {
    return {
      type: 'user' as const,
      message: String(error),
    };
  }

  // Default to service error if we're degraded
  if (isServiceDegraded(health)) {
    return {
      type: 'service' as const,
      message: 'An error occurred. The service may be experiencing issues.',
    };
  }

  return {
    type: 'unknown' as const,
    message: 'An unexpected error occurred. Please try again.',
  };
}
