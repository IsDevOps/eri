import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "sharp", "pdfkit"],
  // The simulators and the tribunal PDF read these demo files at runtime; make sure serverless bundles carry them.
  outputFileTracingIncludes: { "/api/**/*": ["./public/demo/**/*"] },
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
