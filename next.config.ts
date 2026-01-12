import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Allow self-signed certificates in development (for testing)
  // Note: This is only for development. In production, use proper SSL certificates.
  ...(process.env.NODE_ENV === 'development' && {
    experimental: {
      serverActions: {
        bodySizeLimit: '2mb',
      },
    },
  }),
};

export default nextConfig;
