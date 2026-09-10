/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // shared workspace packages are TS source — let Next transpile them
  transpilePackages: ['@cafeos/types', '@cafeos/validation', '@cafeos/realtime', '@cafeos/core', '@cafeos/db', '@cafeos/ui'],
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', '.prisma/client'],
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
};

export default nextConfig;
// Trigger restart with @opentelemetry/api
