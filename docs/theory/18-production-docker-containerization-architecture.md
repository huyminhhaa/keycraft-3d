# Bách Khoa Toàn Thư Đóng Gói Production: Multi-Stage Dockerfile, Next.js Standalone & Docker Compose 3-Tier Architecture

> **Mã tài liệu:** `18-production-docker-containerization-architecture`  
> **Dự án:** KeyCraft 3D — Custom Mechanical Keyboard Studio  
> **Thuộc chặng:** Chặng 4: Đóng Gói Production & Hoàn Thiện CV (Task 4.1)  
> **Trình độ:** Từ số 0 đến Senior DevOps & Full-Stack Architect

---

## 1. Bách Khoa Công Nghệ Sử Dụng Trong Task

### 1.1. `Multi-Stage Docker Builds` — Nghệ Thuật Giảm 90% Dung Lượng Image
- **Định nghĩa:** `Multi-stage build` là kỹ thuật xây dựng Docker Image cho phép sử dụng nhiều câu lệnh `FROM` trong cùng một file `Dockerfile`. Mỗi câu lệnh `FROM` đại diện cho một giai đoạn (stage) độc lập, và giai đoạn sau có thể sao chép chọn lọc các thành phẩm cần thiết từ giai đoạn trước (`COPY --from=...`).
- **Tác dụng trong KeyCraft 3D:**
  - Chia quy trình thành 3 tầng:
    1. **Stage 1 (`deps`):** Nạp `package.json` và cài đặt toàn bộ dependencies bằng `npm ci`.
    2. **Stage 2 (`builder`):** Biên dịch TypeScript, tối ưu hóa CSS Tailwind v4, đóng gói Three.js shaders và tạo bản build Next.js.
    3. **Stage 3 (`runner`):** Chỉ lấy binary Node.js và thư mục `standalone` tối giản để chạy production. Loại bỏ hoàn toàn công cụ build, devDependencies và mã nguồn gốc thô.
- **Cách sử dụng (Syntax chuẩn):**
  ```dockerfile
  FROM node:22-alpine AS deps
  ...
  FROM node:22-alpine AS builder
  COPY --from=deps /app/node_modules ./node_modules
  RUN npm run build
  ...
  FROM node:22-alpine AS runner
  COPY --from=builder /app/.next/standalone ./
  CMD ["node", "server.js"]
  ```
- **Điểm mạnh (Pros):**
  - **Dung lượng siêu nhẹ:** Giảm kích thước image từ $\approx 1.5\text{GB}$ xuống còn $\approx 160\text{MB}$.
  - **Tối ưu hóa Docker Layer Caching:** Khi bạn sửa đổi file `.tsx`, Docker không cần tải lại hoặc cài lại `node_modules`, giúp thời gian build chỉ mất vài giây thay vì vài phút.
- **Hạn chế (Cons):**
  - Cần hiểu rõ file nào là bắt buộc cho runtime để không copy thiếu tài nguyên tĩnh (`public` và `.next/static`).

---

### 1.2. `Next.js Output: "standalone"` — Tự Động Rút Gọn Node.js Bundle Cho Container
- **Định nghĩa:** Tính năng cấu hình `output: "standalone"` trong `next.config.ts` yêu cầu trình biên dịch Next.js tự động phân tích cây phụ thuộc (Static AST Analysis) để tìm ra chính xác những file và package nào từ `node_modules` thực sự được gọi trong quá trình chạy.
- **Tác dụng:**
  - Thay vì phải copy toàn bộ thư mục `node_modules` nặng nề hàng trăm megabyte vào container, Next.js xuất ra một thư mục tự trị `.next/standalone` chỉ chứa đúng các module cần thiết cùng một file khởi chạy nhẹ `server.js`.
  - Không cần cài đặt `next` CLI trong container runtime.
- **Cách sử dụng:**
  ```typescript
  // next.config.ts
  const nextConfig: NextConfig = {
    output: "standalone",
    ...
  };
  ```

---

### 1.3. `Container Security & Non-Root User` — Nguyên Tắc Đặc Quyền Tối Thiểu (Least Privilege)
- **Định nghĩa:** Theo mặc định, các tiến trình chạy trong Docker container sẽ thực thi dưới quyền `root` (User ID 0). Nếu ứng dụng web có lỗ hổng bảo mật (ví dụ: Remote Code Execution - RCE), kẻ tấn công sẽ chiếm được quyền kiểm soát toàn diện container và có nguy cơ thoát khỏi container (Container Escape) để tấn công máy chủ vật lý (Host OS).
- **Tác dụng trong KeyCraft 3D:**
  - Khởi tạo riêng một user hệ thống không có quyền root (`nextjs:nodejs` với UID/GID 1001).
  - Phân quyền sở hữu tệp và chuyển quyền thực thi sang user này trước khi khởi chạy lệnh `CMD`:
  ```dockerfile
  RUN addgroup --system --gid 1001 nodejs && \
      adduser --system --uid 1001 nextjs
  USER nextjs
  ```
