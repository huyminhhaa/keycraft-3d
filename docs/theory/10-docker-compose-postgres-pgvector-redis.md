# Bài học 10: Hạ tầng Docker Compose, PostgreSQL 17 (`pgvector`), Redis & Drizzle ORM

> **Mục tiêu học tập:** Nắm vững toàn bộ kiến trúc hạ tầng Backend hiện đại: cách điều phối đa dịch vụ (Multi-service Container Orchestration) với Docker Compose, bản chất lưu trữ Vector 768 chiều với `pgvector` phục vụ AI Search, cơ chế In-memory Caching & Brute-force Protection với Redis, và kỹ thuật định nghĩa Database Schema kiểu dữ liệu nghiêm ngặt (Strict Type-Safety) với Drizzle ORM.

---

## 1. Bách khoa Công nghệ Sử dụng trong Task

### 1.1. Docker & Docker Compose (Multi-container Orchestration)

#### A. Định nghĩa (Là gì?)
**Docker** là nền tảng ảo hóa mức hệ điều hành (Containerization) cho phép đóng gói toàn bộ mã nguồn, môi trường thực thi, thư viện và cấu hình thành một đơn vị độc lập gọi là **Container**.
**Docker Compose** là công cụ điều phối (orchestration) khai báo thông qua file `docker-compose.yml`, giúp khởi động, liên kết và quản lý nhiều container cùng lúc (ví dụ: vừa chạy Postgres vừa chạy Redis) chỉ bằng một câu lệnh duy nhất: `docker compose up -d`.

#### B. Tác dụng trong dự án KeyCraft 3D
- Chạy đồng thời **PostgreSQL 17** (đã cài sẵn extension `pgvector`) và **Redis 7 Alpine**.
- Thiết lập **Healthcheck** tự động thăm dò tình trạng sống/chết của container.
- Đảm bảo **Data Persistence** (tính bền vững của dữ liệu): dữ liệu database và cache được lưu vào ổ cứng máy host thông qua Docker Volumes (`postgres_data`, `redis_data`), khi tắt máy hoặc cập nhật container dữ liệu không bao giờ bị mất.

#### C. Cách sử dụng (Syntax chuẩn trong `docker-compose.yml`)
```yaml
services:
  postgres:
    image: pgvector/pgvector:pg17
    container_name: keycraft-postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql

  redis:
    image: redis:7-alpine
    container_name: keycraft-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
```

#### D. Điểm mạnh (Pros) & Hạn chế (Cons)
* **Điểm mạnh:**
  * Giải quyết dứt điểm nghịch lý *"Code chạy trên máy em mà không chạy trên máy sếp"*.
  * Cô lập môi trường 100%, không cần cài đặt rườm rà PostgreSQL và Redis vào Windows.
* **Hạn chế:**
  * Tiêu tốn thêm RAM (khoảng 1–2GB khi bật Docker Desktop). Cần máy tính có bật tính năng ảo hóa phần cứng (VT-x / AMD-V).

---

### 1.2. PostgreSQL 17 & `pgvector` Extension (Vector Database)

#### A. Định nghĩa (Là gì?)
**`pgvector`** là một tiện ích mở rộng (open-source extension) dành cho PostgreSQL, cho phép lưu trữ và thực hiện các phép toán tìm kiếm tương đồng trên các vector nhiều chiều (Vector Similarity Search) bằng các thuật toán như L2 distance, Cosine distance và Inner Product.

#### B. Tác dụng trong dự án KeyCraft 3D
- Cột `embedding: vector('embedding', { dimensions: 768 })` trong bảng `hardware_components` lưu trữ vector 768 chiều sinh ra từ mô hình AI **Google Gemini Embedding** (`text-embedding-004`).
- Cho phép AI Acoustic Architect thực hiện **Semantic Search / RAG**: khi người dùng nói *"Tìm switch nào gõ đầm tay mà không phát ra tiếng click"*, hệ thống chuyển câu nói thành vector và tính khoảng cách Cosine với database để tìm ra linh kiện phù hợp nhất trong tích tắc.

#### C. Cách sử dụng (Syntax chuẩn với Drizzle ORM)
```typescript
import { pgTable, uuid, varchar, text, jsonb, vector } from 'drizzle-orm/pg-core';

export const hardwareComponents = pgTable('hardware_components', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  embedding: vector('embedding', { dimensions: 768 }), // Vector 768 chiều
});
```

#### D. Điểm mạnh & Hạn chế
* **Điểm mạnh:** Không cần phải thuê hay cài thêm database vector riêng biệt (như Pinecone hay Milvus). Một mình PostgreSQL 17 gánh trọn cả dữ liệu quan hệ (Users, Orders), dữ liệu phi cấu trúc (JSONB builds) và dữ liệu AI Vector.
* **Hạn chế:** Với dữ liệu hàng chục triệu vector thì cần đánh chỉ mục HNSW (Hierarchical Navigable Small World) để tối ưu RAM.

