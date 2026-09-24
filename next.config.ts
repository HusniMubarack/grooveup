import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // libSQL ships native bindings; let Node load them instead of bundling.
  serverExternalPackages: ["@libsql/client", "libsql", "@prisma/adapter-libsql"],
  // The admin Setup card compares the database against the migrations in the repo.
  outputFileTracingIncludes: { "/admin": ["./prisma/migrations/**/*"] },
};

export default nextConfig;
