// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Polling Tab Visibility Pausing", () => {
  let hiddenState = false;

  beforeEach(() => {
    hiddenState = false;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => hiddenState,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pauses polling callback execution when document.hidden is true", () => {
    const callback = vi.fn();
    const poll = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      callback();
    };

    const interval = setInterval(poll, 1000);
    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        callback();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Active
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);

    // Tab hidden
    hiddenState = true;
    vi.advanceTimersByTime(3000);
    expect(callback).toHaveBeenCalledTimes(1); // Did not increase while hidden

    // Tab visible again
    hiddenState = false;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(callback).toHaveBeenCalledTimes(2); // Immediately fetched on visible

    clearInterval(interval);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  });
});
