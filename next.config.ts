import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