- **Điểm mạnh:** Đạt chuẩn bảo mật khắt khe của Enterprise, SOC2 và các hệ thống điều phối container như Kubernetes.

---

### 1.4. `Docker Compose Service Dependencies & Healthchecks`
- **Định nghĩa:** `Healthcheck` là cơ chế giám sát chu kỳ định kỳ xem tiến trình bên trong container có thực sự sẵn sàng nhận kết nối hay chưa (không chỉ đơn thuần là container đang ở trạng thái `running`).
- **Tác dụng:**
  - Ứng dụng Next.js cần kết nối đến PostgreSQL và Redis ngay khi khởi động. Nếu app chạy trước khi PostgreSQL kịp nạp xong dữ liệu, kết nối DB sẽ nổ lỗi `ECONNREFUSED`.
  - Bằng cách kết hợp `healthcheck` trên PostgreSQL (`pg_isready`) và Redis (`redis-cli ping`), dịch vụ `app` sử dụng cấu hình:
  ```yaml
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
  ```
  - Đảm bảo app **chỉ khởi động** khi cả cơ sở dữ liệu quan hệ và bộ nhớ đệm đã hoàn toàn sẵn sàng 100%.

---

## 2. Bản Chất Hoạt Động (Under The Hood)

### Sơ Đồ Quy Trình Đóng Gói Multi-stage & Khởi Chạy 3 Tầng (3-Tier Orchestration)

```text
[ Docker Build Context ]
         │
         ├──> [ STAGE 1: deps (node:22-alpine) ]
         │      ├── Chỉ copy: package.json + package-lock.json
         │      └── Chạy: npm ci (Tận dụng tối đa Docker cache nếu không đổi dependencies)
         │
         ├──> [ STAGE 2: builder (node:22-alpine) ]
         │      ├── Kế thừa node_modules từ Stage 1
         │      ├── Copy toàn bộ mã nguồn: src/, public/, next.config.ts...
         │      └── Chạy: npm run build
         │            └── Sinh ra: .next/standalone (Server tối giản) & .next/static
         │
         └──> [ STAGE 3: runner (node:22-alpine - CHỈ 160MB) ]
                ├── Tạo Non-root user: nextjs:nodejs (UID 1001)
                ├── Copy: .next/standalone/server.js
                ├── Copy: .next/static -> .next/standalone/.next/static
                ├── Copy: public/ -> .next/standalone/public
                └── CMD ["node", "server.js"]

─────────────────────────────────────────────────────────────────────────────

[ docker compose up -d ]
         │
         ├── 1. Khởi động PostgreSQL 17 (pgvector/pgvector:pg17)
         │      └── Healthcheck chạy: pg_isready -> Trả về HEALTHY sau ~2s
         │
         ├── 2. Khởi động Redis 7 (redis:7-alpine)
         │      └── Healthcheck chạy: redis-cli ping -> Trả về HEALTHY sau ~1s
         │
         └── 3. Sau khi CẢ HAI HEALTHY -> Khởi động KeyCraft App Container
                └── Lắng nghe cổng 3000 -> Sẵn sàng phục vụ người dùng!
```

---

## 3. Tại Sao Chọn Cách Này (Trade-offs)

| Tiêu Chí | Single-Stage Dockerfile Truyền Thống | Multi-Stage Standalone Dockerfile (KeyCraft 3D) |
| :--- | :--- | :--- |
| **Kích thước Docker Image** | Rất nặng: $1.2\text{GB} - 1.8\text{GB}$ (chứa toàn bộ Git history, devDependencies, tệp cache TypeScript, linter). | Siêu nhẹ: $\approx 160\text{MB}$ (chỉ chứa binary Node.js và code cần chạy). |
| **Tốc độ tải (Pull & Deploy)** | Mất 1 - 3 phút để tải image qua mạng trên máy chủ cloud. | Tải và triển khai chỉ mất dưới 5 giây. |
| **Bảo mật** | Chạy dưới quyền `root`, chứa nhiều công cụ build thừa thãi có nguy cơ bị khai thác lỗ hổng bảo mật CVE. | Chạy dưới quyền `nextjs` (Non-root user), bề mặt tấn công (Attack Surface) được thu nhỏ tối đa. |
| **Thứ tự khởi động dịch vụ** | Dùng `depends_on` thông thường chỉ đợi container bật, app dễ bị crash vì DB chưa kịp lắng nghe kết nối socket. | Dùng `condition: service_healthy` với `pg_isready`, triệt tiêu hoàn toàn lỗi Race Condition lúc khởi động. |

