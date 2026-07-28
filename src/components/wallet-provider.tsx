"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { connectWallet, checkConnection, getWalletAddress, getWalletNetwork } from "@/lib/stellar";
import { APP_NETWORK, isSupportedNetwork, type StellarNetwork, type WalletNetworkState } from "@/lib/types";

interface WalletContextType {
  address: string | null;
  publicKey: string | null;
  /**
   * The network the app targets for Horizon/Soroban endpoints. Only ever a
   * network the app supports — it holds its previous value (or APP_NETWORK)
   * while the wallet is on an unsupported/unreadable network, which is why
   * `networkStatus` must be consulted before building any transaction. (#289)
   */
  network: StellarNetwork;
  /** The wallet's actual network state, including UNSUPPORTED/UNKNOWN. (#289) */
  networkStatus: WalletNetworkState;
  /** Raw network name Freighter reported, e.g. "FUTURENET". Null if unreadable. */
  walletNetworkName: string | null;
  /** True when the wallet is on a network the app can transact on. */
  isNetworkSupported: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  /** True when the network changed mid-session (after initial connection). */
  networkMismatch: boolean;
  /** Call to dismiss the network-mismatch banner for the current session. */
  dismissNetworkMismatch: () => void;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

/** Polling intervals in milliseconds. */
const FAST_INTERVAL = 3000;
const SLOW_INTERVAL = 10000;
/** Time before backing off from fast to slow interval. */
const BACKOFF_THRESHOLD_MS = 30000;

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  // Use APP_NETWORK as the initial/disconnected network so the app targets the
  // correct Horizon and Soroban RPC endpoints before a wallet is connected.
  // NEXT_PUBLIC_STELLAR_NETWORK drives this value at build time. (#302)
  const [network, setNetwork] = useState<StellarNetwork>(APP_NETWORK);
  /**
   * The wallet's reported network state. Starts at APP_NETWORK because no
   * wallet has been queried yet; once a wallet is seen this can widen to
   * UNSUPPORTED/UNKNOWN, which gates transaction building. (#289)
   */
  const [networkStatus, setNetworkStatus] = useState<WalletNetworkState>(APP_NETWORK);
  const [walletNetworkName, setWalletNetworkName] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  /**
   * `networkMismatch` is true when the network changed after the initial
   * connection was established. It's reset to false on:
   *   - disconnect (address becomes null)
   *   - explicit dismissal via dismissNetworkMismatch()
   */
  const [networkMismatch, setNetworkMismatch] = useState(false);
  /**
   * The network that was active at connection time. Used to detect changes.
   * null means no connection has been established yet this session.
   */
  const initialNetworkRef = useRef<"PUBLIC" | "TESTNET" | null>(null);
  /** Whether the user has dismissed the mismatch banner for this session. */
  const dismissedRef = useRef(false);
  /**
   * Sticky record of the user having pressed Disconnect. The poller runs every
   * few seconds and would otherwise re-set the address straight back from
   * Freighter, silently undoing the disconnect. (#288)
   */
  const manuallyDisconnectedRef = useRef(false);

  const dismissNetworkMismatch = useCallback(() => {
    dismissedRef.current = true;
    setNetworkMismatch(false);
  }, []);

  /**
   * Applies a freshly-read wallet network. `network` (the endpoint target) is
   * only moved to networks the app supports; UNSUPPORTED/UNKNOWN are surfaced
   * through `networkStatus` so callers block rather than transact on a guess.
   */
  const applyNetwork = useCallback((status: WalletNetworkState, name: string | null) => {
    setNetworkStatus(status);
    setWalletNetworkName(name);
    if (isSupportedNetwork(status)) {
      setNetwork(status);
    }
    return status;
  }, []);

