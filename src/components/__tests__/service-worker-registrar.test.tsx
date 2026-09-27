import React, { StrictMode } from "react";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceWorkerRegistrar } from "../service-worker-registrar";
import { registerServiceWorker } from "@/lib/serviceWorker";

describe("ServiceWorkerRegistrar", () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_SW", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (original) Object.defineProperty(navigator, "serviceWorker", original);
    else delete (navigator as unknown as Record<string, unknown>).serviceWorker;
  });

  function setSW(value: unknown) {
    Object.defineProperty(navigator, "serviceWorker", { value, configurable: true });
  }

  it("attempts registration once on mount", () => {
    const register = vi.fn().mockResolvedValue({});
    setSW({ register });
    render(<ServiceWorkerRegistrar />);
    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("handles a rejected registration without throwing", async () => {
    const register = vi.fn().mockRejectedValue(new Error("boom"));
    setSW({ register });
    expect(() => render(<ServiceWorkerRegistrar />)).not.toThrow();
    await expect(registerServiceWorker({ serviceWorker: { register } })).resolves.toBeNull();
  });

  it("does nothing when navigator.serviceWorker is undefined", () => {
    setSW(undefined);
    expect(() => render(<ServiceWorkerRegistrar />)).not.toThrow();
  });

  it("does not register twice on a strict-mode remount", () => {
    const register = vi.fn().mockResolvedValue({});
    setSW({ register });
    render(
      <StrictMode>
        <ServiceWorkerRegistrar />
      </StrictMode>,
    );
    expect(register).toHaveBeenCalledTimes(1);
  });
});
