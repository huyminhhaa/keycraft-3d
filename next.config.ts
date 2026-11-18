import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Ảnh build mang `?v=<mã nội dung>` để thay ảnh là hết cache cũ; không khai báo `search` = cho phép mọi query
    localPatterns: [{ pathname: "/builds/**" }],
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
