/**
 * Local (client-only) profile data for the connected wallet. (#325)
 *
 * There is no backend, so the one editable profile field — a display name — is
 * e <= 0x202e) return true;
  }
  return false;
}

export type DisplayNameValidation =
  | { ok: true; value: string }
  | { ok: false; error: string };

/** Storage key for an address. Exported so tests and docs can reference it. */
export function displayNameStorageKey(address: string): string {
  return `${STORAGE_PREFIX}${address}${NAME_SUFFIX}`;
}

/**
/** True when `value` came out of storage in a shape that is safe to render. */
export function isRenderableDisplayName(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const check = validateDisplayName(value);
  // Re-validate against the same rules, but reject anything that would have
  // been normalised on the way in — a stored value should already be trimmed.
  return check.ok && check.value === value;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Access itself throws in some privacy modes.
    return null;
  }
}

/** Reads the stored display name for `address`, or null when absent/invalid. */
export function loadDisplayName(address: string | null | undefined): string | null {
  if (!address) return null;
  const store = storage();
  if (!store) return null;
  try {
    const value = store.getItem(displayNameStorageKey(address));
    return isRenderableDisplayName(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Persists `name` for `address`. Returns false when the name is invalid or the
 * write failed (most likely a quota error), so callers can surface a message
 * instead of silently losing the edit.
 */
export function saveDisplayName(
  address: string | null | undefined,
  name: string,
): boolean {
  if (!address) return false;
  const check = validateDisplayName(name);
  if (!check.ok) return false;
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(displayNameStorageKey(address), check.value);
    return true;
  } catch {
    return false;
  }
}

/** Removes the stored display name for `address`. */
export function clearDisplayName(address: string | null | undefined): void {
  if (!address) return;
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(displayNameStorageKey(address));
  } catch {
    // Nothing useful to do — the name simply stays until storage is cleared.
  }
}

/**
 * Short form of a Stellar address for display: `GABC…WXYZ`. Falls back to the
 * whole string when it is too short to shorten meaningfully.
 */
export function shortenAddress(address: string | null | undefined): string {
  if (!address) return "";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}
