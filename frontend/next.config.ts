import type { NextConfig } from "next";

// A trailing slash would turn /api/... into //api/..., which the backend rejects
const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:8080").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // Proxy /api/* to the Spring Boot backend so the browser never hits CORS.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
