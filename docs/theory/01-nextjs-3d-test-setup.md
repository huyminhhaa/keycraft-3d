# 01. Thiết Lập Nền Tảng Next.js, 3D Graphics & Vitest Test Runner

> **Chủ đề:** Khởi tạo cấu trúc dự án Next.js (App Router, TypeScript Strict, Tailwind CSS v4), tích hợp bộ sinh thái 3D (React Three Fiber, Drei, Postprocessing) và hệ thống kiểm thử tự động Vitest.  
> **Mục tiêu:** Hiểu sâu bản chất cách Next.js kết hợp với Canvas đồ họa 3D, sự khác biệt giữa SSR và Client-side 3D rendering, và cách thiết lập môi trường test tốc độ cao cho đồ họa & UI.

---

## 1. Bản chất hoạt động (Under the hood)

### 1.1. Luồng chạy của Next.js kết hợp với 3D Canvas
Next.js sử dụng kiến trúc **React Server Components (RSC)** theo mặc định trong App Router. Điều này tạo ra một thách thức cơ bản khi làm việc với 3D (WebGL / Three.js):
- **Server Environment:** Node.js trên server **không có đối tượng `window`**, không có `document`, và không có WebGL context (card đồ họa GPU).
- **Client Canvas (`@react-three/fiber`):** Cần truy cập trực tiếp vào WebGL2 Rendering Context, sự kiện chuột/chạm và canvas DOM element để dựng hình ở 60/120 FPS.

```
       [ Client Request / Trình duyệt gửi yêu cầu ]
                           |
                           v
          +---------------------------------+
          |    Next.js Server (Node.js)     |
          |  - Render trước khung HTML/CSS  |
          |  - Server Component: layout.tsx |
          +----------------+----------------+
                           |
           Gửi HTML sơ bộ  |
                           v
       +---------------------------------------+
       |         Trình duyệt Người Dùng        |
       |  1. Nhận HTML/CSS ban đầu             |
       |  2. Hydration: Nạp JavaScript bundle  |
       |  3. Kích hoạt 'use client' Component  |
       +-------------------+-------------------+
                           |
                           v
       +---------------------------------------+
       |   React Three Fiber (<Canvas>)        |
       |  - Khởi tạo WebGLRenderer             |
       |  - Tạo PerspectiveCamera, Studio Light|
       |  - Bắt đầu RequestAnimationFrame loop |
       +---------------------------------------+
```

### 1.2. Vai trò của từng thư viện trong bộ công cụ vừa cài đặt
1. **`three` & `@types/three`:** Thư viện tính toán đồ họa 3D nền tảng (Vector3, Matrix4, Mesh, Material, BufferGeometry, PBR Lighting).
2. **`@react-three/fiber` (R3F):** Cầu nối (Reconciler) cho phép viết Three.js dưới dạng declarative JSX trong React. Thay vì viết `const mesh = new THREE.Mesh(...)`, ta chỉ cần viết `<mesh><boxGeometry /><meshStandardMaterial /></mesh>`.
3. **`@react-three/drei`:** Tập hợp các helper tiện ích chuẩn công nghiệp: OrbitControls (xoay camera), Environment (nạp ảnh HDR ánh sáng môi trường), Html (gắn thẻ HTML nổi lên trên tọa độ 3D), Center (căn giữa mô hình).
4. **`@react-three/postprocessing` & `postprocessing`:** Hệ thống xử lý hậu kỳ (Post-processing pipeline). Cho phép thêm hiệu ứng Bloom (ánh sáng phát quang cho đèn LED RGB bàn phím), Ambient Occlusion (đổ bóng tiếp xúc) và Vignette trực tiếp qua GPU shader.
5. **`zustand`:** Quản lý trạng thái siêu nhẹ (~1KB) chạy được cả bên trong lẫn bên ngoài React render loop.
6. **`vitest` + `jsdom` + `@testing-library/react`:**
   - `vitest`: Bộ chạy test (test runner) dựa trên engine Vite cực nhanh, hỗ trợ ESM và TypeScript trực tiếp không cần biên dịch trung gian cồng kềnh.
   - `jsdom`: Giả lập môi trường trình duyệt (DOM, `window`, `document`) trong môi trường dòng lệnh Node.js để React Testing Library có thể render component và kiểm thử logic.

---

## 2. Tại sao chọn cách này (Trade-offs & Decisions)

| Lựa chọn | Giải pháp trong KeyCraft 3D | Lựa chọn thay thế | Phân tích Đánh đổi |
| :--- | :--- | :--- | :--- |
| **Test Runner** | **Vitest** | Jest + `ts-jest` | **Vitest** nhanh hơn Jest gấp 3–5 lần nhờ tận dụng pipeline phân tích module của Vite. Không cần cấu hình Babel/Webpack phức tạp, nhận diện alias `@/*` tự động từ `tsconfig.json`. |
| **3D Ecosystem** | **React Three Fiber (R3F)** | Vanilla Three.js (`new THREE.Scene()`) | Viết Three.js thuần trong React rất dễ gây memory leak nếu quên `dispose()` geometry/texture khi unmount. R3F tự động quản lý vòng đời (lifecycle), giải phóng VRAM GPU và đồng bộ hoàn hảo với state của React. |
| **Next.js Router** | **App Router (`src/app`)** | Pages Router (`src/pages`) | App Router hỗ trợ React 19, Server Components, Streaming HTML và layout lồng nhau (Nested Layouts), chuẩn bị tối ưu cho tính năng chia sẻ link build bàn phím động (Dynamic OpenGraph & SEO) ở các chặng sau. |

