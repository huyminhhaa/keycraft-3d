# Lộ trình & Trạng thái Dự án KeyCraft 3D

## Chặng 1: Nền tảng, Không gian 3D & State (Dùng Antigravity Pro)
- [x] **1.0-blueprint:** Chưa cần tạo app Next.js. Hãy tạo file `docs/theory/00-architecture-overview.md` giải thích bức tranh toàn cảnh kiến trúc hệ thống KeyCraft 3D (cách Frontend 3D, Zustand, AI Tool Calling, PostgreSQL `pgvector` và Redis phối hợp với nhau) bằng ngôn ngữ dễ hiểu cho người mới từ số 0, kèm sơ đồ luồng dữ liệu ASCII và tạo file `.env.example` chuẩn bị sẵn các biến môi trường cần thiết.
- [x] **1.1-init:** Khởi tạo Next.js (TypeScript, Tailwind, ESLint, App Router, `src/` directory) trực tiếp vào thư mục hiện tại (LƯU Ý: giữ nguyên `CLAUDE.md`, `AGENTS.md`, `PROGRESS.md`, `docs/`, `.claude/`, `.agents/`, `.codex/`, `scripts/`). Cài đặt bộ thư viện 3D & UI: `three`, `@types/three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `postprocessing`, `zustand`, `lucide-react`, `framer-motion`, và bộ Auto-Test: `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`. Cấu hình script `"test": "vitest"` trong `package.json`.
- [x] **1.2-store:** Tạo Zustand store (`src/store/useKeyboardStore.ts`) quản lý layout (`65%`, `75%`, `TKL`), chế độ tách lớp (`isExploded`), chất liệu case/plate (`aluminum`, `polycarbonate`, `pom`, `fr4`), màu sắc keycap/underglow và camera preset. Viết bộ unit test đầy đủ (`src/store/useKeyboardStore.test.ts`) kiểm tra mọi action đổi trạng thái.
- [ ] **1.3-3d-scene:** Dựng 3D Canvas (`src/components/canvas/KeyboardScene.tsx`) với phong cách MotionSites.ai (Cinematic Dark Luxury, Frosted Liquid Glass `backdrop-blur-xl`, ambient glow, `<Suspense>` loader), ánh sáng studio, Environment map, hiệu ứng đèn gầm RGB Bloom (`EffectComposer`), OrbitControls và mô hình bàn phím cơ 7 lớp chi tiết dựng bằng procedural geometry sắc nét (Bottom Case, PCB, Poron Foam, Switch Plate, Switches, Keycaps, Top Case) kèm bảng điều khiển UI Glassmorphism tối giản.
- [ ] **1.4-exploded-view:** Lập trình animation tách lớp phần cứng mượt mà bằng `useFrame` + `MathUtils.lerp` khi bật/tắt `isExploded`, kèm nhãn chú thích (`Html` từ `@react-three/drei`) chỉ rõ từng lớp linh kiện khi bung ra.

## Chặng 2: AI Build Architect điều khiển 3D (Dùng Claude Code Pro chốt luồng + Antigravity code)
- [ ] **2.1-ai-tools:** Cài đặt `ai`, `@ai-sdk/google`, `zod`. Xây dựng API route `src/app/api/chat/route.ts` định nghĩa Tool Calling (`updateKeyboardConfig`, `toggleExplodedView`) để AI điều khiển trực tiếp 3D Canvas. Viết unit test kiểm tra schema validation của các tool.
- [ ] **2.2-chat-ui:** Dựng giao diện AI Acoustic Architect dạng MotionSites.ai Cinematic Floating Glassmorphism panel (spring-physics qua Framer Motion, glowing reactive borders, sound wave visualizer) đồng bộ thời gian thực với Zustand store và hiển thị trạng thái trực quan mỗi khi AI thực thi lệnh biến đổi bàn phím 3D.

## Chặng 3: Docker, PostgreSQL (`pgvector`), Redis, Authentication & Web Audio (Dùng Codex Plus)
- [ ] **3.1-docker-infra:** Tạo `docker-compose.yml` chạy `pgvector/pgvector:pg17` và `redis:7-alpine`. Cài đặt `drizzle-orm`, `pg`, `ioredis` và tạo schema (`src/db/schema.ts`) gồm bảng `users`, bảng `hardware_components` (có cột `vector(768)` cho RAG) và bảng `builds` (lưu cấu hình 3D dạng `JSONB` + user_id liên kết + slug chia sẻ).
- [ ] **3.1b-auth-security:** Xây dựng hệ thống Đăng ký / Đăng nhập hoàn chỉnh: JWT (Access Token + Refresh Token trong `httpOnly` secure cookies), mã hóa mật khẩu (`argon2`/`bcryptjs`), hỗ trợ Social OAuth (Google, GitHub). Tính năng bảo mật Brute-force Shield: theo dõi số lần đăng nhập sai bằng Redis theo IP/Tài khoản, nếu nhập sai quá 3 lần bắt buộc giải thử thách CAPTCHA (Turnstile / Security Challenge) và khóa tạm thời (Lockout) nếu tiếp tục cố tình dò mật khẩu. Kèm unit test toàn diện cho logic xác thực và bảo mật.
- [ ] **3.2-pgvector-rag:** Tạo script seed dữ liệu đặc tính âm học switch/plate thật kèm vector embedding vào PostgreSQL, tích hợp Semantic Search (`pgvector`) vào công cụ tư vấn của AI Chatbot + viết test kiểm tra truy vấn.
- [ ] **3.3-community-share-redis:** Xây dựng tính năng "Lưu & Chia sẻ bản Build" (`/api/builds` + trang xem/remix bản build `/build/[slug]`) liên kết với User Profile, dùng Redis để cache danh sách Trending Builds và áp dụng Rate Limiting chống spam cho `/api/chat`.
- [ ] **3.4-web-audio:** Xây dựng engine Web Audio API (`src/lib/soundEngine.ts`) tổng hợp tiếng gõ phím cơ thời gian thực khi người dùng gõ trên bàn phím thật, tự động biến đổi tần số và độ trầm/đanh theo chất liệu plate (`aluminum` vs `pom`/`fr4`) đang chọn, kèm unit test cho bộ tính toán tham số âm thanh.

## Chặng 4: Đóng gói Production & Hoàn thiện CV (Dùng Codex Plus + Claude Code Pro review cuối)
- [ ] **4.1-prod-docker:** Viết Multi-stage `Dockerfile` tối ưu cho Next.js, cập nhật `docker-compose.yml` chạy trọn gói cả 3 container (`app`, `db`, `cache`), viết `README.md` chuẩn chỉnh kèm sơ đồ kiến trúc Mermaid và hướng dẫn chạy 1 lệnh để đưa lên CV.

---
## Handoff Log (Nhật ký bàn giao giữa các AI)
- **[Task 1.0-blueprint] Hoàn thành ngày 14/11/2026:**
  - **Mô tả:** Đã hoàn thành bản vẽ thiết kế kiến trúc toàn diện cho KeyCraft 3D và chuẩn bị file mẫu biến môi trường.
  - **File đã tạo/sửa:**
    - `docs/theory/00-architecture-overview.md`: Tài liệu kiến trúc toàn cảnh 4 phần (Under the hood + ASCII data flow, Trade-offs, Thử thách thực hành 5 phút, 3 câu hỏi phỏng vấn thực chiến).
    - `.env.example`: Cấu hình mẫu sẵn sàng cho Google Gemini AI, PostgreSQL 17 (pgvector), Redis (Cache & Rate Limiting), Next.js App.
    - `PROGRESS.md`: Cập nhật trạng thái task 1.0 sang `[x]`.
  - **Biến môi trường mới:** `NODE_ENV`, `NEXT_PUBLIC_APP_URL`, `GOOGLE_GENERATIVE_AI_API_KEY`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `POSTGRES_HOST`, `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_URL`, `AI_RATE_LIMIT_MAX_REQUESTS`, `AI_RATE_LIMIT_WINDOW_SECONDS`.
  - **Next Step:** Đã xong Task 1.1-init.

- **[Task 1.1-init] Hoàn thành ngày 14/11/2026:**
  - **Mô tả:** Khởi tạo thành công cấu trúc Next.js App Router (TypeScript, Tailwind CSS v4, ESLint), cài đặt đầy đủ bộ thư viện 3D (`three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `postprocessing`), UI (`zustand`, `lucide-react`, `framer-motion`) và thiết lập bộ Auto-Test Vitest (`vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`). Giữ an toàn toàn bộ file hướng dẫn và workflow của dự án.
  - **File đã tạo/sửa:**
    - `package.json`: Cấu hình dependencies, devDependencies và script `"test": "vitest"`.
    - `vitest.config.mts`: Cấu hình Vitest với `@vitejs/plugin-react`, môi trường `jsdom`, alias `@/*`.
    - `src/app/page.test.tsx`: Unit test smoke test kiểm tra môi trường render component.
    - `docs/theory/01-nextjs-3d-test-setup.md`: Tài liệu lý thuyết 4 phần (RSC vs 3D Canvas, Trade-offs, Thử thách tự sửa code 5 phút, 3 câu hỏi phỏng vấn thực chiến).
    - `.gitignore`: Bổ sung rule bỏ qua node_modules, .next và giữ lại `.env.example`.
    - `PROGRESS.md`: Đánh dấu `[x]` cho Task 1.1.
  - **Kết quả xác thực:** Đạt 100% xanh cả 3 lệnh: `npx tsc --noEmit` (0 lỗi), `npm run lint` (0 lỗi), `npm test -- --run` (1/1 test passed).
  - **Next Step:** Đã xong Task 1.2-store.

