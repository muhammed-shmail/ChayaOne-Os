/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@cafeos/types', '@cafeos/validation', '@cafeos/realtime', '@cafeos/core', '@cafeos/ui'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  async rewrites() {
    // In development or when connecting to Main PC Server, proxy API calls to port 3000 if not self-hosted
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://127.0.0.1:3000';
    return [
      {
        source: '/api/:path*',
        destination: `${serverUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
