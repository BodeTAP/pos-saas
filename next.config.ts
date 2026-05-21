import type { NextConfig } from "next";

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

export default nextConfig;
