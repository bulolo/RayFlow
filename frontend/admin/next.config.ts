import type { NextConfig } from 'next';
import path from 'node:path';

const proxyTarget =
  process.env.RAYFLOW_API_PROXY_TARGET ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://127.0.0.1:3000';

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${proxyTarget}/api/:path*` },
      { source: '/doc.html', destination: `${proxyTarget}/doc.html` },
      { source: '/v3/api-docs/:path*', destination: `${proxyTarget}/v3/api-docs/:path*` },
      { source: '/swagger-ui/:path*', destination: `${proxyTarget}/swagger-ui/:path*` },
      { source: '/swagger-ui.html', destination: `${proxyTarget}/swagger-ui.html` },
      { source: '/webjars/:path*', destination: `${proxyTarget}/webjars/:path*` },
    ];
  },
};

export default nextConfig;
