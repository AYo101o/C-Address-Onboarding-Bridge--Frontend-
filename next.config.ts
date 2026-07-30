import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Performance: bundle analysis and optimization
  experimental: {
    optimizePackageImports: [
      "@stellar/stellar-sdk",
      "@stellar/freighter-api",
    ],
  },

  // Suppress hydration warnings in development
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },

  // Webpack optimizations
  webpack: (config, { isServer }) => {
    // Reduce bundle size by excluding server-only packages from client
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
