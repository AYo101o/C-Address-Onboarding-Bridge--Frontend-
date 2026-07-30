# Styles Guide

## Overview

C-Address Onboarding Bridge uses **Tailwind CSS v4** with CSS custom properties
for theming. Styles are defined in `src/app/globals.css` and extended via
Tailwind utility classes throughout components.

## Color System

The app uses CSS custom properties defined in `globals.css`:

| Variable | Usage |
|----------|-------|
| `--background` | Page background |
| `--foreground` | Primary text color |
| `--card` | Card/panel backgrounds |
| `--primary` | Primary actions (buttons, links) |
| `--muted` | Subdued text and borders |
| `--destructive` | Error states and destructive actions |

Dark mode is supported via `prefers-color-scheme: dark` media query, with
separate variable values defined under the dark theme.

## Tailwind Configuration

Tailwind is configured in `tailwind.config.ts` with:
- Custom color tokens mapped from CSS variables
- Extended spacing and border-radius scales
- Custom font families (Geist Sans, Geist Mono)

## Component Styling Conventions

1. **Use Tailwind utilities** for all layout, spacing, and typography.
2. **Use CSS variables** for colors so dark mode works automatically.
3. **Avoid inline styles** except in components that need dynamic values.
4. **Use `cn()` utility** (if available) for conditional class merging.

## Responsive Design

Breakpoints follow Tailwind defaults:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

Mobile-first approach: base styles target mobile, breakpoint prefixes
add desktop overrides.

## Typography

- Body: Geist Sans (variable: `--font-geist-sans`)
- Code: Geist Mono (variable: `--font-geist-mono`)
- Scale follows Tailwind's default type scale (`text-sm`, `text-base`, etc.)

## Adding New Styles

1. Prefer Tailwind classes over custom CSS.
2. For new theme colors, add the CSS variable in `globals.css` under both
   light and dark themes, then reference via `var(--your-color)`.
3. For component-specific styles that can't be expressed in Tailwind, create
   a CSS module alongside the component.

## Testing Styles

Visual regression testing can be done via Storybook:
```bash
npx storybook build
```
