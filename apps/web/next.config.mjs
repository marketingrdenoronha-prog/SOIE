/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages used by the API route handlers are transpiled from
  // source; native/Prisma packages stay external so their binaries load at
  // runtime instead of getting bundled by webpack.
  transpilePackages: ["@soie/contracts", "@soie/ai", "@soie/config", "@soie/db"],
  serverExternalPackages: ["@prisma/client", ".prisma/client", "pino", "pino-pretty"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
