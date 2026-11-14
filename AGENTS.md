<!-- AUTO-GENERATED FROM CLAUDE.md. DO NOT EDIT DIRECTLY. -->

# Project: KeyCraft 3D — Interactive Custom Mechanical Keyboard Studio & AI Acoustic Architect

## 1. Tech Stack & Architecture
- **Frontend & 3D:** Next.js (App Router), TypeScript (Strict), Tailwind CSS, Framer Motion, React Three Fiber (`@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `three`).
- **State Management:** Zustand (đồng bộ 2 chiều giữa 3D Canvas, UI Controls và AI Tool Calling).
- **AI & Agentic UI:** Vercel AI SDK (`ai`, `@ai-sdk/google`, `streamText` + `tools` + `zod`).
- **Audio:** Web Audio API (Procedural & AudioBuffer synth giả lập tiếng gõ switch/plate độ trễ thấp).
- **Database, Cache & Infra:** PostgreSQL 17 + `pgvector` (Hybrid: Relational JSONB builds + Vector RAG), Drizzle ORM, Redis (Trending Builds Cache & AI Rate Limiting), Docker & Docker Compose.
- **Automated Testing:** Vitest + React Testing Library.

## 2. Tiêu chuẩn Code Đẹp & Sản phẩm thật
- **Cấu trúc thư mục chuẩn:** Tách bạch rõ `src/components/canvas/` (3D), `src/components/ui/` (Giao diện), `src/store/` (Zustand), `src/lib/` (AI, Audio, Redis), `src/db/` (Schema & Queries), `src/types/`.
- **TypeScript Strict:** Cấm dùng `any`. Mọi props, state và AI tool schema phải validate bằng TypeScript / Zod.
- **UX chuẩn Production:** Bắt buộc có `<Suspense>` fallback mượt mà cho 3D Canvas, xử lý lỗi API rõ ràng và Responsive tốt.

## 3. Quy tắc vận hành bắt buộc (Mandatory Rules)
1. **Shared State Handoff:** Luôn đọc `PROGRESS.md` (đặc biệt mục **Handoff Log** ở cuối file) trước khi làm. Sau khi xong task, đánh dấu `[x]` và ghi lại các file đã sửa + biến môi trường mới (nếu có) vào **Handoff Log**.
2. **Self-Verification & Auto-Test Loop:** Mọi logic quan trọng (Store, API, RAG, Audio math) BẮT BUỘC phải có file test `*.test.ts`. Trước khi báo hoàn thành, AI phải chạy đủ 3 lệnh: `npx tsc --noEmit`, `npm run lint`, và `npm test -- --run` cho đến khi xanh 100%.
3. **Dual-Output Learning Mode (Học từ số 0):** Sau mỗi task hoàn thành, BẮT BUỘC tạo file `docs/theory/<task-id>-<ten-chu-de>.md` bằng tiếng Việt dễ hiểu gồm 4 phần:
   - **Bản chất hoạt động (Under the hood):** Luồng dữ liệu đi qua các file nào, giải thích từng khái niệm cho người mới bắt đầu.
   - **Tại sao chọn cách này (Trade-offs):** So sánh ngắn gọn với cách làm thông thường.
   - **Thử thách tự tay sửa code (5 phút):** Đưa ra 1–2 gợi ý cụ thể (chỉ rõ tên file và dòng code) để chủ dự án tự sửa thử thông số và thấy kết quả thay đổi trên web.
   - **3 câu hỏi phỏng vấn thực chiến** kèm đáp án súc tích xoay quanh đoạn code vừa viết.