import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // R3F + @react-three/postprocessing share a single WebGL context. React Strict Mode's
  // dev-only double-mount tears the first context down, which makes EffectComposer crash
  // on init ("Cannot read properties of null (reading 'alpha')"). Disable it.
  reactStrictMode: false,
  // Pin the workspace root so Turbopack ignores the stray parent lockfile.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
