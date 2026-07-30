// @vitest-environment jsdom
import React, { act } from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import Footer from "@/components/footer";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Footer", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    root = null;
  });

  it("renders a single footer landmark", async () => {
    await act(async () => {
      root?.render(<Footer />);
    });

    const footers = container?.querySelectorAll("footer");
    expect(footers?.length).toBe(1);
  });

  it("renders the brand name and tagline", async () => {
    await act(async () => {
      root?.render(<Footer />);
    });

    expect(container?.textContent).toContain("C-Address Bridge");
    expect(container?.textContent).toContain("Soroban dApps");
  });

  it("links each internal protocol route to its page", async () => {
    await act(async () => {
      root?.render(<Footer />);
    });

    const hrefs = Array.from(container?.querySelectorAll("a") ?? []).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/bridge", "/onramp", "/cex"]));
  });

  it("opens external resource links in a new tab without leaking window.opener", async () => {
    await act(async () => {
      root?.render(<Footer />);
    });

    const externalLinks = Array.from(container?.querySelectorAll("a") ?? []).filter((a) =>
      (a.getAttribute("href") ?? "").startsWith("http")
    );

    expect(externalLinks.length).toBeGreaterThan(0);
    for (const link of externalLinks) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
      expect(link.getAttribute("rel")).toContain("noreferrer");
    }
  });
});
