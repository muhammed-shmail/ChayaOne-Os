/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // shared workspace packages are TS source — let Next transpile them
  transpilePackages: ['@cafeos/core', '@cafeos/db', '@cafeos/ui'],
  experimental: {
    // keep the native Prisma engine external; @cafeos/db itself is transpiled above
    serverComponentsExternalPackages: ['@prisma/client', '.prisma/client'],
    cpus: 1,
    workerThreads: false,
  },
};

export default nextConfig;
