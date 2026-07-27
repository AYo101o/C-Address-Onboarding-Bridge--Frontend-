import { describe, expect, it } from "vitest";
import { getInitialJSBudgetBytes } from "@/lib/performance";

/**
 * Temporarily override process.env values, execute fn, then restore.
 */
function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
  const originals: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    originals[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key]!;
    }
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (originals[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originals[key]!;
      }
    }
  }
}

describe("getInitialJSBudgetBytes", () => {
  it("uses the default 100KB budget when no override is provided", () => {
    withEnv({ NEXT_PUBLIC_INITIAL_JS_BUDGET_KB: undefined }, () => {
      expect(getInitialJSBudgetBytes()).toBe(100 * 1024);
    });
  });

  it("uses the configured KB override when present", () => {
    withEnv({ NEXT_PUBLIC_INITIAL_JS_BUDGET_KB: "64" }, () => {
      expect(getInitialJSBudgetBytes()).toBe(64 * 1024);
    });
  });

  it("falls back to 100KB for non-numeric values", () => {
    withEnv({ NEXT_PUBLIC_INITIAL_JS_BUDGET_KB: "not-a-number" }, () => {
      expect(getInitialJSBudgetBytes()).toBe(100 * 1024);
    });
  });

  it("falls back to 100KB for zero", () => {
    withEnv({ NEXT_PUBLIC_INITIAL_JS_BUDGET_KB: "0" }, () => {
      expect(getInitialJSBudgetBytes()).toBe(100 * 1024);
    });
  });

  it("falls back to 100KB for negative values", () => {
    withEnv({ NEXT_PUBLIC_INITIAL_JS_BUDGET_KB: "-50" }, () => {
      expect(getInitialJSBudgetBytes()).toBe(100 * 1024);
    });
  });

  it("is not affected by ENFORCE_BUDGET env var", () => {
    withEnv(
      { NEXT_PUBLIC_INITIAL_JS_BUDGET_KB: "80", ENFORCE_BUDGET: "true" },
      () => {
        expect(getInitialJSBudgetBytes()).toBe(80 * 1024);
      }
    );
  });
});