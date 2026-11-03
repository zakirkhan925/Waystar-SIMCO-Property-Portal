import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-pdf renders on the server (route handlers); load it from node_modules instead of bundling.
  serverExternalPackages: ["@react-pdf/renderer"],

  // pdfkit loads its standard fonts lazily through a private subpath import —
  // require("#standard-fonts/Helvetica") — resolved via the "imports" map in its package.json.
  // Next's file tracer does not follow that map, so the font modules were left out of the
  // serverless bundle: every PDF worked under `next start` (which has all of node_modules) and
  // failed on Vercel with "Cannot find module". Ship them explicitly with every PDF route.
  outputFileTracingIncludes: {
    "/api/pdf/**/*": ["./node_modules/pdfkit/js/standard-fonts/**/*"],
  },
};

export default nextConfig;