---

## 4. Thử Thách Tự Tay Sửa Code (5 Phút)

### Thử thách 1: Thay đổi cổng lắng nghe bên ngoài của ứng dụng từ 3000 sang 8080
- **Mục tiêu:** Cấu hình để người dùng truy cập web qua địa chỉ `http://localhost:8080`.
- **Vị trí file:** `docker-compose.yml`
- **Cách làm:** Tìm dịch vụ `app` và sửa dòng mapping cổng:
  ```yaml
  # Đổi:
  ports:
    - "${PORT:-3000}:3000"
  
  # Thành:
  ports:
    - "8080:3000"
  ```
- **Kết quả:** Chạy `docker compose up -d app` và mở `http://localhost:8080`, ứng dụng sẽ phản hồi ngay lập tức trên cổng mới!

---

### Thử thách 2: Kiểm tra người dùng thực thi (Non-root user) bên trong container
- **Mục tiêu:** Chứng minh container đang chạy với user an toàn `nextjs` thay vì `root`.
- **Lệnh thực hiện trong Terminal:**
  ```bash
  docker compose exec app whoami
  ```
- **Kết quả hiển thị trên màn hình:**
  ```text
  nextjs
  ```
  *(Nếu hiện `root` nghĩa là cấu hình bảo mật thất bại, hiện `nextjs` nghĩa là đạt chuẩn an toàn 100%!)*

---

## 5. Ba Câu Hỏi Phỏng Vấn Thực Chiến

### Câu 1: Tại sao trong Multi-stage Dockerfile của Next.js, ta phải sao chép thủ công cả thư mục `.next/static` và `public` vào `.next/standalone`?
> **Đáp án:**  
> Chế độ `output: "standalone"` của Next.js chỉ gom các file JavaScript/Node.js cần thiết để thực thi server (`server.js`). Theo thiết kế kiến trúc của Next.js:  
> - Các tài nguyên tĩnh (Static Assets) như ảnh trong `public/` hay các file CSS/JS đã được băm mã hash trong `.next/static` được kỳ vọng sẽ được phân phối thông qua CDN (Cloudflare, AWS CloudFront) hoặc web server tĩnh (Nginx).  
> - Khi đóng gói container độc lập tự phục vụ mà không có CDN phía trước, ta bắt buộc phải copy thủ công `.next/static` vào `.next/standalone/.next/static` và `public` vào `.next/standalone/public` để Node server có thể tự phục vụ các tệp tài nguyên tĩnh này cho trình duyệt.

---

### Câu 2: Trong Dockerfile, tại sao lệnh `COPY package.json package-lock.json* ./` lại được đặt trước lệnh `COPY . .`?
> **Đáp án:**  
> Đây là kỹ thuật tận dụng **Docker Layer Caching**:  
> - Docker build tuần tự từ trên xuống dưới. Nếu một layer không thay đổi, Docker sẽ tái sử dụng cache của layer đó và các layer trước nó mà không cần chạy lại lệnh tốn thời gian.  
> - Các file mã nguồn ứng dụng (`src/**/*.tsx`) thay đổi rất thường xuyên trong mỗi commit, trong khi danh sách thư viện (`package.json`) thì rất ít khi thay đổi.  
> - Đặt `package.json` lên trước và chạy `npm ci` giúp Docker lưu lại cache của thư mục `node_modules`. Khi lập trình viên thay đổi code và build lại, Docker bỏ qua hoàn toàn bước `npm ci`, rút ngắn thời gian build từ 2 phút xuống chỉ còn vài giây.

---

### Câu 3: Làm thế nào để truyền an toàn các biến môi trường nhạy cảm (API Keys, Database Passwords) vào container khi triển khai Production?
> **Đáp án:**  
> 1. **Tuyệt đối không ghi cứng (Hardcode) trong `Dockerfile`** bằng lệnh `ENV KEY=value`, vì các layer của Docker image sẽ lưu lại giá trị này vĩnh viễn và bất kỳ ai có quyền pull image đều đọc được qua lệnh `docker history`.  
> 2. **Sử dụng Docker Secrets hoặc Environment Injection tại runtime:**  
>    - Thông qua file `.env` được bảo mật trên máy chủ và tham chiếu trong `docker-compose.yml` (`${VARIABLE}`).  
>    - Khi sử dụng Kubernetes: Lưu trong `Secret` và gắn vào container qua `envFrom` hoặc `volumeMount`.  
>    - Khi sử dụng Cloud (AWS ECS, Google Cloud Run): Tích hợp trực tiếp với AWS Secrets Manager hoặc GCP Secret Manager.
