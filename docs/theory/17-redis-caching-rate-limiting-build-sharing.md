# Bách Khoa Toàn Thư Redis Caching, Rate Limiting & Hệ Thống Chia Sẻ Bản Build 3D

> **Mã tài liệu:** `17-redis-caching-rate-limiting-build-sharing`  
> **Dự án:** KeyCraft 3D — Custom Mechanical Keyboard Studio  
> **Thuộc chặng:** Chặng 3: Dữ Liệu Lớn, Vector Search & Kiến Trúc Sản Phẩm Thực Tế (Task 3.3)  
> **Trình độ:** Từ số 0 đến Senior Backend & Systems Engineer

---

## 1. Bách Khoa Công Nghệ Sử Dụng Trong Task

### 1.1. `Redis Cache-Aside Pattern` — Tăng Tốc Truy Vấn Dữ Liệu Thịnh Hành (Trending Builds)
- **Định nghĩa:** `Cache-Aside` (còn gọi là *Lazy Loading Cache*) là mô hình kiến trúc lưu trữ đệm phổ biến nhất trong hệ thống phân tán. Ứng dụng sẽ kiểm tra Cache trước:
  - **Cache Hit:** Nếu dữ liệu đã có trong Redis RAM, trả về ngay lập tức với độ trễ $\le 1\text{ms}$.
  - **Cache Miss:** Nếu chưa có, ứng dụng sẽ truy vấn từ đĩa cứng PostgreSQL, ghi kết quả vào Redis kèm thời gian sống (TTL - Time To Live), rồi trả về cho client.
- **Tác dụng trong KeyCraft 3D:**
  - `REDIS_KEYS.TRENDING_BUILDS`: Lưu danh sách các bàn phím được xem nhiều nhất (TTL 60s). Giảm tải hơn 95% số lượng câu lệnh `SELECT ... ORDER BY view_count DESC` lên PostgreSQL khi hàng nghìn người cùng xem thư viện.
  - `REDIS_KEYS.BUILD_DETAIL(slug)`: Cache chi tiết từng bản build (TTL 300s).
  - **Cache Invalidation (Vô hiệu hóa bộ đệm):** Khi có một người dùng bấm lưu bản build công khai mới, hệ thống tự động gọi `redis.del(REDIS_KEYS.TRENDING_BUILDS)` để người xem tiếp theo thấy ngay bản build mới mà không phải chờ hết TTL.
- **Cách sử dụng (Syntax chuẩn trong Node.js / ioredis):**
  ```typescript
  // 1. Thử đọc từ Cache
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // 2. Truy vấn Database khi Cache Miss
  const data = await db.select().from(builds).where(...);

  // 3. Ghi vào Redis với TTL 60 giây (SETEX: SET with EXpiration)
  await redis.setex(cacheKey, 60, JSON.stringify(data));
  ```
- **Điểm mạnh (Pros):**
  - Giảm tải áp lực I/O cho cơ sở dữ liệu quan hệ, chống sập database khi có sự kiện lượng truy cập tăng vọt (Spike Traffic).
  - Tự động dọn dẹp bộ nhớ nhờ cơ chế TTL.
- **Hạn chế (Cons):**
  - Cần xử lý cẩn thận tính nhất quán dữ liệu (Data Inconsistency) giữa Redis và PostgreSQL khi có cập nhật.

---

### 1.2. `Atomic Fixed-Window Rate Limiting` — Lá Chắn Chống Spam Cho AI Architect (`/api/chat`)
- **Định nghĩa:** Rate Limiting là cơ chế giới hạn số lượng yêu cầu (Request Rate) mà một địa chỉ IP hoặc người dùng có thể gửi đến máy chủ trong một khoảng thời gian nhất định (Window).
- **Tác dụng trong KeyCraft 3D:**
  - Bảo vệ endpoint `/api/chat` khỏi các hành vi phá hoại (DDoS / DoS), spam làm cạn kiệt hạn mức quota API Google Gemini và gây tốn chi phí.
  - Cấu hình chuẩn: Tối đa 10 requests / 60 giây cho mỗi IP. Vượt quá ngưỡng sẽ nhận mã trạng thái `HTTP 429 Too Many Requests` kèm tiêu đề `Retry-After`.
- **Cơ chế Atomic Increment trong Redis:**
  ```typescript
  // INCR là phép toán đơn nguyên (Atomic): hai request đến cùng micro-giây không bao giờ xung đột
  const current = await redis.incr(redisKey);
  if (current === 1) {
    await redis.expire(redisKey, 60); // Thiết lập hạn 60s cho request đầu tiên
  }
  if (current > 10) {
    // Chặn request và trả về HTTP 429
  }
  ```
- **Lớp đệm In-Memory Fallback:**
  - Khi Redis container chưa được bật hoặc gặp sự cố, hệ thống tự động chuyển sang `Map<string, { count, resetAt }>` trong RAM của Node.js, đảm bảo ứng dụng không bao giờ nổ lỗi 500 do phụ thuộc hạ tầng mạng ngoài.

