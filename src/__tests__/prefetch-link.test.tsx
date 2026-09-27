// @vitest-environment jsdom
import React, { act } from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { createRoot, Root } from "react-dom/client";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const prefetch = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch, replace: vi.fn(), back: vi.fn() }),
}));

describe("PrefetchLink", () => {
  let container: HTMLDivElement;
  let root: Root;
  let PrefetchLink: typeof import("@/components/prefetch-link").PrefetchLink;

  beforeEach(async () => {
    // Fresh module so the module-level "already prefetched" set is reset.
    vi.resetModules();
    prefetch.mockClear();
    ({ PrefetchLink } = await import("@/components/prefetch-link"));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(el: React.ReactElement) {
    act(() => root.render(el));
    return container.querySelector("a") as HTMLAnchorElement;
  }

  it("renders children and passes href through", () => {
    const a = render(<PrefetchLink href="/dashboard" prefetchOnVisible={false}>Go</PrefetchLink>);
    expect(a.textContent).toBe("Go");
    expect(a.getAttribute("href")).toBe("/dashboard");
  });

  it("prefetches on mouse enter", () => {
    const a = render(<PrefetchLink href="/dashboard" prefetchOnVisible={false}>Go</PrefetchLink>);
    act(() => {
      a.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    expect(prefetch).toHaveBeenCalledWith("/dashboard");
  });

  it("prefetches on focus", () => {
    const a = render(<PrefetchLink href="/bridge" prefetchOnVisible={false}>Go</PrefetchLink>);
    act(() => {
      a.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });
    expect(prefetch).toHaveBeenCalledWith("/bridge");
  });

  it("does not prefetch for non-string (external URL object) hrefs", () => {
    const a = render(
      <PrefetchLink href={{ pathname: "/x" }} prefetchOnVisible={false}>Go</PrefetchLink>,
    );
    act(() => {
      a.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    expect(prefetch).not.toHaveBeenCalled();
  });

  it("does not prefetch the same target twice", () => {
    const a = render(<PrefetchLink href="/dashboard" prefetchOnVisible={false}>Go</PrefetchLink>);
    act(() => {
      a.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      a.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      a.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });
    expect(prefetch).toHaveBeenCalledTimes(1);
  });
});
