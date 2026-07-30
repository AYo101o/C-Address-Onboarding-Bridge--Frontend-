"use client";

import { useState, useMemo } from "react";
import { CreditCard, Wallet, ExternalLink, ArrowRight, Check, DollarSign, AlertCircle } from "lucide-react";
import { isValidStellarAddress, isCAddress } from "@/lib/stellar";
import { useDebounce } from "@/hooks/useDebounce";

const MOONPAY_API_KEY = process.env.NEXT_PUBLIC_MOONPAY_API_KEY || "";
const TRANSAK_API_KEY = process.env.NEXT_PUBLIC_TRANSAK_API_KEY || "";

const providers = [
  {
    id: "moonpay",
    name: "Moonpay",
    description: "Buy with credit/debit card",
    fee: "4.5%",
    limits: "$20 - $10,000",
    currencies: ["USD", "EUR", "GBP"],
    supported: true,
    apiKey: MOONPAY_API_KEY,
    baseUrl: "https://buy.moonpay.com",
  },
  {
    id: "transak",
    name: "Transak",
    description: "Buy with card, Apple Pay, Google Pay",
    fee: "5%",
    limits: "$15 - $25,000",
    currencies: ["USD", "EUR", "GBP", "INR"],
    supported: true,
    apiKey: TRANSAK_API_KEY,
    baseUrl: "https://global.transak.com",
  },
];

export function getProviderFeeRate(providerId: string): number {
  return providerId === "moonpay" ? 0.045 : 0.05;
}

export function calculateOnrampFeeAndReceive(amount: number, providerId: string) {
  const feeRate = getProviderFeeRate(providerId);
  const fee = amount * feeRate;
  const receive = amount - fee;
  return { feeRate, fee, receive };
}

export function buildProviderUrl(p: typeof providers[number], cAddress: string, fiatAmount: string): string {
  // Defence-in-depth: re-validate inputs independently of the button's
  // disabled state / canProceed guard. These checks match the same validation
  // logic used at the UI layer (isCAddress from @/lib/stellar and the same
  // fiat-amount regex used for validAmount). If a future refactor removes or
  // weakens the UI guard, this function will still refuse to build a URL with
  // an invalid C-address or amount.
  if (!isCAddress(cAddress)) {
    throw new Error("Invalid C-address (must start with C, 56 characters, valid checksum).");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(fiatAmount)) {
    throw new Error("Invalid amount format.");
  }

  // Why URLSearchParams-based construction is safe from injection:
  //   1. Value encoding: URLSearchParams percent-encodes every param value
  //      (including &, =, #, ?, %, and all other non-unreserved characters),
  //      so an attacker-controlled value can never break out of the
  //      walletAddress= or amount= value slot and inject additional params.
  //   2. Fixed key set: all param names (apiKey, walletAddress, currencyCode,
  //      baseCurrencyAmount, baseCurrencyCode, network,
  //      defaultCryptoCurrency, defaultFiatAmount, fiatCurrency) are string
  //      literals in this file — user input is never used as a param key.
  //   3. Fixed base URL: p.baseUrl comes from the `providers` array above —
  //      hardcoded per-provider host literals — so the scheme + host are not
  //      attacker-controlled.
  // Combined with the isCAddress check above (which enforces a base32 alphabet
  // that excludes &, =, # outright), this provides two layers of defence.
  const params =
    p.id === "moonpay"
      ? new URLSearchParams({
          apiKey: p.apiKey,
          walletAddress: cAddress,
          currencyCode: "usdc_xlm",
          baseCurrencyAmount: fiatAmount,
          baseCurrencyCode: "usd",
        })
      : new URLSearchParams({
          apiKey: p.apiKey,
          walletAddress: cAddress,
          network: "stellar",
          defaultCryptoCurrency: "USDC",
          defaultFiatAmount: fiatAmount,
          fiatCurrency: "USD",
        });
  return `${p.baseUrl}?${params}`;
}

