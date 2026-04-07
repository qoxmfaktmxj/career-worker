/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingIncludes: {
    "/api/profile": ["./profile/**/*"],
  },
};

module.exports = nextConfig;
