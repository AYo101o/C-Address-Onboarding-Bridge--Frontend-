# feat: Add Max button to Bridge amount field and network-mismatch warning banner

## Summary

This PR ships two related UX features that close gaps in the onboarding flow:

1. **#254 — Max button** on the Bridge amount input, which fills the field with the full spendable balance (total minus the XLM minimum reserve) at Stellar's 7-decimal precision.
2. **#255 — Network-mismatch warning banner** in the navbar, which surfaces a persistent, dismissible alert whenever Freighter's active network changes mid-session, and shows a permanent network badge next to the connected-address pill so users always know which network they are on.

---

## Changes

### `src/app/bridge/page.tsx` — #254

- Added an absolutely-positioned **Max** button inside the amount `<input>` wrapper.
- The button is rendered only when `spendableBalance > 0` and `txStatus === "idle"` (hidden during signing/submitting and when balance is unknown).
- On click, sets `amount` to `Math.max(spendableBalance, 0).toFixed(7)`, which already accounts for the `getAccountMinimumBalance()` deduction applied in the existing `spendableBalance` derivation — so clicking Max never triggers the insufficient-balance error for the value it fills in.
- Uses `aria-label="Fill maximum available balance"` for screen-reader accessibility.

### `src/components/wallet-provider.tsx` — #255

- Added `networkMismatch: boolean` and `dismissNetworkMismatch: () => void` to `WalletContextType` and the provider value.
- Introduced `initialNetworkRef` — a `useRef` that records the network at the moment of the first connection (either via explicit `connect()` or via the polling `updateConnection` on page load). This is the baseline for change detection.
- In `updateConnection`, after the first baseline is set, any subsequent poll that returns a *different* network sets `networkMismatch = true` and updates the baseline to the new network (so a further change will fire again, but repeated polls on the same new network won't spam the state).
- `dismissNetworkMismatch` sets a `dismissedRef` flag so subsequent polls on the same changed network don't re-show the banner; the ref resets on disconnect or re-connect.
- `connect()` and `disconnect()` both reset `initialNetworkRef`, `dismissedRef`, and `networkMismatch` so the state is clean across reconnections.

### `src/components/navbar.tsx` — #255

- Added `AlertTriangle` to the Lucide import.
- Destructures `network`, `networkMismatch`, and `dismissNetworkMismatch` from `useWallet()`.
- **Network badge**: added a pill label (`Mainnet` / `Testnet`) next to the connected-address indicator in the desktop nav bar. Green-tinted on Mainnet, yellow-tinted on Testnet to match the visual weight of the network.
- **Mismatch banner**: rendered between the main navbar row and the mobile menu when `networkMismatch` is true. Uses `role="alert"` and `aria-live="assertive"` so screen readers announce it immediately. Contains the new network name and a dismiss button (`X` icon with `aria-label`).

---

## Behaviour in detail

### Max button (#254)

| State | Button visible? |
|---|---|
| `sourceBalances` not yet loaded | No |
| `spendableBalance <= 0` (reserve eats everything) | No |
| `txStatus !== "idle"` (signing / submitting) | No |
| Balance known and `txStatus === "idle"` | **Yes** |

Clicking always fills a value ≤ `spendableBalance`, so the insufficient-balance validation never fires for that value.

### Network-mismatch banner (#255)

| Event | Banner state |
|---|---|
| App loads, wallet already connected on Testnet | No banner; baseline = Testnet |
| User switches Freighter to Mainnet mid-session | **Banner appears** |
| User dismisses banner | Banner hidden; dismissedRef = true |
| Further switch to a third network | **Banner re-appears** (dismissedRef resets to false only on disconnect/reconnect) |
| User disconnects wallet | Banner hidden; all state reset |
| User reconnects wallet | Banner hidden; baseline resets to new connection's network |

---

## Testing

- TypeScript: `npm run typecheck` — no new errors introduced (all pre-existing errors in `__tests__/` and unrelated components are unchanged).
- Manual: load the Bridge page with a funded G-address → Max button appears and fills the correct reserve-adjusted amount → the insufficient-balance warning does not fire.
- Manual: switch Freighter's network while the app is open → yellow banner appears in the navbar with the new network name → dismiss works → badge always shows the current network.

---

## Files changed

```
src/app/bridge/page.tsx
src/components/navbar.tsx
src/components/wallet-provider.tsx
```

---

Closes #254
Closes #255
