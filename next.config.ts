import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  experimental: {
    // Platform images may be up to 10 MB. Leave room for multipart form metadata.
    serverActions: {
      bodySizeLimit: "11mb"
    }
  }
};

export default nextConfig;
