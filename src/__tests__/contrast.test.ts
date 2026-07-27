import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Automated WCAG 2.x contrast audit for the --text-muted design token.
 *
 * --text-muted is used pervasively for meaningful secondary content (balances,
 * transaction statuses, form hints), so it must clear WCAG AA (4.5:1 for normal
 * text) against every surface it renders over — including the translucent tint
 * overlays (e.g. bg-[var(--error)]/10) that blend into lighter backgrounds.
 *
 * This test parses the real token values from globals.css, so lowering the
 * token's contrast below AA — or darkening a surface under it — fails CI.
 */

const AA_NORMAL = 4.5;

const cssPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../app/globals.css",
);
const css = readFileSync(cssPath, "utf8");

function token(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`token --${name} not found in globals.css`);
  return match[1];
}

type RGB = { r: number; g: number; b: number };

function hexToRgb(hex: string): RGB {
  const n = hex.replace("#", "");
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

function relativeLuminance({ r, g, b }: RGB): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: RGB, b: RGB): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// Alpha-composite `fg` at `alpha` over opaque `bg` (CSS "source-over").
function composite(fg: RGB, alpha: number, bg: RGB): RGB {
  return {
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
  };
}

const muted = hexToRgb(token("text-muted"));
const background = hexToRgb(token("background"));
const surface = hexToRgb(token("surface"));
const surface2 = hexToRgb(token("surface-2"));

// Solid surfaces --text-muted renders directly over.
const solidSurfaces: Record<string, RGB> = {
  "--background": background,
  "--surface": surface,
  "--surface-2": surface2,
};

// Translucent tint overlays that wrap muted text, blended over their base
// surface (matches the `bg-[var(--x)]/NN` usages in the components).
const tintOverlays: { label: string; bg: RGB }[] = (
  [
    ["primary", 0.05, surface],
    ["primary", 0.1, surface],
    ["secondary", 0.1, surface],
    ["accent", 0.1, surface],
    ["success", 0.1, surface],
    ["error", 0.1, surface],
  ] as const
).map(([name, alpha, base]) => ({
  label: `${name}/${alpha * 100}% on surface`,
  bg: composite(hexToRgb(token(name)), alpha, base),
}));

describe("--text-muted WCAG AA contrast", () => {
  it.each(Object.entries(solidSurfaces))(
    "meets AA over %s",
    (_label, bg) => {
      expect(contrastRatio(muted, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
    },
  );

  it.each(tintOverlays)("meets AA over $label", ({ bg }) => {
    expect(contrastRatio(muted, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});
