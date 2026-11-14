# 00. Kiến Trúc Toàn Cảnh Hệ Thống KeyCraft 3D

> **Chủ đề:** Bức tranh toàn cảnh kiến trúc Full-stack 3D + AI + Realtime Audio + Hybrid Database của KeyCraft 3D.  
> **Mục tiêu:** Giúp bạn nắm rõ bản chất cách các khối công nghệ (Next.js, Three.js/R3F, Zustand, Vercel AI SDK, PostgreSQL pgvector, Redis, Web Audio API) kết nối và đồng bộ dữ liệu với nhau từ số 0.

---

## 1. Bản chất hoạt động (Under the hood)

### 1.1. Bức tranh toàn cảnh (System Architecture)
KeyCraft 3D không chỉ là một ứng dụng hiển thị hình ảnh 3D đơn thuần, mà là một **Interactive 3D Studio & AI Acoustic Architect**. Hệ thống kết hợp giữa không gian đồ họa tương tác thời gian thực, trí tuệ nhân tạo có khả năng tác động ngược vào giao diện (Agentic UI / Tool Calling), cơ sở dữ liệu lai (Hybrid Relational + Vector) và engine âm thanh phản hồi độ trễ cực thấp.

Toàn bộ hệ thống vận hành xoay quanh **Zustand Store** - đóng vai trò là **Single Source of Truth** (Trọng tâm đồng bộ trạng thái duy nhất).

```
                      +------------------------------------------------+
                      |                 NGƯỜI DÙNG                     |
                      |  (Tương tác 3D / Gõ phím / Chat với AI)        |
                      +-------+-------------------+--------------------+
                              |                   |
               (1) Click UI / |                   | (2) Chat yêu cầu:
               Kéo thả 3D /   |                   | "Build cho tôi phím âm Thock,
               Gõ phím thật   |                   |  plate nhôm, case Navy"
                              v                   v
              +---------------+----+    +---------+--------------------+
              |  React UI Controls |    | AI Floating Chat Panel       |
              |  (Tailwind/Motion) |    | (Vercel AI SDK - useChat)    |
              +---------------+----+    +---------+--------------------+
                              |                   |
                              |                   | POST /api/chat
                              |                   v
                              |         +---------+--------------------+
                              |         | Next.js API Route (/chat)    |
                              |         | - Redis: Kiểm tra Rate Limit |
                              |         +---------+--------------------+
                              |                   |
                              |         +---------+--------------------+
                              |         | Google Gemini 1.5/2.0        |
                              |         | (StreamText + AI Tool Calls) |
                              |         +---------+--------------------+
                              |                   |
                              |                   +---> [RAG Query] Tìm kiếm âm học:
                              |                   |     PostgreSQL (pgvector cosine)
                              |                   |
                              |                   +---> [Tool Call]: updateKeyboardConfig({
                              |                         plate: 'aluminum',
                              |                         switchType: 'oil_king',
                              |                         caseColor: '#1e293b'
                              |                       })
                              |                   |
                              v                   v
              +--------------------------------------------------------+
              |           ZUSTAND STORE (useKeyboardStore)             |
              |            * Trọng tâm đồng bộ 2 chiều *               |
              +-----------+-----------------------+--------------------+
                          |                       |
        (State re-render) |                       | (Update acoustic params)
                          v                       v
      +-------------------+---------+   +---------+--------------------+
      | 3D Canvas (R3F + Drei)      |   | Web Audio Synthesizer        |
      | - 7 Layers Geometry         |   | - Web Audio API AudioContext |
      | - Exploded View lerp anim   |   | - Procedural resonance EQ    |
      | - RGB Underglow Postprocess |   | - Phản hồi âm thanh gõ thật  |
      +-----------------------------+   +------------------------------+
                          |
                          v (Lưu & Chia sẻ Build)
      +-------------------+--------------------------------------------+
      | POST /api/builds -> PostgreSQL 17 (JSONB builds)               |
      | Cache Trending Builds -> Redis (TTL 60s)                       |
      +----------------------------------------------------------------+
```

