/** @type {import('next').NextConfig} */
const nextConfig = {
  // A self-contained server for the Docker image. Only on request: on Windows this step needs symlink rights.
  output: process.env.BUILD_STANDALONE ? 'standalone' : undefined,
  serverExternalPackages: ['mongoose', 'nodemailer'],
  // SOURCES_DEMO=1 reads these at runtime, so the server bundle has to include them.
  outputFileTracingIncludes: { '/api/**': ['./test/fixtures/**'] },
  images: { remotePatterns: [{ protocol: 'https', hostname: 'lh3.googleusercontent.com' }] },
};

export default nextConfig;
