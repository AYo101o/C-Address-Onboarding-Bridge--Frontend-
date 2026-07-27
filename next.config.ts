import type { NextConfig } from "next";
import path from "node:path";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const initialJsBudgetBytes = Number(process.env.NEXT_PUBLIC_INITIAL_JS_BUDGET_KB ?? "100") * 1024;

// In CI, flip webpack performance hints from "warning" to "error"
// so that bundle-size budget violations fail the build.
const enforceBudget = process.env.ENFORCE_BUDGET === "true";

const nextConfig: NextConfig = {
  turbopack: {},
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      config.performance = {
        ...config.performance,
        maxEntrypointSize: initialJsBudgetBytes,
        maxAssetSize: Math.max(initialJsBudgetBytes, 200 * 1024),
        hints:
          process.env.NODE_ENV === "production"
            ? enforceBudget
              ? "error"
              : "warning"
            : false,
      };
    }

    config.resolve.alias = {
      ...config.resolve.alias,
      "@/lib/stellar": path.join(__dirname, "src/lib/stellar"),
    };
    return config;
  },
};

export default withBundleAnalyzer(nextConfig);