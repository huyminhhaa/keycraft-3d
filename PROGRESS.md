# Lộ trình & Trạng thái Dự án KeyCraft 3D

## Chặng 1: Nền tảng, Không gian 3D & State (Dùng Antigravity Pro)
- [ ] **1.0-blueprint:** Chưa cần tạo app Next.js. Hãy tạo file `docs/theory/00-architecture-overview.md` giải thích bức tranh toàn cảnh kiến trúc hệ thống KeyCraft 3D (cách Frontend 3D, Zustand, AI Tool Calling, PostgreSQL `pgvector` và Redis phối hợp với nhau) bằng ngôn ngữ dễ hiểu cho người mới từ số 0, kèm sơ đồ luồng dữ liệu ASCII và tạo file `.env.example` chuẩn bị sẵn các biến môi trường cần thiết.
- [ ] **1.1-init:** Khởi tạo Next.js (TypeScript, Tailwind, ESLint, App Router, `src/` directory) trực tiếp vào thư mục hiện tại (LƯU Ý: giữ nguyên `CLAUDE.md`, `AGENTS.md`, `PROGRESS.md`, `docs/`, `.claude/`, `.agents/`, `.codex/`, `scripts/`). Cài đặt bộ thư viện 3D & UI: `three`, `@types/three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `postprocessing`, `zustand`, `lucide-react`, `framer-motion`, và bộ Auto-Test: `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`. Cấu hình script `"test": "vitest"` trong `package.json`.
- [ ] **1.2-store:** Tạo Zustand store (`src/store/useKeyboardStore.ts`) quản lý layout (`65%`, `75%`, `TKL`), chế độ tách lớp (`isExploded`), chất liệu case/plate (`aluminum`, `polycarbonate`, `pom`, `fr4`), màu sắc keycap/underglow và camera preset. Viết bộ unit test đầy đủ (`src/store/useKeyboardStore.test.ts`) kiểm tra mọi action đổi trạng thái.
- [ ] **1.3-3d-scene:** Dựng 3D Canvas (`src/components/canvas/KeyboardScene.tsx`) với `<Suspense>` loader, ánh sáng studio, Environment map, hiệu ứng đèn gầm RGB Bloom (`EffectComposer`), OrbitControls và mô hình bàn phím cơ 7 lớp chi tiết dựng bằng procedural geometry sắc nét (Bottom Case, PCB, Poron Foam, Switch Plate, Switches, Keycaps, Top Case) kèm bảng điều khiển UI Glassmorphism tối giản.
- [ ] **1.4-exploded-view:** Lập trình animation tách lớp phần cứng mượt mà bằng `useFrame` + `MathUtils.lerp` khi bật/tắt `isExploded`, kèm nhãn chú thích (`Html` từ `@react-three/drei`) chỉ rõ từng lớp linh kiện khi bung ra.

## Chặng 2: AI Build Architect điều khiển 3D (Dùng Claude Code Pro chốt luồng + Antigravity code)
- [ ] **2.1-ai-tools:** Cài đặt `ai`, `@ai-sdk/google`, `zod`. Xây dựng API route `src/app/api/chat/route.ts` định nghĩa Tool Calling (`updateKeyboardConfig`, `toggleExplodedView`) để AI điều khiển trực tiếp 3D Canvas. Viết unit test kiểm tra schema validation của các tool.
- [ ] **2.2-chat-ui:** Dựng giao diện AI Acoustic Architect dạng Glassmorphism floating panel đồng bộ thời gian thực với Zustand store và hiển thị trạng thái trực quan mỗi khi AI thực thi lệnh biến đổi bàn phím 3D.

## Chặng 3: Docker, PostgreSQL (`pgvector`), Redis & Web Audio (Dùng Codex Plus)
- [ ] **3.1-docker-infra:** Tạo `docker-compose.yml` chạy `pgvector/pgvector:pg17` và `redis:7-alpine`. Cài đặt `drizzle-orm`, `pg`, `ioredis` và tạo schema (`src/db/schema.ts`) gồm bảng `hardware_components` (có cột `vector(768)` cho RAG) và bảng `builds` (lưu cấu hình 3D dạng `JSONB` + slug chia sẻ).
- [ ] **3.2-pgvector-rag:** Tạo script seed dữ liệu đặc tính âm học switch/plate thật kèm vector embedding vào PostgreSQL, tích hợp Semantic Search (`pgvector`) vào công cụ tư vấn của AI Chatbot + viết test kiểm tra truy vấn.
- [ ] **3.3-community-share-redis:** Xây dựng tính năng "Lưu & Chia sẻ bản Build" (`/api/builds` + trang xem/remix bản build `/build/[slug]`) lưu vào PostgreSQL `JSONB`, dùng Redis để cache danh sách Trending Builds và áp dụng Rate Limiting chống spam cho `/api/chat`.
- [ ] **3.4-web-audio:** Xây dựng engine Web Audio API (`src/lib/soundEngine.ts`) tổng hợp tiếng gõ phím cơ thời gian thực khi người dùng gõ trên bàn phím thật, tự động biến đổi tần số và độ trầm/đanh theo chất liệu plate (`aluminum` vs `pom`/`fr4`) đang chọn, kèm unit test cho bộ tính toán tham số âm thanh.

## Chặng 4: Đóng gói Production & Hoàn thiện CV (Dùng Codex Plus + Claude Code Pro review cuối)
- [ ] **4.1-prod-docker:** Viết Multi-stage `Dockerfile` tối ưu cho Next.js, cập nhật `docker-compose.yml` chạy trọn gói cả 3 container (`app`, `db`, `cache`), viết `README.md` chuẩn chỉnh kèm sơ đồ kiến trúc Mermaid và hướng dẫn chạy 1 lệnh để đưa lên CV.

---
## Handoff Log (Nhật ký bàn giao giữa các AI)
- *(Chưa có task nào hoàn thành — Bắt đầu từ Task 1.0-blueprint)*