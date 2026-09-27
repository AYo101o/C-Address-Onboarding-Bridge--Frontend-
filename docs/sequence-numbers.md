# Sequence Number Caching Strategy

This document describes the invariant that `src/lib/sequenceManager.ts` maintains, why it matters, and how to verify it hasn't regressed.

## The invariant

`getNextSequenceNumber(accountId, server)` **always returns the next unused sequence number** — i.e. the sequence number the caller must use in the transaction they are about to build and submit.

Concretely:

| Scenario | What `getNextSequenceNumber` returns |
|---|---|
| **Cache miss** (no entry or TTL expired) | `networkSequence + 1` where `networkSequence` is the value the network currently has on record for this account. |
| **Cache hit** (within 30 s TTL) | The previously cached value **+ 1**, incremented in place before returning. |

This means the caller (typically `buildSignAndSubmit` in `src/lib/stellar.ts`) receives a value that is **directly usable** as the `sequence` argument to `new Account(sourceAddress, sequence)`. It does **not** need to add or subtract anything.

### The `Account` constructor caveat

The Stellar SDK's `Account` constructor expects the **current** on-chain sequence number, not the "next" one. Because `getNextSequenceNumber` returns the next-to-use value, the call site must subtract `1n` before passing it to `Account`:

```ts
const sequence = await getSequence();
const account = new Account(sourceAddress, (sequence - 1n).toString());
```

This subtraction is intentional and is the **only** place in the codebase where it happens. Every other consumer of the returned value uses it as-is.

## Why this matters

Stellar transactions require an exact, non-repeating sequence number. If two transactions for the same account are submitted with the same sequence number, the second one fails with `tx_bad_seq`. Worse, if the cached value drifts from what the network actually has (e.g. because another client submitted a transaction for the same account), the transaction will be rejected until the cache is invalidated and re-fetched.

The off-by-one class of bug — returning `networkSequence` instead of `networkSequence + 1`, or failing to increment on cache hits — has been a real source of incorrect behaviour. This document exists to prevent regressions.

## How the cache works

1. **First call** for an account → fetches from Horizon or Soroban RPC, stores `networkSequence + 1` with a timestamp.
2. **Subsequent calls within `CACHE_TTL_MS` (30 s)** → increments the cached value by `1n` and returns it. No network call.
3. **Calls after TTL expires** → re-fetches from network and restarts the cycle.
4. **`bad_seq` error** → `withSequenceRetry` calls `invalidateSequenceCache(accountId)`, which deletes the cache entry. The retry triggers a fresh network fetch.

## Call-site contract

Anyone calling `getNextSequenceNumber` or working with `withSequenceRetry` must preserve these rules:

- **Do not** adjust the returned value (add/subtract) except at the `Account` constructor site (`stellar.ts:349`).
- **Do not** cache the result in a local variable and submit two transactions with the same value — each call to `getNextSequenceNumber` is intended for exactly one transaction.
- **Do** call `invalidateSequenceCache(accountId)` if you know the account's sequence has been altered externally (e.g. a `tx_bad_seq` error).
- **Do** use `withSequenceRetry` for any transaction submission to get automatic bad_seq recovery.

## Regression tests

The following test suites guard this invariant:

| Test file | What it verifies |
|---|---|
| `src/__tests__/sequenceManager.test.ts` | Unit-level: cache hit increments correctly, cache miss fetches from network, TTL expiry triggers re-fetch, `invalidateSequenceCache` forces re-fetch, `withSequenceRetry` retries on bad_seq and invalidates between attempts. |
| `src/__tests__/stellar-sequence-integration.test.ts` | End-to-end: `buildAndSubmitPayment` uses consecutive, strictly-incrementing sequence numbers (100, 101) across two calls, and handles TTL expiry by re-fetching the fresh network sequence (102) without collision. |

Run both suites to verify the invariant:

```bash
npm run test -- --run src/__tests__/sequenceManager.test.ts src/__tests__/stellar-sequence-integration.test.ts
```
