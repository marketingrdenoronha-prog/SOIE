import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@soie/contracts", "@soie/ai", "@soie/config", "@soie/db"],
  serverExternalPackages: ["@prisma/client", ".prisma/client", "pino", "pino-pretty"],
  eslint: { ignoreDuringBuilds: true },

  // Trace from the monorepo root so Next follows pnpm's symlinked packages.
  // Without this, it can't find @prisma/client at runtime on Vercel.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Include ONLY the Linux binary Vercel needs (rhel-openssl-3.0.x) — the
  // full glob was pulling every Prisma binary into every /api/** function,
  // exceeding 250 MB per function and failing at "Deploying outputs".
  outputFileTracingIncludes: {
    "/api/**/*": [
      "../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node",
      "../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/schema.prisma",
    ],
  },
};

export default nextConfig;
