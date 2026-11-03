/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['mongoose'],
  // SOURCES_DEMO=1 reads these at runtime, so the serverless bundle has to include them.
  outputFileTracingIncludes: { '/api/**': ['./test/fixtures/**'] },
  images: { remotePatterns: [{ protocol: 'https', hostname: 'lh3.googleusercontent.com' }] },
};

export default nextConfig;
