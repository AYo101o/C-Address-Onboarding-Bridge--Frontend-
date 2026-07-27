import {
  isConnected,
  getAddress,
  signTransaction,
  getNetwork,
} from "@stellar/freighter-api";
import {
  TransactionBuilder,
  Operation,
  BASE_FEE,
  Networks,
  Asset,
  Horizon,
  rpc,
  Account,
  StrKey,
} from "@stellar/stellar-sdk";
import { BRIDGE_CONTRACT_ID, HORIZON_URL, SOROBAN_RPC_URL, type StellarNetwork } from "./types";
import { withSequenceRetry } from "./sequenceManager";

export async function getHorizonServer(network: StellarNetwork): Promise<Horizon.Server> {
  const { Horizon } = await import("@stellar/stellar-sdk");
  return new Horizon.Server(HORIZON_URL[network]);
}

export async function getSorobanRpcServer(network: StellarNetwork): Promise<rpc.Server> {
  const url = SOROBAN_RPC_URL[network];
  if (!url) {
    throw new Error(
      `No Soroban RPC URL configured for ${network}. Set NEXT_PUBLIC_SOROBAN_RPC_URL_${network} in your environment.`
    );
  }
  const { rpc } = await import("@stellar/stellar-sdk");
  return new rpc.Server(url);
}

export async function getNetworkPassphrase(network: StellarNetwork): Promise<string> {
  const { Networks } = await import("@stellar/stellar-sdk");
  return network === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET;
}

export async function connectWallet(): Promise<string | null> {
  try {
    const conn = await isConnected();
    if (!conn.isConnected) {
      throw new Error("Freighter not detected");
    }
    const addr = await getAddress();
    return addr.address;
  } catch (e) {
    console.error("Failed to connect wallet:", e);
    return null;
  }
}

export async function checkConnection(): Promise<boolean> {
  try {
    const result = await isConnected();
    return result.isConnected;
  } catch {
    return false;
  }
}

export async function getWalletAddress(): Promise<string | null> {
  try {
    const result = await getAddress();
    return result.address;
  } catch {
    return null;
  }
}

export async function getCurrentNetwork(): Promise<StellarNetwork> {
  try {
    const result = await getNetwork();
    const networkName = String(result.network ?? "").toUpperCase();
    return networkName === "PUBLIC" ? "PUBLIC" : "TESTNET";
  } catch {
    return "TESTNET";
  }
}

// Validate against the SDK's StrKey, which enforces the correct base32
// alphabet (A-Z, 2-7 — no 0/1/8/9) and the trailing CRC16 checksum. A
// hand-rolled regex cannot verify the checksum and, as [G|C] showed, is easy
// to get subtly wrong (that character class also accepted a leading '|').
export function isValidStellarAddress(address: string): boolean {
  return StrKey.isValidEd25519PublicKey(address) || StrKey.isValidContract(address);
}

export function isValidStellarAmount(amount: string): boolean {
  if (!amount || typeof amount !== "string") return false;
  if (!/^\d+(\.\d{1,7})?$/.test(amount)) return false;
  const num = Number(amount);
  return !isNaN(num) && num > 0;
}

export function isCAddress(address: string): boolean {
  return StrKey.isValidContract(address);
}

export function isGAddress(address: string): boolean {
  return StrKey.isValidEd25519PublicKey(address);
}

export interface PaymentResult {
  hash: string;
  successful: boolean;
}

export interface AccountBalances {
  total: string;
  balances: { asset: string; amount: string }[];
  /** True when the account does not exist on-chain (unfunded). (#293) */
  unfunded?: boolean;
}

export interface BridgeTransactionData {
  id: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  asset: string;
  status: "pending" | "confirmed" | "failed";
  timestamp: number;
  type: "g-to-c" | "fiat" | "cex";
  hash?: string;
  memo?: string;
}

interface HorizonBalance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
}

interface HorizonPayment {
  id: string;
  type?: string;
  from?: string;
  to?: string;
  /** Present on payment operations. Absent on create_account operations. (#294) */
  amount?: string;
  /** Starting balance funded to a new account via create_account. (#294) */
  starting_balance?: string;
  asset_type?: string;
  asset_code?: string;
  /**
   * May be absent on older Horizon responses.  When missing we treat the
   * transaction as pending rather than confirmed or failed. (#294)
   */
  transaction_successful?: boolean;
  created_at?: string;
  transaction_hash?: string;
  funder?: string;
  account?: string;
}

/**
 * Short-lived shared cache for account balances, keyed on `address:network`.
 *
 * Both the Bridge page ("Use connected wallet" check) and the Dashboard
 * (mount + 30s poll) fetch balances for the same connected address. Without a
 * shared cache, navigating between these pages triggers a fresh Horizon
 * round-trip even when the data was fetched seconds earlier.
 *
 * The TTL is deliberately short: staleness is bounded to BALANCE_CACHE_TTL_MS,
 * and it stays well under the Dashboard's 30s poll interval so the poll still
 * refetches fresh data on every tick. Entries store the in-flight promise, so
 * concurrent callers within the window share a single request; failed fetches
 * are evicted so the fallback value is never served from cache.
 */
