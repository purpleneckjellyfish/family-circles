import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output keeps the Docker image lean (see Dockerfile).
  output: "standalone",
  // Dev UI is often opened via 127.0.0.1 while Next prints localhost.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