---

### 1.2. Luồng dữ liệu chi tiết giữa các thư mục và file
Khi ứng dụng khởi chạy hoàn chỉnh, dòng chảy dữ liệu (Data Flow) sẽ đi qua các lớp kiến trúc sau:

1. **Lớp hiển thị 3D (`src/components/canvas/`):**
   - `KeyboardScene.tsx`: Khởi tạo `<Canvas>` của React Three Fiber, nạp camera, ánh sáng studio, HDR Environment map và hiệu ứng hậu kỳ (Bloom cho đèn LED RGB).
   - `KeyboardModel.tsx`: Chứa 7 lớp linh kiện (Bottom Case, PCB, Poron Foam, Switch Plate, Switches, Keycaps, Top Case). Khi `isExploded = true` trong Store, các lớp sẽ tự động tính toán tọa độ trục $Y$ thông qua thuật toán nội suy `MathUtils.lerp` trong hook `useFrame` để bung ra mượt mà ở 60/120 FPS.

2. **Lớp giao diện người dùng (`src/components/ui/`):**
   - `ConfigToolbar.tsx`: Cho phép chọn Layout (65%, 75%, TKL), đổi chất liệu Plate (Alu, Polycarbonate, POM, FR4), bật/tắt tách lớp.
   - `ChatPanel.tsx`: Giao diện trò chuyện nổi (Glassmorphism), gửi tin nhắn tới AI Architect và lắng nghe luồng Tool Call phản hồi từ server.

3. **Lớp quản lý trạng thái (`src/store/`):**
   - `useKeyboardStore.ts`: Lưu trữ toàn bộ thông số cấu hình: kích thước, màu sắc từng bộ phận, danh sách switch, góc camera, âm lượng và trạng thái tách lớp.
   - Bất kể hành động thay đổi đến từ người dùng click chuột hay do AI gọi tool thực thi, Store là nơi duy nhất giữ dữ liệu và tự động kích hoạt re-render đồng bộ cho cả 3D Canvas lẫn Audio Engine.

4. **Lớp trí tuệ nhân tạo AI & RAG (`src/app/api/chat/` & `src/lib/`):**
   - API route sử dụng `streamText` từ Vercel AI SDK kết hợp cùng `@ai-sdk/google`.
   - Định nghĩa các tools (`updateKeyboardConfig`, `toggleExplodedView`) bằng thư viện `zod`. Khi AI nhận định người dùng muốn đổi cấu hình phím, nó trả về tool call kèm payload có cấu trúc chuẩn xác.
   - Cơ chế **RAG (Retrieval-Augmented Generation)**: Trước khi AI tư vấn, hệ thống chuyển đổi câu hỏi thành vector embedding, truy vấn vào bảng `hardware_components` trong PostgreSQL thông qua toán tử khoảng cách Cosine `<=>` của `pgvector` để lấy đúng thông số âm thanh thực tế của từng linh kiện.

5. **Lớp giả lập âm thanh (`src/lib/soundEngine.ts`):**
   - Dùng Web Audio API độc lập với luồng render đồ họa.
   - Khi nhận sự kiện bàn phím thật (`keydown`), hệ thống đọc cấu hình hiện tại trong Zustand (Plate loại gì? Foam dày bao nhiêu? Switch clicky hay linear?) để tính toán bộ lọc BiquadFilter (tần số cắt, Q-factor) và kích hoạt AudioBuffer giả lập tiếng gõ "Thock" (trầm ấm) hoặc "Clack" (đanh giòn) với độ trễ dưới 15ms.

