// @vitest-environment jsdom
import React, { act } from "react";
import { describe, it, expect, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import Footer from "@/components/footer";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Footer", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

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

  const renderFooter = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<Footer />);
    });
  };

  it("renders the documented protocol links", async () => {
    await renderFooter();

    const linkHref = (name: string) =>
      Array.from(container?.querySelectorAll("a") ?? []).find((a) => a.textContent === name)?.getAttribute("href");

    expect(linkHref("G → C Bridge")).toBe("/bridge");
    expect(linkHref("Fiat Onramp")).toBe("/onramp");
    expect(linkHref("CEX Withdrawal")).toBe("/cex");
  });

  it("renders external resource links with safe target/rel attributes", async () => {
    await renderFooter();

    const externalLinks = Array.from(container?.querySelectorAll("a") ?? []).filter((a) =>
      ["Soroban Docs", "GitHub", "Stellar"].includes(a.textContent ?? "")
    );

    expect(externalLinks).toHaveLength(3);
    externalLinks.forEach((link) => {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    });
  });
});
