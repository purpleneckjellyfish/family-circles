import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output keeps the Docker image lean (see Dockerfile).
  output: "standalone",
};

export default nextConfig;