6. **Lớp lưu trữ và bộ đệm (`src/db/` & Redis):**
   - `PostgreSQL 17 + pgvector`: Lưu trữ toàn vẹn thông tin các bản build dưới dạng `JSONB` linh hoạt, kết hợp đánh index vector HNSW/IVFFlat cho dữ liệu âm học.
   - `Redis`: Đóng vai trò 2 nhiệm vụ: (1) Cache danh sách các bản build đang "Hot" (Trending Builds) giảm tải cho DB; (2) Giới hạn tần suất gọi AI (Rate Limiting với thuật toán Sliding Window hoặc Token Bucket).

---

## 2. Tại sao chọn cách này (Trade-offs & Architectural Decisions)

| Thành phần | Lựa chọn của KeyCraft 3D | Cách làm truyền thống | Lý do & Đánh đổi |
| :--- | :--- | :--- | :--- |
| **State Management** | **Zustand** | Redux Toolkit / React Context | **Zustand** cực nhẹ (~1KB), không cần bọc Provider bao quanh toàn bộ cây DOM, hỗ trợ chọn lọc selector tránh re-render thừa trong Canvas 3D (vốn chạy ở 60-120fps). Redux quá cồng kềnh cho ứng dụng tương tác 3D. |
| **Giao tiếp AI** | **AI SDK Tool Calling** | Chatbot gửi text thông thường | Chatbot truyền thống chỉ trả lời bằng chữ suông. Tool Calling biến AI thành **Agent thực thi**: AI trực tiếp gửi lệnh JSON được validate bởi Zod để điều khiển camera, bung linh kiện và sơn màu phím theo ý người dùng. |
| **Vector Database** | **PostgreSQL + pgvector** | Vector DB rời (Pinecone, Qdrant) | Giữ kiến trúc **Single Database**: Quản lý cả dữ liệu quan hệ (Users, Builds JSONB) và vector embedding trên cùng một DB PostgreSQL 17, giảm chi phí vận hành, loại bỏ rủi ro lệch đồng bộ dữ liệu giữa 2 database. |
| **Bộ nhớ đệm & Guard**| **Redis** | In-memory Node.js (Map/Set) | In-memory Node.js sẽ mất trắng khi serverless restart hoặc scale đa container. **Redis** hoạt động độc lập, hỗ trợ lệnh nguyên tử (Atomic operations: INCR, EXPIRE) lý tưởng cho Rate Limiting và caching dữ liệu build chia sẻ. |
| **Giả lập âm thanh** | **Procedural Web Audio API** | File âm thanh MP3 thu sẵn | Tải hàng trăm file MP3 gây nặng web và không linh hoạt. Web Audio API cho phép can thiệp trực tiếp vào tần số, bộ lọc cộng hưởng và envelope theo thời gian thực dựa trên chất liệu plate và switch. |

---

## 3. Thử thách tự tay sửa code (5 phút)

Ngay từ bước đầu tiên này, bạn có thể tự tay làm quen với cấu hình hệ thống bằng 2 bài thực hành nhỏ:

