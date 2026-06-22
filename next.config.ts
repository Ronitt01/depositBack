import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack ignores the stray parent lockfile.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
