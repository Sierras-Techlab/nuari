import type { NextConfig } from "next";
import path from "node:path";
import { getInternalApiOrigin } from "./src/lib/api/internal-origin";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  async rewrites() {
    // `next typegen` (script typecheck) carga esta config con la fase de build de producción, pero no usa los destinos.
    const typegenOnly = process.argv.includes("typegen");
    const origin = getInternalApiOrigin(typegenOnly ? { ...process.env, NODE_ENV: "development" } : process.env);
    return [{ source: "/api/:path*", destination: `${origin}/api/:path*` }];
  },
  async headers() {
    return [
      { source: "/verify-email", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/reset-password", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/app/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
      { source: "/onboarding", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};

export default nextConfig;
