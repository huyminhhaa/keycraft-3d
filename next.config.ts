import type { NextConfig } from "next";
import { API_CONTENT_SECURITY_POLICY, buildSecurityHeaders } from "./src/lib/security/securityHeaders";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  // Không bật cacheComponents (Partial Prerendering): CSP dùng nonce theo từng request
  // (src/proxy.ts) không tương thích với vỏ HTML build sẵn của PPR.
  // Không lộ "X-Powered-By: Next.js" (giảm thông tin cho kẻ dò quét phiên bản)
  poweredByHeader: false,
  images: {
    // Ảnh build mang `?v=<mã nội dung>` để thay ảnh là hết cache cũ; không khai báo `search` = cho phép mọi query
    localPatterns: [{ pathname: "/builds/**" }],
  },
  async headers() {
    return [
      {
        // Header tĩnh cho mọi route; CSP của trang HTML do src/proxy.ts gắn kèm nonce
        source: "/:path*",
        headers: buildSecurityHeaders(),
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Content-Security-Policy", value: API_CONTENT_SECURITY_POLICY }],
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