---

### 1.3. Redis 7 (In-memory Store cho Bảo mật & Caching)

#### A. Định nghĩa (Là gì?)
**Redis** (Remote Dictionary Server) là kho lưu trữ cấu trúc dữ liệu trên bộ nhớ RAM (In-memory Data Structure Store), hoạt động với độ trễ siêu thấp (< 1ms).

#### B. Tác dụng trong dự án KeyCraft 3D
1. **Lá chắn chống Brute-force (`AUTH_FAIL`):** Đếm số lần nhập sai mật khẩu theo IP/Email. Nếu `failedAttempts >= 3`, kích hoạt thử thách CAPTCHA.
2. **Khóa tạm thời (`AUTH_LOCKOUT`):** Tự động khóa tài khoản trong 15 phút nhờ cơ chế tự hủy key (TTL - Time To Live) của Redis.
3. **AI Rate Limiting (`AI_RATE_LIMIT`):** Giới hạn mỗi người dùng chỉ được hỏi AI tối đa 10 câu/phút để tránh cạn tiền API.
4. **Cache Trending Builds:** Lưu danh sách các bàn phím hot nhất trên RAM, giảm 95% tải truy vấn vào PostgreSQL.

#### C. Cách sử dụng (Syntax chuẩn với `ioredis`)
```typescript
import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

// Tăng số lần thử sai và đặt thời gian sống 15 phút (900 giây)
await redis.incr('keycraft:auth:fails:user@example.com');
await redis.expire('keycraft:auth:fails:user@example.com', 900);
```

---

### 1.4. Drizzle ORM (Type-Safe SQL-like ORM)

#### A. Định nghĩa (Là gì?)
**Drizzle ORM** là một Object-Relational Mapping (ORM) thế hệ mới dành cho TypeScript. Khác với Prisma (phải sinh ra binary engine cồng kềnh), Drizzle có dung lượng cực nhẹ (zero-dependency, ~0kb overhead), mang lại trải nghiệm viết code y hệt như cú pháp SQL tự nhiên nhưng được kiểm tra kiểu (Type-safe) chặt chẽ 100%.

#### B. Tác dụng trong dự án KeyCraft 3D
- Định nghĩa 3 bảng dữ liệu quan hệ: `users`, `hardware_components`, `builds`.
- Hỗ trợ lưu trữ cấu hình 3D phức tạp (`KeyboardState`) thẳng vào cột `jsonb` có kiểm tra type nghiêm ngặt qua `$type<KeyboardState>()`.

---

## 2. Bản chất Hoạt động (Under the Hood)

Dưới đây là sơ đồ luồng dữ liệu kết nối giữa Next.js App Router và 2 container hạ tầng:

```
                  ┌────────────────────────────────────────┐
                  │          Next.js App (Node.js)         │
                  └───────┬────────────────────────┬───────┘
                          │                        │
         pg.Pool (Conn 10)│                        │ ioredis (Lazy TCP)
                          ▼                        ▼
           ┌────────────────────────┐    ┌────────────────────────┐
           │ Docker: Postgres 17    │    │ Docker: Redis 7 Alpine │
           │ Container (Port 5432)  │    │ Container (Port 6379)  │
           ├────────────────────────┤    ├────────────────────────┤
           │ - Extension: pgvector  │    │ - Auth Failed Counter  │
           │ - Users Table (Auth)   │    │ - Lockout Timer (TTL)  │
           │ - Components (Vectors) │    │ - AI Rate Limiting     │
           │ - Builds Table (JSONB) │    │ - Trending Builds Cache│
           └───────────┬────────────┘    └───────────┬────────────┘
                       │                             │
                       ▼ Volume Mount                ▼ Volume Mount
           ┌────────────────────────┐    ┌────────────────────────┐
           │ Host: postgres_data    │    │ Host: redis_data       │
           │ (Bền vững trên SSD)    │    │ (Dump RDB khi restart) │
           └────────────────────────┘    └────────────────────────┘
```

---

## 3. Tại sao chọn cách này (Trade-offs & So sánh)

| Giải pháp | Prisma ORM | Drizzle ORM (Được chọn cho KeyCraft 3D) | Lý do chọn |
| :--- | :--- | :--- | :--- |
| **Kích thước Bundle** | Rất nặng (~15MB binary Rust engine). Khởi động lạnh (Cold start) trên Serverless chậm. | **Siêu nhẹ (~0kb overhead)**, thuần TypeScript, khởi động 0ms. | Tối ưu tuyệt đối cho Next.js App Router và Serverless. |
| **Hỗ trợ `pgvector`** | Phức tạp, phải dùng `Unsupported("vector(768)")` và viết raw SQL thô ráp. | **Hỗ trợ Native**: `vector('embedding', { dimensions: 768 })`. | Tích hợp trơn tru với thuật toán tìm kiếm AI RAG. |
| **Cú pháp truy vấn** | Tạo ra DSL riêng kiểu Prisma, che giấu bản chất SQL. | **SQL-like Syntax**: Viết gần như SQL thật, giúp dev giỏi bản chất database hơn. | Dễ tối ưu câu lệnh truy vấn và viết Index. |

