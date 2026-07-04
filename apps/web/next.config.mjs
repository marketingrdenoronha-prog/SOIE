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
      "../../node_modules/.pnpm/**/node_modules/.prisma/client/*.node",
      "../../node_modules/.pnpm/**/node_modules/@prisma/client/**",
    ],
  },
  // Exclude the platform binaries we don't need on Vercel (Amazon Linux =
  // rhel-openssl-3.0.x). Keeping darwin/windows/debian bloats each function
  // above the 250 MB limit once every /api/** includes them.
  outputFileTracingExcludes: {
    "/api/**/*": [
      "../../node_modules/.pnpm/**/node_modules/.prisma/client/libquery_engine-darwin*",
      "../../node_modules/.pnpm/**/node_modules/.prisma/client/libquery_engine-windows*",
      "../../node_modules/.pnpm/**/node_modules/.prisma/client/libquery_engine-debian*",
      "../../node_modules/.pnpm/**/node_modules/@prisma/engines/*.node",
      "../../node_modules/.pnpm/**/node_modules/@prisma/engines/**",
    ],
  },
};

export default nextConfig;
