import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "sharp", "pdfkit"],
  // The simulators and the tribunal PDF read these sample files at runtime; make sure serverless bundles carry them.
  outputFileTracingIncludes: { "/api/**/*": ["./public/assets/**/*"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
