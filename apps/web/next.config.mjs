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
  // A Vercel roda RHEL: o engine debian (17 MB) nunca é usado lá. Excluí-lo
  // do trace corta esse peso de cada função serverless.
  outputFileTracingExcludes: {
    "*": ["**/libquery_engine-debian-openssl-3.0.x.so.node"],
  },
  eslint: { ignoreDuringBuilds: true },
  // In `next dev` the workspace packages resolve to their TS source (the
  // "development" export condition), whose ESM imports use explicit `.js`
  // extensions. Map `.js` back to the TS source so dev can resolve them.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
