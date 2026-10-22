import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-pdf renders on the server (route handlers); load it from node_modules instead of bundling.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
