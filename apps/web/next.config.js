const path = require('path');
const fs = require('fs');

function getApiUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  try {
    const portFile = path.join(process.cwd(), '..', '..', '.dev-api-port');
    const port = fs.readFileSync(portFile, 'utf8').trim();
    if (port) return `http://localhost:${port}`;
  } catch (_) {}
  return 'http://localhost:3001';
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@aipas/shared', '@tanstack/react-query'],
  async rewrites() {
    const apiUrl = getApiUrl();
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