---

### 1.3. `Next.js 16 Partial Prerendering (PPR)` & Dynamic Route `/build/[slug]`
- **Định nghĩa:** Partial Prerendering (PPR) là bước đột phá kiến trúc trong Next.js 16 kết hợp giữa Static Shell (vỏ HTML tĩnh) và Dynamic Streaming (luồng dữ liệu động).
- **Tác dụng trong Trang Chi Tiết Bản Build `/build/[slug]`:**
  - Vỏ trang (Navbar, Logo, Nút điều hướng) được prerender tĩnh 100% và phân phối qua CDN với tốc độ tức thì (0ms).
  - Phần thân chứa dữ liệu động (Cấu hình bàn phím 3D, lượt xem, thông tin remix) được bọc trong `<Suspense fallback={<LoadingSpinner />}>`. Server sẽ stream dữ liệu vào vị trí tương ứng mà không làm chậm thời gian tải khung trang ban đầu.
- **Cách sử dụng:**
  ```tsx
  // Next.js 16 App Router: params là một Promise
  export default function BuildPage({ params }: { params: Promise<{ slug: string }> }) {
    return (
      <main>
        <StaticNavbar />
        <Suspense fallback={<SkeletonLoader />}>
          <DynamicBuildContent params={params} />
        </Suspense>
      </main>
    );
  }
  ```

---

## 2. Bản Chất Hoạt Động (Under The Hood)

### Sơ Đồ Luồng Dữ Liệu: Lưu Build, Caching & Remix

```text
[ Người Dùng Ở Studio 3D ]
          │
          ├──> Bấm "Lưu & Chia sẻ" -> Mở SaveBuildModal
          │      │
          │      └──> Nhập "KeyCraft 75% POM Deep Thock" -> Bấm "Tạo liên kết"
          │
          ▼
[ POST /api/builds ]
          │
          ├── 1. Xác thực JWT cookie (nếu đã đăng nhập -> gán userId)
          ├── 2. Sinh slug SEO: "keycraft-75-pom-deep-thock-a8f2"
          ├── 3. Lưu vào bảng builds trong PostgreSQL (config lưu dạng JSONB)
          └── 4. Gọi redis.del('keycraft:cache:trending_builds') (Xóa cache cũ)
          │
          ▼ Trả về URL: /build/keycraft-75-pom-deep-thock-a8f2

─────────────────────────────────────────────────────────────────────────────

[ Bạn Bè Truy Cập /build/keycraft-75-pom-deep-thock-a8f2 ]
          │
          ▼
[ Next.js 16 Partial Prerender ]
          │
          ├── Gửi ngay Static Navbar cho trình duyệt (0ms)
          └── Luồng Server Dynamic chạy song song:
                ├── Kiểm tra Redis Cache: keycraft:cache:build:keycraft-75-...
                │     ├── Cache Hit: Đọc thông tin từ Redis RAM
                │     └── Cache Miss: Đọc từ PostgreSQL + Ghi vào Redis (TTL 300s)
                ├── Tăng view_count = view_count + 1
                └── Trả về cấu hình 3D nguyên bản

[ Trình Duyệt Bạn Bè ]
          ├── 1. Nạp Three.js hiển thị chính xác mô hình 3D bàn phím đó
          ├── 2. Bấm "Phím A" / "Spacebar" -> Web Audio API phát đúng tiếng Plate POM Thock
          └── 3. Bấm "Remix trong Studio" -> Tự động nạp config vào useKeyboardStore và chuyển sang /studio!
```

---

## 3. Tại Sao Chọn Cách Này (Trade-offs)

| Tiêu Chí | Lưu Trữ Tham Số Trực Tiếp Trên URL (URL Query Params) | Lưu Trữ Database Quan Hệ + Redis Caching (KeyCraft 3D) |
| :--- | :--- | :--- |
| **Độ dài & Tính thẩm mỹ của Link** | URL siêu dài và xấu: `?layout=75&plate=pom&switch=linear&case=%230f172a&underglow=true...` (>200 ký tự), dễ bị lỗi khi chia sẻ trên mạng xã hội. | URL ngắn gọn, chuyên nghiệp, chuẩn SEO: `/build/deep-thock-custom-75-a8f2`. |
| **Khả năng lưu trữ lịch sử & Bản quyền** | Không thể biết ai là tác giả, không đếm được lượt xem và lượt remix. | Liên kết trực tiếp với tài khoản người dùng, lưu trữ thời gian tạo, lượt xem (`view_count`) và lượt fork (`fork_count`). |
| **Hiệu năng hệ thống** | Không tốn database nhưng không tạo được tính năng "Bảng xếp hạng / Thư viện cộng đồng". | Nhờ có Redis Cache-Aside, tốc độ tải trang đạt mức mili-giây ngang ngửa file tĩnh mà vẫn có đầy đủ tính năng cộng đồng. |
| **Chống Spam AI** | Nếu không có Rate Limiting, một script đơn giản có thể spam hàng ngàn câu hỏi làm tiêu tốn tiền API. | Redis Fixed-Window Rate Limiting tự động chặn sau 10 requests / phút, bảo vệ an toàn ngân sách. |

