"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { connectWallet, checkConnection, getWalletAddress, getCurrentNetwork } from "@/lib/stellar";
import type { StellarNetwork } from "@/lib/types";

interface WalletContextType {
  address: string | null;
  publicKey: string | null;
  network: StellarNetwork;
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
  const [network, setNetwork] = useState<StellarNetwork>("TESTNET");
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

  const dismissNetworkMismatch = useCallback(() => {
    dismissedRef.current = true;
    setNetworkMismatch(false);
  }, []);

  const updateConnection = useCallback(async () => {
    const isConnected = await checkConnection();
    if (isConnected) {
      const pk = await getWalletAddress();
      const net = await getCurrentNetwork();
      setAddress(pk);
      setNetwork(net);

      if (initialNetworkRef.current === null) {
        // First time we see the wallet connected — record the baseline network.
        initialNetworkRef.current = net;
      } else if (!dismissedRef.current && net !== initialNetworkRef.current) {
        // Network changed after initial connection → surface warning.
        setNetworkMismatch(true);
        // Update the baseline so subsequent same-network polls don't re-fire,
        // but a *further* change will fire again.
        initialNetworkRef.current = net;
      }
    } else {
      setAddress(null);
      // Reset mismatch tracking when wallet disconnects.
      initialNetworkRef.current = null;
      dismissedRef.current = false;
      setNetworkMismatch(false);
    }
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const pk = await connectWallet();
      if (pk) {
        setAddress(pk);
        const net = await getCurrentNetwork();
        setNetwork(net);
        // Record the network at the point of explicit connection so we can
        // detect changes later in the polling loop.
        initialNetworkRef.current = net;
        dismissedRef.current = false;
        setNetworkMismatch(false);
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    initialNetworkRef.current = null;
    dismissedRef.current = false;
    setNetworkMismatch(false);
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