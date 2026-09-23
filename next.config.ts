import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // libSQL ships native bindings; let Node load them instead of bundling.
  serverExternalPackages: ["@libsql/client", "libsql", "@prisma/adapter-libsql"],
};

export default nextConfig;
