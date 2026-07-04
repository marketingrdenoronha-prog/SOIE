import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages used by the API route handlers are transpiled from
  // source; native/Prisma packages stay external so their binaries load.
  transpilePackages: ["@soie/contracts", "@soie/ai", "@soie/config", "@soie/db"],
  serverExternalPackages: ["@prisma/client", ".prisma/client", "pino", "pino-pretty"],
  eslint: { ignoreDuringBuilds: true },

  // In a pnpm workspace the Prisma engine binary lives inside the shared
  // .pnpm store and Vercel's file tracer misses it unless we (a) root the
  // trace at the monorepo root and (b) explicitly include the .prisma/client
  // folder for API routes. Fixes "Query Engine for runtime rhel-openssl-3.0.x
  // could not be located" at runtime on Vercel.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  outputFileTracingIncludes: {
    "/api/**/*": [
      "../../node_modules/.pnpm/**/node_modules/.prisma/client/**",
      "../../node_modules/.pnpm/**/node_modules/@prisma/client/**",
    ],
  },
};

export default nextConfig;