- **[Task 1.2-store] Hoàn thành ngày 14/11/2026:**
  - **Mô tả:** Hoàn thành trung tâm điều phối trạng thái Zustand store (`useKeyboardStore.ts`) và bộ kiểu dữ liệu TypeScript nghiêm ngặt (`src/types/keyboard.ts`). Store quản lý toàn diện các thuộc tính: layout (65%, 75%, TKL), chế độ tách lớp (`isExploded`), chất liệu plate & case, switch type, màu sắc keycaps/case, hiệu ứng RGB underglow (màu, độ sáng clamp, bật/tắt), camera presets, và tự động đồng bộ hồ sơ âm học `soundProfile` (pitch, damping, resonance). Có sẵn action `applyAIConfig` phục vụ Agentic Tool Calling.
  - **File đã tạo/sửa:**
    - `src/types/keyboard.ts`: Kiểu dữ liệu TypeScript strict không dùng `any`.
    - `src/store/useKeyboardStore.ts`: Store Zustand và hàm `calculateSoundProfile`.
    - `src/store/useKeyboardStore.test.ts`: Bộ 15 unit tests cho store + 2 test helper âm học (tổng 17 test cases trong dự án).
    - `docs/theory/02-zustand-state-management.md`: Bài học lý thuyết 4 phần theo chuẩn Dual-Output Learning Mode (Transient updates, Trade-offs vs Redux/Context, 2 thử thách tự sửa code, 3 câu hỏi phỏng vấn thực chiến).
    - `PROGRESS.md`: Đánh dấu `[x]` Task 1.2.
  - **Kết quả xác thực:** Đạt 100% xanh cả 3 lệnh: `npx tsc --noEmit` (0 lỗi), `npm run lint` (0 lỗi), `npm test -- --run` (16/16 test passed).
  - **Next Step:** Sẵn sàng cho Task **1.3-3d-scene** (Dựng 3D Canvas `KeyboardScene.tsx` phong cách MotionSites.ai Cinematic Glassmorphism, ánh sáng studio, Bloom RGB, OrbitControls và mô hình bàn phím 7 lớp).