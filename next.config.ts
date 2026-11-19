import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/security/securityHeaders";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // Không lộ "X-Powered-By: Next.js" (giảm thông tin cho kẻ dò quét phiên bản)
  poweredByHeader: false,
  images: {
    // Ảnh build mang `?v=<mã nội dung>` để thay ảnh là hết cache cũ; không khai báo `search` = cho phép mọi query
    localPatterns: [{ pathname: "/builds/**" }],
  },
  async headers() {
    return [
      {
        // Áp dụng cho mọi route: trang, API, file tĩnh
        source: "/:path*",
        headers: buildSecurityHeaders({ isDev: process.env.NODE_ENV === "development" }),
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
