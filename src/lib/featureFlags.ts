export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  defaultEnabled: boolean;
  rolloutPercentage: number; // 0-100
}
  // 1. Dev override from localStorage (only in development)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    const devOverrides = getDevOverrides();
    if (key in devOverrides) return devOverrides[key];
  }

  // 2. EnvoutPerministicHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Get or create a session ID for deterministic rollout.
 */
function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  
  let id = sessionStorage.getItem('ff_session_id');
  if (!id) {
    id = Math.random().toString(36).slice(2);
    sessionStorage.setItem('ff_session_id', id);
  }
  return id;
}

const DEV_OVERRIDES_KEY = 'ff_dev_overrides';

/**
 * Get all dev overrides from localStorage.
 *
 * Defensively validates the parsed value: if localStorage contains anything
 * other than a plain object whose values are all booleans (e.g. a JSON array,
 * a bare string, or an object with non-boolean values written by a third-party
 * script), the function degrades to `{}` rather than propagating unexpected
 * shapes into the feature-flag evaluation path. (#240)
 */
export function getDevOverrides(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};

  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DEV_OVERRIDES_KEY) ?? '{}');

    // Must be a plain, non-null object — not an array, not a primitive.
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }

    // Every value must be a boolean; anything else (number, string, object…)
    // is treated as a corrupted/unexpected entry and the whole store is reset.
    const record = parsed as Record<string, unknown>;
    for (const val of Object.values(record)) {
      if (typeof val !== 'boolean') return {};
    }

    return record as Record<string, boolean>;
  } catch {
    return {};
  }
}

/**
 * Set a dev override for a feature flag.
 *
 * Defense-in-depth: no-ops outside of the development environment regardless
 * of which call site invokes it, so callers don't need to re-add their own
 * NODE_ENV guard. (#240)
 */
export function setDevOverride(key: string, enabled: boolean): void {
  if (process.env.NODE_ENV !== 'development') return;
  if (typeof window === 'undefined') return;

  const overrides = getDevOverrides();
  overrides[key] = enabled;
  localStorage.setItem(DEV_OVERRIDES_KEY, JSON.stringify(overrides));
}

/**
 * Clear a dev override for a feature flag.
 *
 * Defense-in-depth: no-ops outside of the development environment regardless
 * of which call site invokes it. (#240)
 */
export function clearDevOverride(key: string): void {
  if (process.env.NODE_ENV !== 'development') return;
  if (typeof window === 'undefined') return;

  const overrides = getDevOverrides();
  delete overrides[key];
  localStorage.setItem(DEV_OVERRIDES_KEY, JSON.stringify(overrides));
}

/**
 * Parse feature flags from environment variables.
 * Format: flag1=true,flag2=false
 */
function parseEnvFlags(): Record<string, boolean> {
  const raw = process.env.NEXT_PUBLIC_FEATURE_FLAGS ?? '';
  if (!raw) return {};
  
  return Object.fromEntries(
    raw.split(',')
      .map(pair => pair.trim())
      .filter(pair => pair.length > 0)
      .map(pair => {
        const [k, v] = pair.split('=');
        return [k?.trim() || '', v?.trim() === 'true'] as [string, boolean];
      })
      .filter(([k]) => k.length > 0)
  );
}