### Thử thách 1: Tùy biến giới hạn tần suất gọi AI (Rate Limit)
1. Mở file [`.env.example`](file:///d:/Projects/keycraft-3d/.env.example#L42-L44).
2. Tìm dòng:
   ```env
   AI_RATE_LIMIT_MAX_REQUESTS=10
   AI_RATE_LIMIT_WINDOW_SECONDS=60
   ```
3. **Thử nghiệm:** Thử đổi `AI_RATE_LIMIT_MAX_REQUESTS=3` và `AI_RATE_LIMIT_WINDOW_SECONDS=30`.
   - *Hiện tượng trong tương lai:* Khi bạn chat với AI Architect 3 lần liên tiếp trong vòng 30 giây, Redis sẽ từ chối lượt gọi thứ 4 và trả về mã lỗi HTTP 429 (Too Many Requests), bảo vệ hạn mức Gemini API của bạn không bị cạn kiệt.

### Thử thách 2: Cấu hình cổng kết nối PostgreSQL linh hoạt
1. Trong file [`.env.example`](file:///d:/Projects/keycraft-3d/.env.example#L23-L28), quan sát cấu trúc connection string:
   ```env
   DATABASE_URL=postgresql://keycraft:keycraft_secret@localhost:5432/keycraft_db
   ```
2. Nếu máy tính của bạn đã cài sẵn một bản PostgreSQL cục bộ đang chạy ở cổng `5432`, bạn có thể đổi `POSTGRES_PORT=5433` trong Docker và cập nhật chuỗi kết nối thành `localhost:5433` để tránh xung đột cổng.

---

## 4. Ba câu hỏi phỏng vấn thực chiến (Interview Q&A)

### Câu hỏi 1: Tại sao trong ứng dụng 3D thời gian thực (React Three Fiber), Zustand lại vượt trội hơn React Context API?
> **Đáp án:**  
> Vòng lặp đồ họa (Render loop) của React Three Fiber thường chạy ở tần số quét màn hình (60Hz hoặc 120Hz). Khi sử dụng React Context, bất kỳ thay đổi nào trong context value cũng sẽ ép **toàn bộ các component consumer** phải re-render, dẫn đến hiện tượng tụt khung hình (frame drop) nghiêm trọng.  
> Ngược lại, **Zustand** cho phép component "subscribe" (đăng ký theo dõi) vào từng phần nhỏ của state thông qua selector (ví dụ: `useKeyboardStore(s => s.isExploded)`). Component chỉ re-render khi giá trị selector đó thực sự thay đổi. Hơn nữa, Zustand có thể truy xuất state trực tiếp thông qua `useKeyboardStore.getState()` bên trong hook `useFrame` mà không cần re-render component React.

---

### Câu hỏi 2: Bản chất cơ chế "Tool Calling" của LLM là gì? Mô hình ngôn ngữ có thực sự tự chạy code trên máy chủ của bạn không?
> **Đáp án:**  
> Không. Mô hình ngôn ngữ lớn (LLM) bản chất là bộ sinh xác suất từ ngữ (Text Generation), nó **không có quyền hạn hay khả năng tự chạy code** trên server.  
> Khi ta khai báo Tool (thông qua Zod schema trong Vercel AI SDK), schema đó được chuyển đổi thành định dạng JSON mô tả chức năng gửi kèm trong system prompt. Khi người dùng đưa ra yêu cầu (ví dụ: "Đổi sang plate đồng"), LLM nhận diện rằng cần dùng tool, và nó sẽ phản hồi về một chuỗi JSON có cấu trúc chỉ định: `{ name: "updateKeyboardConfig", args: { plate: "brass" } }`. Phía backend/frontend của chúng ta đọc gói JSON này, kiểm tra tính hợp lệ và tự thực thi hàm cập nhật vào Zustand Store.

---

### Câu hỏi 3: Sự khác biệt giữa `JSONB` trong PostgreSQL và cơ sở dữ liệu NoSQL (như MongoDB) khi lưu trữ các bản thiết kế phím (Keyboard Builds) là gì?
> **Đáp án:**  
> Cột `JSONB` trong PostgreSQL lưu trữ dữ liệu JSON đã được phân tích cú pháp (parsed binary format), cho phép lập chỉ mục (GIN Index) và truy vấn sâu vào các thuộc tính bên trong không thua kém MongoDB.  
> Tuy nhiên, lợi thế cốt lõi của PostgreSQL nằm ở tính chất **Hybrid**: Ta vừa có sự linh hoạt của NoSQL (bản build bàn phím có nhiều lớp, linh kiện tùy biến lưu trong JSONB), vừa có tính toàn vẹn khóa ngoại (Foreign Keys) liên kết với bảng người dùng, vừa có khả năng mở rộng với extension `pgvector` để tính toán khoảng cách cosine giữa các vector embedding trên cùng một câu lệnh SQL.