---

## 4. Thử thách Tự tay sửa Code (5 Phút)

### Thử thách: Thêm một tiền tố Cache mới vào Redis
* **File:** `src/lib/redis.ts`
* **Vị trí:** Đối tượng `REDIS_KEYS` (khoảng dòng 7–18).
* **Hành động:** Thêm một hàm tạo key cho việc lưu phiên đăng nhập của người dùng (`USER_SESSION`):
  ```typescript
  USER_SESSION: (userId: string) => `keycraft:session:${userId}`,
  ```
* **Mục đích:** Sau này ở Task 3.1b (Authentication), bạn sẽ dùng key này để kiểm tra xem Access Token hoặc Refresh Token của user có hợp lệ hay đã bị thu hồi (Revoked).

---

## 5. 3 Câu hỏi Phỏng vấn Thực chiến

### Câu hỏi 1: Tại sao nên sử dụng PostgreSQL kèm extension `pgvector` thay vì dựng một Vector Database chuyên dụng (như Pinecone hay Milvus)?
> **Đáp án ghi điểm:**  
> "Việc dùng `pgvector` ngay trên PostgreSQL mang lại 3 lợi thế kiến trúc lớn:  
> 1. **Loại bỏ phân mảnh dữ liệu (Data Sprawl):** Ta không cần dựng cơ chế đồng bộ 2 chiều (Sync Pipeline) giữa Database chính và Vector Database ngoài, tránh hiện tượng lệch dữ liệu (Stale data).  
> 2. **Hỗ trợ ACID Transactions:** Khi một linh kiện được thêm hoặc xóa, cả dữ liệu thông tin và vector embedding của nó được cập nhật trong cùng 1 transaction nguyên tử.  
> 3. **Lọc kết hợp (Hybrid Query):** Ta có thể thực hiện một câu query kết hợp vừa lọc điều kiện quan hệ (như `WHERE material = 'pom' AND price < 50`) vừa so khớp tương đồng vector (`ORDER BY embedding <=> query_vector LIMIT 5`) trong cùng 1 câu lệnh SQL duy nhất."

---

### Câu hỏi 2: Tại sao trường `config` của bàn phím lại được lưu dưới dạng `JSONB` thay vì chuẩn hóa thành nhiều bảng quan hệ (Normalized Tables)?
> **Đáp án ghi điểm:**  
> "Cấu hình bàn phím 3D là một đối tượng tổng hợp (Aggregate Object) gồm nhiều thông số phối hợp chặt chẽ (layout, switch, plate, 3 mã màu keycap, góc quay camera, trạng thái LED).  
> 1. Nếu chuẩn hóa thành 5-6 bảng riêng, mỗi lần người dùng mở bản build, hệ thống phải thực hiện 5 phép `JOIN` tốn tài nguyên.  
> 2. Định dạng `JSONB` (Binary JSON) của PostgreSQL vừa cho phép lưu trọn vẹn object chỉ trong 1 record, vừa cho phép đánh chỉ mục `GIN` để tìm kiếm sâu vào các key con bên trong khi cần.  
> 3. Trong Drizzle ORM, ta dùng `$type<KeyboardState>()` để đảm bảo dữ liệu JSONB này vẫn được kiểm tra chặt chẽ bởi TypeScript."

---

### Câu hỏi 3: Trong Redis, cơ chế TTL (Time-To-Live) hoạt động như thế nào để phục vụ tính năng chống Brute-force và Khóa tài khoản (Lockout)?
> **Đáp án ghi điểm:**  
> "Khi người dùng nhập sai mật khẩu, ta dùng lệnh `INCR` của Redis để tăng bộ đếm số lần sai theo key `AUTH_FAIL(email)`. Nếu là lần sai đầu tiên, ta đặt `EXPIRE` (TTL) là 15 phút.  
> Nếu sau 15 phút người dùng không có hành động sai tiếp theo, Redis sẽ **tự động thu hồi và xóa sạch key khỏi RAM** mà ta không cần phải viết một Cron Job hay Worker nào để dọn dẹp database. Nếu trong vòng 15 phút đó họ sai quá 3 lần, hệ thống lập tức kích hoạt key `AUTH_LOCKOUT(email)` với TTL tương ứng để chặn mọi request đăng nhập tiếp theo."
