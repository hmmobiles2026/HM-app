import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs", "@prisma/adapter-neon", "@neondatabase/serverless"],
};

export default nextConfig;