export default function OnrampPage() {
  const [cAddress, setCAddress] = useState("");
  const [fiatAmount, setFiatAmount] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("moonpay");
  const [step, setStep] = useState<"form" | "redirect">("form");
  const [error, setError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  const provider = providers.find((p) => p.id === selectedProvider);
  // Debounce address and amount validation to avoid running expensive
  // StrKey checks on every keystroke — validation fires 300 ms after the
  // user stops typing instead of on every character change.
  const debouncedCAddress = useDebounce(cAddress, 300);
  const debouncedFiatAmount = useDebounce(fiatAmount, 300);
  const validAddress = !debouncedCAddress || (isValidStellarAddress(debouncedCAddress) && isCAddress(debouncedCAddress));
  const validAmount = !debouncedFiatAmount || /^\d+(\.\d{1,2})?$/.test(debouncedFiatAmount);
  const canProceed = cAddress && fiatAmount && validAddress && validAmount && debouncedCAddress === cAddress && debouncedFiatAmount === fiatAmount;

  const { fee: feeAmount, receive: receiveAmount } = calculateOnrampFeeAndReceive(
    Number(fiatAmount) || 0,
    selectedProvider
  );

  const handleProviderRedirect = () => {
    if (!canProceed) return;
    setError(null);

    if (!provider) return;

    if (!provider.apiKey) {
      setError(`${provider.name} API key is not configured. Set NEXT_PUBLIC_${provider.id === "moonpay" ? "MOONPAY" : "TRANSAK"}_API_KEY in your environment.`);
      return;
    }

    try {
      const url = buildProviderUrl(provider, cAddress, fiatAmount);
      setRedirectUrl(url);
      setStep("redirect");
      // Open synchronously within the click handler to preserve user activation
      // so default popup blockers do not block the new tab.
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Failed to build onramp redirect URL:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to prepare provider redirect. Please double-check your input and try again."
      );
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Fiat Onramp</h1>
        <p className="text-[var(--text-muted)]">
          Buy crypto with a credit card and send it directly to a Soroban C-address.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="card p-6">
            {step === "form" && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-3">Select Provider</label>
                  <div className="grid grid-cols-2 gap-3">
                    {providers.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedProvider(p.id); setError(null); }}
                        aria-pressed={selectedProvider === p.id}
                        className={`p-4 rounded-lg border text-left transition-all ${
                          selectedProvider === p.id
                            ? "border-[var(--primary)] bg-[var(--primary)]/5"
                            : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--text-muted)]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold">{p.name}</span>
                          {selectedProvider === p.id && (
                            <Check className="w-4 h-4 text-[var(--primary)]" />
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mb-1">{p.description}</p>
                        <div className="flex gap-2 text-xs text-[var(--text-muted)]">
                          <span>Fee: {p.fee}</span>
                          <span>•</span>
                          <span>{p.limits}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="onramp-c-address" className="block text-sm font-medium mb-2">Destination C-Address</label>
                  <div className="relative">
                    <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                       id="onramp-c-address"
                       type="text"
                       value={cAddress}
                       onChange={(e) => setCAddress(e.target.value)}
                       placeholder="CABC...DEF"
                       aria-invalid={!validAddress && !!cAddress}
                       aria-describedby={!validAddress && cAddress ? "c-address-error" : undefined}
                       className="w-full pl-10 pr-4 py-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm font-mono focus:outline-none focus:border-[var(--primary)] transition-colors"
                     />
                   </div>
                   {!validAddress && debouncedCAddress && (
                     <p id="c-address-error" className="text-xs text-[var(--error)] mt-1" role="alert">Invalid C-address (must start with C, 56 characters)</p>
                   )}
                </div>

                <div>
                  <label htmlFor="onramp-fiat-amount" className="block text-sm font-medium mb-2">Amount (USD)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                       id="onramp-fiat-amount"
                       type="text"
                       value={fiatAmount}
                       onChange={(e) => setFiatAmount(e.target.value)}
                       placeholder="100.00"
                       aria-invalid={!validAmount && !!fiatAmount}
                       aria-describedby={!validAmount && fiatAmount ? "fiat-amount-error" : undefined}
                       className="w-full pl-10 pr-4 py-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--primary)] transition-colors"
                     />
                   </div>
                   {!validAmount && debouncedFiatAmount && (
                     <p id="fiat-amount-error" className="text-xs text-[var(--error)] mt-1" role="alert">Invalid amount format</p>
                   )}
                </div>

                <div className="p-4 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
                  <h4 className="text-sm font-medium mb-2">Estimated Output</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-muted)]">You pay</span>
                    <span>${fiatAmount || "0"} USD</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-[var(--text-muted)]">Fee ({provider?.fee})</span>
                    <span>
                      -${fiatAmount ? feeAmount.toFixed(2) : "0"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-[var(--text-muted)]">Est. receive</span>
                    <span className="font-semibold">
                      {fiatAmount && validAmount
                        ? `~${receiveAmount.toFixed(2)} USDC`
                        : "—"}
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="p-4 rounded-lg bg-[var(--error)]/10 border border-[var(--error)]/20 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-[var(--error)] flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-[var(--error)]">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleProviderRedirect}
                  disabled={!canProceed}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--primary)] text-white font-medium hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CreditCard className="w-4 h-4" />
                  Continue with {provider?.name}
                </button>
              </div>
            )}

            {step === "redirect" && (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-[var(--primary)]/10 flex items-center justify-center mx-auto mb-4">
                  <ExternalLink className="w-8 h-8 text-[var(--primary-light)]" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Redirecting to {provider?.name}</h3>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  A new tab has been opened to complete your purchase. Funds will be sent to your C-address.
                </p>
                {redirectUrl && (
                  <a
                    href={redirectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-[var(--primary-light)] hover:underline mb-4"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Checkout didn&apos;t open? Continue to {provider?.name}
                  </a>
                )}
                <div className="mt-4">
                  <button
                    onClick={() => { setStep("form"); setRedirectUrl(null); }}
                    className="text-sm text-[var(--primary-light)] hover:underline"
                  >
                    Go back
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold mb-3">Supported Providers</h3>
            <div className="space-y-3">
              {providers.map((p) => (
                <div key={p.id} className="p-3 rounded-lg bg-[var(--surface-2)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{p.name}</span>
                    {selectedProvider === p.id && <Check className="w-4 h-4 text-[var(--primary)]" />}
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">{p.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold mb-3">How It Works</h3>
            <ol className="space-y-3 text-sm text-[var(--text-muted)]">
              <li className="flex gap-2">
                <span className="text-[var(--primary-light)] font-medium">1.</span>
                <span>Choose your preferred fiat provider</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--primary-light)] font-medium">2.</span>
                <span>Enter your Soroban C-address</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--primary-light)] font-medium">3.</span>
                <span>Complete checkout and receive USDC</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--primary-light)] font-medium">4.</span>
                <span>Funds land directly in your smart account</span>
              </li>
            </ol>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold mb-3">Need Help?</h3>
            <p className="text-sm text-[var(--text-muted)] mb-3">
              Make sure your C-address is valid before continuing.
            </p>
            <a
              href="https://developers.stellar.org/docs/build/smart-contracts"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[var(--primary-light)] hover:underline"
            >
              Learn about Soroban addresses
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}