const BALANCE_CACHE_TTL_MS = 10_000; // 10 seconds

interface BalanceCacheEntry {
  promise: Promise<AccountBalances>;
  fetchedAt: number;
}

const balanceCache = new Map<string, BalanceCacheEntry>();

async function loadAccountBalances(
  address: string,
  network: StellarNetwork
): Promise<AccountBalances> {
  const server = await getHorizonServer(network);
  const account = await server.loadAccount(address);
  const balances = (account.balances as HorizonBalance[]).map((b) => ({
    asset: b.asset_type === "native" ? "XLM" : (b.asset_code || "unknown"),
    amount: b.balance,
  }));
  const total = balances.find((b) => b.asset === "XLM")?.amount || "0";
  return { total, balances };
}

/**
 * Inspect an error thrown by Horizon's loadAccount to determine whether it
 * represents an unfunded (non-existent) account or a genuine network/server
 * error.  Horizon returns HTTP 404 with `extras.result_codes` absent for
 * accounts that have never received a funding payment. (#293)
 */
function isUnfundedAccountError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { response?: { status?: number } };
  return e.response?.status === 404;
}

async function withBalanceFallback(
  promise: Promise<AccountBalances>
): Promise<AccountBalances> {
  try {
    return await promise;
  } catch (err) {
    // Distinguish unfunded accounts from real errors so callers can surface
    // a friendlier "account not yet funded" message instead of a generic
    // error. (#293)
    if (isUnfundedAccountError(err)) {
      return { total: "0", balances: [], unfunded: true };
    }
    return { total: "0", balances: [] };
  }
}

export async function getAccountBalances(
  address: string,
  network: "PUBLIC" | "TESTNET"
): Promise<AccountBalances> {
  const key = `${address}:${network}`;
  const now = Date.now();

  const cached = balanceCache.get(key);
  if (cached && now - cached.fetchedAt < BALANCE_CACHE_TTL_MS) {
    return withBalanceFallback(cached.promise);
  }

  const promise = loadAccountBalances(address, network);
  balanceCache.set(key, { promise, fetchedAt: now });

  // Evict on failure so the "0 balance" fallback is not served from cache and
  // the next call retries against the network.
  promise.catch(() => {
    if (balanceCache.get(key)?.promise === promise) {
      balanceCache.delete(key);
    }
  });

  return withBalanceFallback(promise);
}

/**
 * Clears the account-balances cache. Primarily for tests; call sites rely on
 * the short TTL rather than manual invalidation.
 */
export function clearAccountBalancesCache(): void {
  balanceCache.clear();
}

