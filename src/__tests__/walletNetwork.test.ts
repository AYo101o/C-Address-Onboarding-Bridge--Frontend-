import { describe, it, expect, vi, beforeEach } from "vitest";
import * as freighter from "@stellar/freighter-api";
import {
  getCurrentNetwork,
  getWalletNetwork,
  formatNetworkLabel,
  assertActiveAccountMatches,
} from "@/lib/stellar";
import { isSupportedNetwork } from "@/lib/types";

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(),
  getAddress: vi.fn(),
  signTransaction: vi.fn(),
  getNetwork: vi.fn(),
}));

const getNetwork = vi.mocked(freighter.getNetwork);
const getAddress = vi.mocked(freighter.getAddress);

const ACTIVE = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5V3VQ";
const OTHER = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBTUMXBQ";

beforeEach(() => {
  vi.clearAllMocks();
});

// #289: every non-PUBLIC value — including Futurenet and a failed query — used
// to collapse into "TESTNET", so the app read the wrong chain and built
// transactions with the wrong passphrase while confidently displaying "Testnet".
describe("getCurrentNetwork", () => {
  it("returns PUBLIC for a mainnet wallet", async () => {
    getNetwork.mockResolvedValue({ network: "PUBLIC", networkPassphrase: "p" } as never);

    await expect(getCurrentNetwork()).resolves.toBe("PUBLIC");
  });

  it("returns TESTNET for a testnet wallet", async () => {
    getNetwork.mockResolvedValue({ network: "TESTNET", networkPassphrase: "p" } as never);

    await expect(getCurrentNetwork()).resolves.toBe("TESTNET");
  });

  it("returns UNSUPPORTED for FUTURENET rather than pretending it's testnet", async () => {
    getNetwork.mockResolvedValue({ network: "FUTURENET", networkPassphrase: "p" } as never);

    await expect(getCurrentNetwork()).resolves.toBe("UNSUPPORTED");
  });

  it("returns UNSUPPORTED for a custom/standalone network", async () => {
    getNetwork.mockResolvedValue({ network: "STANDALONE", networkPassphrase: "p" } as never);

    await expect(getCurrentNetwork()).resolves.toBe("UNSUPPORTED");
  });

  it("returns UNKNOWN when the query throws", async () => {
    getNetwork.mockRejectedValue(new Error("Freighter is locked"));

    await expect(getCurrentNetwork()).resolves.toBe("UNKNOWN");
  });

  it("returns UNKNOWN when Freighter reports an in-band error", async () => {
    getNetwork.mockResolvedValue({ network: "", error: "User declined access" } as never);

    await expect(getCurrentNetwork()).resolves.toBe("UNKNOWN");
  });

  it("normalises lower-case network names", async () => {
    getNetwork.mockResolvedValue({ network: "public", networkPassphrase: "p" } as never);

    await expect(getCurrentNetwork()).resolves.toBe("PUBLIC");
  });

  it("never reports an unsupported or unknown network as supported", async () => {
    for (const network of ["FUTURENET", "STANDALONE", ""]) {
      getNetwork.mockResolvedValue({ network, networkPassphrase: "p" } as never);
      expect(isSupportedNetwork(await getCurrentNetwork())).toBe(false);
    }
  });
});

describe("getWalletNetwork", () => {
  it("reports the raw network name so the UI can name it", async () => {
    getNetwork.mockResolvedValue({ network: "futurenet", networkPassphrase: "p" } as never);

    await expect(getWalletNetwork()).resolves.toEqual({
      status: "UNSUPPORTED",
      name: "FUTURENET",
    });
  });

  it("has no name when the network could not be read", async () => {
    getNetwork.mockRejectedValue(new Error("locked"));

    await expect(getWalletNetwork()).resolves.toEqual({ status: "UNKNOWN", name: null });
  });
});

describe("formatNetworkLabel", () => {
  it("labels the supported networks", () => {
    expect(formatNetworkLabel("PUBLIC")).toBe("Mainnet");
    expect(formatNetworkLabel("TESTNET")).toBe("Testnet");
  });

  it("names the unsupported network when known", () => {
    expect(formatNetworkLabel("UNSUPPORTED", "FUTURENET")).toBe("Futurenet");
    expect(formatNetworkLabel("UNSUPPORTED", null)).toBe("Unsupported");
  });

  it("labels an unreadable network as unknown", () => {
    expect(formatNetworkLabel("UNKNOWN")).toBe("Unknown");
  });
});

// #287: Freighter signs with its active account, not with whatever address the
// transaction names as its source, so a mismatch could only fail at submission
// with an opaque tx_bad_auth.
describe("assertActiveAccountMatches", () => {
  it("passes when the source is the active account", async () => {
    getAddress.mockResolvedValue({ address: ACTIVE } as never);

    await expect(assertActiveAccountMatches(ACTIVE)).resolves.toBeUndefined();
  });

  it("throws before signing when the source is a different account", async () => {
    getAddress.mockResolvedValue({ address: ACTIVE } as never);

    await expect(assertActiveAccountMatches(OTHER)).rejects.toThrow(
      /doesn't match the From address/
    );
  });

  it("names both addresses, truncated", async () => {
    getAddress.mockResolvedValue({ address: ACTIVE } as never);

    const error = await assertActiveAccountMatches(OTHER).catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(ACTIVE.slice(0, 8));
    expect((error as Error).message).toContain(OTHER.slice(0, 8));
    // Truncated, not the full 56-character keys.
    expect((error as Error).message).not.toContain(ACTIVE);
    expect((error as Error).message).not.toContain(OTHER);
  });

  it("throws when the active account cannot be read", async () => {
    getAddress.mockRejectedValue(new Error("locked"));

    await expect(assertActiveAccountMatches(ACTIVE)).rejects.toThrow(
      /Couldn't read Freighter's active account/
    );
  });
});
