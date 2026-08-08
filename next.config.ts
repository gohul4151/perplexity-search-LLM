import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "pg"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
