/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // shared workspace packages are TS source — let Next transpile them
  transpilePackages: ['@cafeos/types', '@cafeos/validation', '@cafeos/realtime', '@cafeos/core', '@cafeos/db', '@cafeos/ui'],
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', '.prisma/client', 'ws', 'bufferutil', 'utf-8-validate'],
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
// Trigger restart with @opentelemetry/api
