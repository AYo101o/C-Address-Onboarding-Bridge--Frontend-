// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Reduced Motion Support (A11Y)", () => {
  it("includes prefers-reduced-motion media query in globals.css", () => {
    const globalsCssPath = path.resolve(__dirname, "../app/globals.css");
    const cssContent = fs.readFileSync(globalsCssPath, "utf-8");

    expect(cssContent).toContain("@media (prefers-reduced-motion: reduce)");
    expect(cssContent).toContain("animation: none !important");
    expect(cssContent).toContain("transition-duration: 0.01ms !important");
    expect(cssContent).toContain("transform: none !important");
  });

  it("applies motion-reduce:animate-none to loading spinner components", () => {
    const loadingPath = path.resolve(__dirname, "../app/loading.tsx");
    const loadingContent = fs.readFileSync(loadingPath, "utf-8");
    expect(loadingContent).toContain("motion-reduce:animate-none");

    const historyPath = path.resolve(__dirname, "../components/transaction-history.tsx");
    const historyContent = fs.readFileSync(historyPath, "utf-8");
    expect(historyContent).toContain("motion-reduce:animate-none");

    const dashboardPath = path.resolve(__dirname, "../components/routes/dashboard-page.tsx");
    const dashboardContent = fs.readFileSync(dashboardPath, "utf-8");
    expect(dashboardContent).toContain("motion-reduce:animate-none");

    const bridgePath = path.resolve(__dirname, "../app/bridge/page.tsx");
    const bridgeContent = fs.readFileSync(bridgePath, "utf-8");
    expect(bridgeContent).toContain("motion-reduce:animate-none");
  });
});