  const updateConnection = useCallback(async () => {
    // Respect an explicit disconnect until the user reconnects. (#288)
    if (manuallyDisconnectedRef.current) return;

    const isConnected = await checkConnection();
    if (isConnected) {
      const pk = await getWalletAddress();
      const { status, name } = await getWalletNetwork();
      setAddress(pk);
      applyNetwork(status, name);

      // Mismatch tracking only makes sense between two supported networks; an
      // unsupported/unknown network gets its own, louder notice instead.
      if (!isSupportedNetwork(status)) return;

      if (initialNetworkRef.current === null) {
        // First time we see the wallet connected — record the baseline network.
        initialNetworkRef.current = status;
      } else if (!dismissedRef.current && status !== initialNetworkRef.current) {
        // Network changed after initial connection → surface warning.
        setNetworkMismatch(true);
        // Update the baseline so subsequent same-network polls don't re-fire,
        // but a *further* change will fire again.
        initialNetworkRef.current = status;
      }
    } else {
      setAddress(null);
      // Reset mismatch tracking when wallet disconnects.
      initialNetworkRef.current = null;
      dismissedRef.current = false;
      setNetworkMismatch(false);
      setNetworkStatus(APP_NETWORK);
      setWalletNetworkName(null);
    }
  }, [applyNetwork]);

  const connect = useCallback(async () => {
    // An explicit connect clears the sticky disconnect so polling resumes. (#288)
    manuallyDisconnectedRef.current = false;
    setIsConnecting(true);
    try {
      const pk = await connectWallet();
      if (pk) {
        setAddress(pk);
        const { status, name } = await getWalletNetwork();
        applyNetwork(status, name);
        // Record the network at the point of explicit connection so we can
        // detect changes later in the polling loop.
        initialNetworkRef.current = isSupportedNetwork(status) ? status : null;
        dismissedRef.current = false;
        setNetworkMismatch(false);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [applyNetwork]);

  const disconnect = useCallback(() => {
    manuallyDisconnectedRef.current = true;
    setAddress(null);
    initialNetworkRef.current = null;
    dismissedRef.current = false;
    setNetworkMismatch(false);
    setNetworkStatus(APP_NETWORK);
    setWalletNetworkName(null);
  }, []);

  // Polling with backoff + visibility awareness
  useEffect(() => {
    let fastTimer: ReturnType<typeof setTimeout> | null = null;
    let slowTimer: ReturnType<typeof setTimeout> | null = null;
    let backoffTimer: ReturnType<typeof setTimeout> | null = null;
    let isFast = true;

    const clearAllTimers = () => {
      if (fastTimer) clearTimeout(fastTimer);
      if (slowTimer) clearTimeout(slowTimer);
      if (backoffTimer) clearTimeout(backoffTimer);
    };

    const scheduleNext = () => {
      clearAllTimers();
      const delay = isFast ? FAST_INTERVAL : SLOW_INTERVAL;
      const timer = setTimeout(() => {
        updateConnection().finally(scheduleNext);
      }, delay);
      if (isFast) {
        fastTimer = timer;
      } else {
        slowTimer = timer;
      }
    };

    const startBackoff = () => {
      if (backoffTimer) clearTimeout(backoffTimer);
      backoffTimer = setTimeout(() => {
        isFast = false;
        // reschedule immediately so the next tick uses the slower interval
        scheduleNext();
      }, BACKOFF_THRESHOLD_MS);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden: pause all polling
        clearAllTimers();
      } else {
        // Tab visible again: reset to fast interval, check immediately,
        // then start the backoff timer fresh.
        isFast = true;
        updateConnection().finally(() => {
          startBackoff();
          scheduleNext();
        });
      }
    };

    // Initial check + start fast polling
    updateConnection().finally(() => {
      startBackoff();
      scheduleNext();
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearAllTimers();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [updateConnection]);

  return (
    <WalletContext.Provider
      value={{
        address,
        publicKey: address,
        network,
        networkStatus,
        walletNetworkName,
        isNetworkSupported: isSupportedNetwork(networkStatus),
        isConnected: !!address,
        isConnecting,
        networkMismatch,
        dismissNetworkMismatch,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}