---

## 4. Thử Thách Tự Tay Sửa Code (5 Phút)

### Thử thách 1: Thay đổi giới hạn Rate Limit cho AI Chatbot
- **Mục tiêu:** Tăng giới hạn số câu hỏi người dùng được phép hỏi AI trong 1 phút từ 10 câu lên 15 câu.
- **Vị trí file:** `.env.example` và `.env.local`
- **Cách làm:** Tìm biến môi trường và sửa giá trị:
  ```env
  AI_RATE_LIMIT_MAX_REQUESTS=15
  AI_RATE_LIMIT_WINDOW_SECONDS=60
  ```
- **Kết quả:** Hệ thống sẽ cho phép bạn hỏi AI liên tục 15 lần trước khi kích hoạt cảnh báo HTTP 429!

---

### Thử thách 2: Thay đổi thời gian hết hạn Cache của bản build thịnh hành
- **Mục tiêu:** Giảm thời gian TTL cache từ 60 giây xuống 30 giây để danh sách bàn phím thịnh hành được làm mới nhanh hơn.
- **Vị trí file:** `src/lib/builds/buildService.ts`
- **Cách làm:** Tìm hàm `getTrendingBuilds` tại dòng ~125:
  ```typescript
  // Đổi số 60 thành 30:
  await redis.setex(cacheKey, 30, JSON.stringify(result));
  ```

---

## 5. Ba Câu Hỏi Phỏng Vấn Thực Chiến

### Câu 1: Trình bày cơ chế Cache Invalidation trong Cache-Aside Pattern. Tại sao trong KeyCraft 3D ta dùng `redis.del()` khi tạo build mới thay vì cập nhật trực tiếp vào cache (`redis.set()`)?
> **Đáp án:**  
> 1. Khi một bản build mới được tạo, danh sách "Trending Builds" có thể thay đổi thứ tự và phân trang (`limit`, `offset`).  
> 2. Nếu dùng `redis.set()`, ta sẽ phải tính toán lại toàn bộ danh sách sắp xếp và cập nhật mọi key phân trang liên quan, rất phức tạp và dễ gây sai lệch dữ liệu (Race Conditions).  
> 3. Bằng cách gọi `redis.del(REDIS_KEYS.TRENDING_BUILDS)`, ta xóa key cache cũ (Cache Invalidation). Lần yêu cầu kế tiếp sẽ gặp Cache Miss, tự động đọc dữ liệu mới nhất từ PostgreSQL và ghi lại cache chuẩn xác một cách tự nhiên.

---

### Câu 2: Thuật toán Fixed-Window Counter có nhược điểm gì về mặt lưu lượng (Traffic Spike)? Cách khắc phục trong các hệ thống quy mô lớn là gì?
> **Đáp án:**  
> - **Nhược điểm (Edge Boundary Traffic Spike):** Nếu một người dùng gửi 10 requests ở giây thứ 59 của window thứ nhất, và tiếp tục gửi 10 requests ở giây thứ 1 của window thứ hai, họ đã gửi thành công **20 requests chỉ trong vòng 2 giây**, gấp đôi hạn mức mong muốn.  
> - **Cách khắc phục:**  
>   1. **Sliding Window Log:** Dùng Redis Sorted Set (`ZADD`, `ZREMRANGEBYSCORE`) để lưu timestamp từng request. Độ chính xác tuyệt đối nhưng tốn RAM.  
>   2. **Sliding Window Counter:** Kết hợp tỷ trọng phần trăm thời gian của window trước và window hiện tại: $\text{count} = \text{count}_{\text{current}} + \text{count}_{\text{previous}} \times (1 - \frac{t}{\text{window}})$. Đây là giải pháp cân bằng hoàn hảo giữa tốc độ và độ chính xác.

---

### Câu 3: Làm thế nào Next.js 16 giải quyết bài toán SEO cho các trang có dữ liệu động như `/build/[slug]` khi áp dụng Partial Prerendering?
> **Đáp án:**  
> Khi Googlebot hoặc mạng xã hội (Facebook, Twitter/X, Discord) crawl trang `/build/[slug]`, Next.js 16 xử lý như sau:  
> 1. Các bot tìm kiếm sẽ nhận được HTML đầy đủ bao gồm các thẻ `<title>`, `<meta name="description">` và OpenGraph sinh ra từ hàm `generateMetadata`.  
> 2. Với Partial Prerendering, các thành phần quan trọng đối với SEO và nội dung cốt lõi của bản build được render phía máy chủ (SSR) thông qua `<Suspense>`, giúp bot đọc trọn vẹn văn bản ngữ nghĩa mà không cần chờ chạy JavaScript trên client.
