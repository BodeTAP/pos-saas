import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  // Optimalkan output untuk dev yang lebih cepat
  outputFileTracingExcludes: {
    "*": [
      "./node_modules/@swc/core-linux-x64-gnu",
      "./node_modules/@swc/core-linux-x64-musl",
      "./node_modules/@esbuild/linux-x64",
    ],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "tripay.co.id" },
      { protocol: "https", hostname: "**.tripay.co.id" },
      { protocol: "https", hostname: "api.qrserver.com" },
      // Vercel Blob storage
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
