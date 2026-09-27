import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Storybook/Percy were removed from devDependencies during the CI cleanup —
    // these files no longer have a toolchain to parse or run them. Delete the
    // ignores (and restore the deps) if visual regression testing comes back.
    ".storybook/**",
    "src/stories/**",
    "scripts/capture-visual-regression.js",
  ]),
  {
    rules: {
      "react-hooks/rules-of-hooks": "error",
      // TODO(next-bounty): `set-state-in-effect` is a React Compiler rule that
      // eslint-config-next 16 turns on as an error. Several components written
      // during the bounty programme call setState directly inside an effect.
      // Each one needs a real refactor (derive during render, or move into an
      // event handler), so it is a warning for now rather than a merge blocker.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
