"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { connectWallet, checkConnection, getWalletAddress, getCurrentNetwork } from "@/lib/stellar";
import { APP_NETWORK, type StellarNetwork } from "@/lib/types";

interface WalletContextType {
  address: string | null;
  publicKey: string | null;
  network: StellarNetwork;
  isConnected: boolean;
  isConnecting: boolean;
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
  const [isConnecting, setIsConnecting] = useState(false);

  const updateConnection = useCallback(async () => {
    const isConnected = await checkConnection();
    if (isConnected) {
      const pk = await getWalletAddress();
      const net = await getCurrentNetwork();
      setAddress(pk);
      setNetwork(net);
    } else {
      setAddress(null);
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
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
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