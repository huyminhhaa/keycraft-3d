# ==============================================================================
# Multi-stage Dockerfile cho KeyCraft 3D (Next.js 16 + Three.js + Standalone)
# Tối ưu hóa kích thước image từ ~1.5GB xuống còn ~160MB và bảo mật Non-Root User
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Cài đặt Dependencies
# ------------------------------------------------------------------------------
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Sao chép file định nghĩa dependencies
COPY package.json package-lock.json* ./

# Cài đặt toàn bộ dependencies (bao gồm devDependencies để build)
RUN npm ci

# ------------------------------------------------------------------------------
# Stage 2: Build Ứng dụng Next.js
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Tắt telemetry của Next.js để tăng tốc độ build và tôn trọng quyền riêng tư
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Biên dịch mã nguồn Next.js sang bản phân phối standalone
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 3: Runner (Môi trường chạy Production siêu nhẹ & an toàn)
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Thiết lập user không có quyền root (Non-Root User) để phòng chống leo thang đặc quyền
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Sao chép thư mục tài nguyên tĩnh public
COPY --from=builder /app/public ./public

# Thiết lập quyền truy cập cho thư mục .next
RUN mkdir .next && chown nextjs:nodejs .next

# Sao chép bản build standalone và static assets từ builder stage
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Chuyển quyền thực thi sang user nextjs
USER nextjs

EXPOSE 3000

# Kiểm tra tình trạng hoạt động của container
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

# Khởi chạy Next.js standalone server
CMD ["node", "server.js"]