---

## 3. Thử thách tự tay sửa code (5 phút)

Hãy thử nghiệm khả năng tự động hóa và cơ chế phát hiện lỗi của hệ thống kiểm thử:

### Thử thách 1: Cố tình làm hỏng Unit Test để quan sát Auto-Test bắt lỗi
1. Mở file [`src/app/page.test.tsx`](file:///d:/Projects/keycraft-3d/src/app/page.test.tsx#L8).
2. Tại dòng 8, sửa tìm thẻ heading level 1 thành level 2:
   ```tsx
   // Đổi từ:
   expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
   // Thành:
   expect(screen.getByRole('heading', { level: 2 })).toBeDefined();
   ```
3. Chạy lệnh trong terminal:
   ```bash
   npm test -- --run
   ```
4. **Quan sát:** Vitest sẽ báo đỏ ngay lập tức và in rõ `TestingLibraryElementError: Unable to find an accessible element with the role "heading" and name ...`. Hãy sửa lại thành `{ level: 1 }` và chạy lại để thấy test xanh 100%.

### Thử thách 2: Kiểm tra khả năng bắt lỗi kiểu dữ liệu của TypeScript Strict
1. Mở file [`src/app/page.tsx`](file:///d:/Projects/keycraft-3d/src/app/page.tsx#L3).
2. Thêm một biến có kiểu sai vào đầu hàm `Home`:
   ```tsx
   const testCount: number = "đây là chuỗi";
   ```
3. Chạy lệnh:
   ```bash
   npx tsc --noEmit
   ```
4. **Quan sát:** TypeScript compiler sẽ lập tức chặn lại với lỗi `Type 'string' is not assignable to type 'number'`. Đây chính là "lá chắn thép" bảo vệ dự án khỏi các lỗi tiềm ẩn khi vận hành sản phẩm thật. (Sau khi thử xong, nhớ xóa dòng này đi).

---

## 4. Ba câu hỏi phỏng vấn thực chiến (Interview Q&A)

### Câu hỏi 1: Khi render component 3D (`@react-three/fiber`) trong Next.js App Router, lỗi phổ biến nhất là gì và xử lý thế nào?
> **Đáp án:**  
> Lỗi phổ biến nhất là **Hydration Mismatch** hoặc lỗi `window is not defined / WebGL context not supported`. Nguyên nhân do Next.js cố gắng render trước (pre-render) Canvas 3D trên môi trường server Node.js vốn không có WebGL context.  
> **Cách khắc phục:**
> 1. Đặt chỉ thị `'use client'` ở đầu component chứa Canvas.
> 2. Sử dụng dynamic import với tùy chọn SSR tắt:
>    ```tsx
>    const KeyboardScene = dynamic(() => import('@/components/canvas/KeyboardScene'), { ssr: false });
>    ```
> 3. Luôn bọc component 3D bên trong `<Suspense fallback={<LoadingSpinner />}>` để đảm bảo giao diện hiển thị mượt mà trong lúc GPU nạp tài nguyên 3D.

---

### Câu hỏi 2: Tại sao Vitest cần môi trường `jsdom` khi kiểm thử các React component?
> **Đáp án:**  
> Vitest chạy trên môi trường Node.js dòng lệnh — nơi không có cây DOM thực tế (không có `document.createElement`, không có `window.addEventListener`). Khi kiểm thử component React bằng `@testing-library/react`, thư viện cần mount component vào DOM để truy vấn các element (`getByRole`, `click`).  
> `jsdom` là thư viện thuần JavaScript mô phỏng hoàn chỉnh các API tiêu chuẩn của trình duyệt (HTML, DOM, Events) ngay trong bộ nhớ của Node.js, giúp ta kiểm thử component và hành vi người dùng mà không cần mở một trình duyệt thật cồng kềnh.

---

### Câu hỏi 3: Trong dự án đồ họa 3D WebGL, tại sao việc quản lý vòng đời giải phóng tài nguyên (Memory Cleanup / Disposing) lại tối quan trọng?
> **Đáp án:**  
> Khác với JavaScript thông thường có cơ chế Garbage Collection (GC) tự động thu hồi bộ nhớ RAM, các tài nguyên 3D như **Geometries, Textures, Materials và Framebuffers** được nạp trực tiếp vào **VRAM của GPU**.  
> Bộ dọn rác của JavaScript không thể tự động giải phóng VRAM. Nếu một component 3D unmount mà không gọi phương thức `.dispose()`, tài nguyên sẽ tồn đọng trên card đồ họa. Khi người dùng chuyển trang hoặc đổi cấu hình nhiều lần, VRAM sẽ bị tràn dẫn đến hiện tượng treo tab hoặc trình duyệt crash WebGL Context (`WebGL context lost`). React Three Fiber giải quyết việc này bằng cách tự động gọi `dispose()` trên các mesh và material khi component rời khỏi cây React.
