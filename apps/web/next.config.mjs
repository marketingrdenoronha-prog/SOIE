/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages used by the API route handlers are transpiled from
  // source; native/Prisma packages stay external so their binaries load.
  transpilePackages: ["@soie/contracts", "@soie/ai", "@soie/config", "@soie/db"],
  // @prisma/client + adapter-neon stay external so they aren't bundled.
  serverExternalPackages: [
    "@prisma/client",
    ".prisma/client",
    "@prisma/adapter-neon",
    "@neondatabase/serverless",
    "pino",
    "pino-pretty",
  ],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
