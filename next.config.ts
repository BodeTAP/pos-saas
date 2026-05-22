import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  // Disable SW di development agar tidak mengganggu hot reload
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
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

export default withSerwist(nextConfig);
