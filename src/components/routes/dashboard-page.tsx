"use client";

import { useState, useEffect } from "react";
import { Wallet, ArrowLeftRight, CreditCard, Building2, Copy, Check, ExternalLink, Plus, Loader2, X } from "lucide-react";
import { useWallet } from "@/components/wallet-provider";
import TransactionHistory from "@/components/transaction-history";
import Link from "next/link";
import { getAccountBalances, fetchRecentTransactions, getExplorerUrl } from "@/lib/stellar";
import type { BridgeTransactionData as BridgeTransaction } from "@/lib/stellar";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

// Content check for the 30s poll: transaction fields are derived from
// immutable Horizon records, so the only meaningful changes are which
// transactions exist (id) and their status. When nothing changed we keep the
// previous array reference so memoized <TransactionHistory> can skip its
// re-render entirely.
function areTransactionsEqual(a: BridgeTransaction[], b: BridgeTransaction[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].status !== b[i].status) return false;
  }
  return true;
}

export default function DashboardPage() {
  const { isConnected, address, network, connect } = useWallet();
  const { status: copyStatus, copy: copyToClipboard } = useCopyToClipboard();
  const [balance, setBalance] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<BridgeTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address) return;
    // Ignore results from any fetch that was in flight when this effect
    // re-ran (e.g. a rapid network switch). Without this, a slow response
    // for the previous network could overwrite fresh data for the current one.
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [balResult, txResult] = await Promise.all([
          getAccountBalances(address, network),
          fetchRecentTransactions(address, network, 10),
        ]);
        if (cancelled) return;
        setBalance(balResult.total);
        // Reuse the previous reference when nothing changed so React bails out
        // of re-rendering the memoized transaction list.
        setTransactions((prev) => (areTransactionsEqual(prev, txResult) ? prev : txResult));
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to fetch data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isConnected, address, network]);

  const confirmedCount = transactions.filter((t) => t.status === "confirmed").length;
  const pendingCount = transactions.filter((t) => t.status === "pending").length;

  const handleCopy = () => {
    if (!address) return;
    copyToClipboard(address);
  };

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--primary)]/10 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-[var(--primary-light)]" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Connect Your Wallet</h1>
          <p className="text-[var(--text-muted)] mb-6">
            Connect your Freighter wallet to view your dashboard.
          </p>
          <button
            onClick={connect}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--primary)] text-white font-medium hover:bg-[var(--primary)]/90 transition-colors"
          >
            <Wallet className="w-4 h-4" />
            Connect Freighter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-[var(--text-muted)]">Manage your C-address funding activity</p>
        </div>
        <Link
          href="/bridge"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary)]/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Bridge
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-[var(--primary-light)]" />
            <span className="text-xs text-[var(--text-muted)]">Connected Address</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono">
              {address?.slice(0, 8)}...{address?.slice(-8)}
            </code>
            <button
              onClick={handleCopy}
              title={copyStatus === "error" ? "Copy failed — check clipboard permissions" : "Copy address"}
              className="p-1 rounded hover:bg-[var(--surface-2)] transition-colors"
            >
              {copyStatus === "copied" ? (
                <Check className="w-3 h-3 text-[var(--success)]" />
              ) : copyStatus === "error" ? (
                <X className="w-3 h-3 text-[var(--error,#ef4444)]" />
              ) : (
                <Copy className="w-3 h-3 text-[var(--text-muted)]" />
              )}
            </button>
            {copyStatus === "error" && (
              <span className="text-xs text-[var(--error,#ef4444)]">Copy failed</span>
            )}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            {network === "PUBLIC" ? "Mainnet" : "Testnet"}
            {address && (
              <a
                href={getExplorerUrl(network, "account", address)}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-[var(--primary-light)] hover:underline inline-flex items-center gap-0.5"
              >
                <ExternalLink className="w-3 h-3" />
                View
              </a>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="text-xs text-[var(--text-muted)] mb-1">XLM Balance</div>
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none text-[var(--text-muted)]" />
              <span className="text-xs text-[var(--text-muted)]">Loading...</span>
            </div>
          ) : (
            <>
              <div className="text-2xl font-bold mb-1">
                {balance !== null ? parseFloat(balance).toFixed(2) : "—"}
              </div>
              <div className="text-xs text-[var(--text-muted)]">XLM</div>
            </>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="text-xs text-[var(--text-muted)] mb-1">Transactions</div>
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none text-[var(--text-muted)]" />
              <span className="text-xs text-[var(--text-muted)]">Loading...</span>
            </div>
          ) : (
            <>
              <div className="text-2xl font-bold mb-1">{transactions.length}</div>
              <div className="text-xs text-[var(--text-muted)]">
                {confirmedCount} confirmed{pendingCount > 0 ? `, ${pendingCount} pending` : ""}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Link
          href="/bridge"
          className="flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] card-hover"
        >
          <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5 text-[var(--primary-light)]" />
          </div>
          <div>
            <p className="text-sm font-medium">G → C Bridge</p>
            <p className="text-xs text-[var(--text-muted)]">Fund from G-address</p>
          </div>
        </Link>

        <Link
          href="/onramp"
          className="flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] card-hover"
        >
          <div className="w-10 h-10 rounded-lg bg-[var(--secondary)]/10 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-[var(--secondary)]" />
          </div>
          <div>
            <p className="text-sm font-medium">Fiat Onramp</p>
            <p className="text-xs text-[var(--text-muted)]">Buy with card</p>
          </div>
        </Link>

        <Link
          href="/cex"
          className="flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] card-hover"
        >
          <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div>
            <p className="text-sm font-medium">CEX Withdrawal</p>
            <p className="text-xs text-[var(--text-muted)]">Route exchange funds</p>
          </div>
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-[var(--error)]/10 border border-[var(--error)]/20 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      <TransactionHistory transactions={transactions} loading={loading} network={network} />
    </div>
  );
}
