import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Note: Do not use output: "standalone" with Clerk on Render
  // Environment variables NEXT_PUBLIC_* must be set in Render dashboard
};

export default nextConfig;
