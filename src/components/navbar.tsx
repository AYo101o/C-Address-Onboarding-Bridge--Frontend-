"use client";

/**
 * Keyboard Navigation & Accessibility (A11Y) Behavior for Mobile Menu:
 * - When mobile menu opens (mobileOpen = true), focus programmatically moves to the first interactive nav link inside the menu.
 * - Pressing 'Escape' key while menu is open closes the mobile menu.
 * - When mobile menu closes, focus is programmatically restored to the toggle button.
 * - Toggle button features proper ARIA attributes (`aria-expanded`, `aria-controls`, `aria-label`).
 * - Mobile menu container includes `id="mobile-menu"`, `role="region"`, and `aria-label="Mobile Navigation"`.
 */

import React, { memo, useState, useCallback, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, ArrowLeftRight, CreditCard, Building2, LayoutDashboard, Menu, X, AlertTriangle } from "lucide-react";
import { useWallet } from "./wallet-provider";
import { PrefetchLink } from "./prefetch-link";

const navLinks = [
  { href: "/bridge", label: "Bridge", icon: ArrowLeftRight },
  { href: "/onramp", label: "Onramp", icon: CreditCard },
  { href: "/cex", label: "CEX", icon: Building2 },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

const Navbar = () => {
  const pathname = usePathname();
  const { isConnected, address, network, connect, isConnecting, networkMismatch, dismissNetworkMismatch } = useWallet();
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const handleConnect = useCallback(() => connect(), [connect]);
  const handleMobileConnect = useCallback(() => {
    connect();
    setMobileOpen(false);
  }, [connect]);

  // Keyboard navigation: Handle Escape key to close mobile menu
  useEffect(() => {
    if (!mobileOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  // Focus management: Move focus into menu on open, return focus to toggle on close
  useEffect(() => {
    if (mobileOpen) {
      const timer = requestAnimationFrame(() => {
        const firstFocusable = mobileMenuRef.current?.querySelector<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      });
      wasOpenRef.current = true;
      return () => cancelAnimationFrame(timer);
    } else if (wasOpenRef.current) {
      toggleButtonRef.current?.focus();
      wasOpenRef.current = false;
    }
  }, [mobileOpen]);

  const addressDisplay = useMemo(() => (address ? `${address.slice(0, 4)}...${address.slice(-4)}` : null), [address]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-lg">C-Address Bridge</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <PrefetchLink
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--primary)]/10 text-[var(--primary-light)]"
                      : "text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </PrefetchLink>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {isConnected ? (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
                <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
                <span className="text-xs font-mono text-[var(--text-muted)]">{addressDisplay}</span>
                <span
                  className={`text-[0.6rem] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
                    network === "PUBLIC"
                      ? "bg-[var(--success)]/15 text-[var(--success)]"
                      : "bg-yellow-500/15 text-yellow-400"
                  }`}
                  title={`Connected to ${network === "PUBLIC" ? "Mainnet" : "Testnet"}`}
                >
                  {network === "PUBLIC" ? "Mainnet" : "Testnet"}
                </span>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-50"
              >
                <Wallet className="w-4 h-4" />
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}

            <button
              ref={toggleButtonRef}
              onClick={toggleMobile}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              className="md:hidden p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--foreground)]"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {networkMismatch && (
        <div
          role="alert"
          aria-live="assertive"
          className="border-t border-yellow-500/30 bg-yellow-500/10 px-4 py-2"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-yellow-400 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong>Network changed</strong> — Freighter is now on{" "}
                <span className="font-mono font-semibold">
                  {network === "PUBLIC" ? "Mainnet" : "Testnet"}
                </span>
                . Review any in-progress forms before continuing.
              </span>
            </div>
            <button
              onClick={dismissNetworkMismatch}
              aria-label="Dismiss network change warning"
              className="flex-shrink-0 text-yellow-400/70 hover:text-yellow-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {mobileOpen && (
        <div
          ref={mobileMenuRef}
          id="mobile-menu"
          role="region"
          aria-label="Mobile Navigation"
          className="md:hidden border-t border-[var(--border)] bg-[var(--background)]"
        >
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <PrefetchLink
                  key={link.href}
                  href={link.href}
                  onClick={closeMobile}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--primary)]/10 text-[var(--primary-light)]"
                      : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </PrefetchLink>
              );
            })}
            {!isConnected && (
              <button
                onClick={handleMobileConnect}
                disabled={isConnecting}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium"
              >
                <Wallet className="w-4 h-4" />
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default memo(Navbar);