export async function fetchRecentTransactions(
  address: string,
  network: StellarNetwork,
  limit: number = 10
): Promise<BridgeTransactionData[]> {
  const server = await getHorizonServer(network);
  try {
    const payments = await server
      .payments()
      .forAccount(address)
      .limit(limit)
      .order("desc")
      .call();

    return (payments.records as HorizonPayment[]).map((p) => {
      // create_account operations use `funder`/`account` and `starting_balance`
      // instead of the `from`/`to`/`amount` fields present on payment ops. (#294)
      const isCreateAccount = p.type === "create_account";
      const fromAddress = isCreateAccount ? (p.funder || "") : (p.from || "");
      const toAddress = isCreateAccount ? (p.account || "") : (p.to || "");
      const amount = isCreateAccount
        ? (p.starting_balance || "0")
        : (p.amount || "0");

      // When `transaction_successful` is absent (older Horizon versions) we
      // treat the record as pending rather than assuming it failed. (#294)
      let status: "pending" | "confirmed" | "failed";
      if (p.transaction_successful === undefined || p.transaction_successful === null) {
        status = "pending";
      } else {
        status = p.transaction_successful ? "confirmed" : "failed";
      }

      return {
        id: p.id,
        fromAddress,
        toAddress,
        amount,
        asset: p.asset_type === "native" || isCreateAccount ? "XLM" : (p.asset_code || "XLM"),
        status,
        timestamp: new Date(p.created_at || Date.now()).getTime(),
        type: "g-to-c" as const,
        hash: p.transaction_hash,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Internal helper that handles the shared transaction-building flow used by
 * both buildAndSubmitPayment and bridgeViaContract:
 *   1. Retries on sequence-number conflicts via withSequenceRetry
 *   2. Constructs the Account and TransactionBuilder
 *   3. Signs the XDR via Freighter
 *   4. Rebuilds the signed transaction and submits it
 *
 * Callers supply the resolved `destination` and `asset` up-front so that the
 * two public functions keep their own destination/asset-resolution logic.
 *
 * @param sourceAddress - The G-address that will sign and pay fees
 * @param destination   - The resolved destination address for the payment
 * @param asset         - The resolved Stellar Asset to send
 * @param amount        - Amount as a decimal string (e.g. "10.5")
 * @param network       - "PUBLIC" or "TESTNET"
 * @param server        - An already-initialised Horizon.Server instance
 * @param passphrase    - The network passphrase for signing/rebuilding
 */
async function buildSignAndSubmit(
  sourceAddress: string,
  destination: string,
  asset: Asset,
  amount: string,
  network: StellarNetwork,
  server: Horizon.Server,
  passphrase: string,
  onPhase?: (phase: "signing" | "submitting") => void
): Promise<PaymentResult> {
  const { TransactionBuilder, Operation, BASE_FEE } = await import("@stellar/stellar-sdk");

  return withSequenceRetry(
    sourceAddress,
    async (getSequence) => {
      const sequence = await getSequence();
      const account = new Account(sourceAddress, (sequence - 1n).toString());

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: passphrase,
      })
        .addOperation(
          Operation.payment({
            destination,
            asset,
            amount,
          })
        )
        .setTimeout(30)
        .build();

      onPhase?.("signing");
      const signedResult = await signTransaction(tx.toXDR(), {
        networkPassphrase: passphrase,
      });

      if ("error" in signedResult && signedResult.error) {
        throw new Error(`Signing failed: ${signedResult.error}`);
      }

      const signedXDR = (signedResult as { signedTxXdr: string }).signedTxXdr;
      const signedTx = TransactionBuilder.fromXDR(signedXDR, passphrase);

      onPhase?.("submitting");
      const submitResult = await server.submitTransaction(signedTx);
      return {
        hash: submitResult.hash,
        successful: submitResult.successful,
      };
    },
    server
  );
}

/**
 * Resolves the Asset a payment should use, validating any non-native
 * trustline against the source account. Shared by buildAndSubmitPayment and
 * bridgeViaContract so neither can silently substitute a different asset
 * than the one the caller (and UI) asked for.
 */
async function resolveAsset(
  server: Horizon.Server,
  sourceAddress: string,
  assetCode: string
): Promise<Asset> {
  const { Asset } = await import("@stellar/stellar-sdk");

  if (assetCode === "XLM") {
    return Asset.native();
  }

  const account = await server.loadAccount(sourceAddress);
  const balances = account.balances as HorizonBalance[];
  const matchingBalance = balances.find((b) => b.asset_code === assetCode);
  if (!matchingBalance) {
    throw new Error(`No ${assetCode} trustline found for this account`);
  }
  return new Asset(assetCode, matchingBalance.asset_issuer);
}

export async function buildAndSubmitPayment(
  sourceAddress: string,
  destinationAddress: string,
  amount: string,
  assetCode: string,
  network: StellarNetwork,
  onPhase?: (phase: "signing" | "submitting") => void
): Promise<PaymentResult> {
  const server = await getHorizonServer(network);
  const passphrase = await getNetworkPassphrase(network);
  const asset = await resolveAsset(server, sourceAddress, assetCode);

  return buildSignAndSubmit(
    sourceAddress,
    destinationAddress,
    asset,
    amount,
    network,
    server,
    passphrase,
    onPhase
  );
}

/**
 * Bridges an asset from a classic G-address to a Soroban C-address.
 *
 * Classic Stellar payment operations cannot target a contract address — the
 * protocol's PaymentOp.destination is a MuxedAccount, which has no encoding
 * for C... StrKeys. Moving an asset onto a C-address requires invoking that
 * asset's Stellar Asset Contract via Soroban (simulate + prepareTransaction),
 * which isn't implemented yet (tracked in issue #284). Until that lands, this
 * fails loudly and specifically here instead of letting the SDK reject the
 * built operation with an opaque "destination is invalid", or letting a
 * classic payment silently target the wrong address.
 */
export async function bridgeViaContract(
  sourceAddress: string,
  cAddress: string,
  amount: string,
  assetCode: string,
  network: StellarNetwork,
  onPhase?: (phase: "signing" | "submitting") => void
): Promise<PaymentResult> {
  if (!isValidStellarAmount(amount)) {
    throw new Error("Invalid amount: Stellar amounts support at most 7 decimal places and must be greater than 0");
  }

  if (isCAddress(cAddress)) {
    const reason = BRIDGE_CONTRACT_ID
      ? "the configured bridge contract cannot yet be invoked from this app"
      : "no bridge contract is configured";
    throw new Error(
      `Bridging to a Soroban C-address isn't supported yet: classic Stellar payments can't target contract addresses, and ${reason}. Track progress on this in issue #284.`
    );
  }

  return buildAndSubmitPayment(sourceAddress, cAddress, amount, assetCode, network);
}

export function getExplorerUrl(
  network: StellarNetwork,
  type: "tx" | "account" | "contract",
  id: string
): string {
  const base = network === "PUBLIC"
    ? "https://stellar.expert/explorer/public"
    : "https://stellar.expert/explorer/testnet";
  return `${base}/${type}/${id}`;
}

export function getAccountMinimumBalance(): string {
  return "1.0";
}
