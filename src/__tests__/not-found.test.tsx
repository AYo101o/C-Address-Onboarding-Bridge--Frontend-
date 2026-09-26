// @vitest-environment jsdom
import React, { act } from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import NotFound from "@/app/not-found";
import { auditAccessibility, summarizeViolations } from "./helpers/a11y";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("NotFound page", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<NotFound />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders the message and a link back home", () => {
    expect(container.textContent).toContain("Page not found");
    expect(container.textContent).toContain("doesn't exist");
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/");
    expect(link?.textContent).toContain("Go Home");
  });

  it("has exactly one h1 and no skipped heading levels", () => {
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelector("h1")?.textContent).toBe("Page not found");
    expect(container.querySelectorAll("h2, h3, h4, h5, h6")).toHaveLength(0);
  });

  it("has no accessibility violations", () => {
    expect(summarizeViolations(auditAccessibility(container))).toEqual([]);
  });
});
