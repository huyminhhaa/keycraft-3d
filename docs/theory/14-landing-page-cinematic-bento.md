# Bách Khoa Toàn Thư Landing Page: Cinematic Bento Grid, Next.js Route Splitting & Interactive Audio Showcase

> **Mã tài liệu:** `14-landing-page-cinematic-bento`  
> **Dự án:** KeyCraft 3D — Custom Mechanical Keyboard Studio  
> **Thuộc chặng:** Mở rộng trải nghiệm sản phẩm thực tế (Landing Page & Studio Route Splitting)  
> **Trình độ:** Từ số 0 đến Senior Frontend & Design Engineer

---

## 1. Bách Khoa Công Nghệ Sử Dụng Trong Task

### 1.1. `Route Splitting` trong Next.js App Router (`/` vs `/studio`)
- **Định nghĩa:** `Route Splitting` (Tách định tuyến) là kỹ thuật chia tách trải nghiệm người dùng theo các đường dẫn URL độc lập trong cây thư mục `src/app/`. Thay vì nhồi nhét cả trang giới thiệu marketing và ứng dụng 3D nặng vào một trang duy nhất, ta tách thành:
  - `src/app/page.tsx` (`/`): Landing Page tĩnh/nhẹ, tối ưu SEO, tải nhanh dưới 1 giây, giới thiệu tính năng, review âm thanh trực tiếp.
  - `src/app/studio/page.tsx` (`/studio`): Không gian Studio 3D chuyên sâu, tải Three.js/R3F, OrbitControls, AI Chatbot và bảng điều khiển phần cứng.
- **Tác dụng trong KeyCraft 3D:**
  - Khách hàng mới truy cập không bị "đứng hình" chờ tải các shader 3D nặng của Three.js, mà thấy ngay trang giới thiệu Cinematic sang trọng, mượt mà.
  - Tối ưu hóa điểm số Web Vitals (FCP - First Contentful Paint, LCP - Largest Contentful Paint).
- **Cách sử dụng (Syntax chuẩn):**
  ```text
  src/app/
  ├── layout.tsx         # Root layout chung (font, metadata, theme)
  ├── page.tsx           # Route '/' -> Landing Page (Marketing & Showcase)
  ├── studio/
  │   └── page.tsx       # Route '/studio' -> 3D Keyboard Configurator Studio
  ```
- **Điểm mạnh (Pros):**
  - **Code Splitting tự động:** Next.js chỉ tải bundle JavaScript của Three.js và React Three Fiber khi người dùng bấm vào `/studio`.
  - **Trải nghiệm thương mại chuyên nghiệp:** Đúng chuẩn sản phẩm SaaS/E-commerce thực tế (như Apple, Spline, Figma).
- **Hạn chế (Cons):**
  - Cần chia sẻ trạng thái đồng bộ nếu muốn người dùng bấm "Thử cấu hình này" từ Landing Page chuyển thẳng sang Studio với thông số tương ứng.

---

### 1.2. `Bento Grid` Design System — Nghệ Thuật Sắp Đặt Thông Tin Đa Chiều
- **Định nghĩa:** Bento Grid (lấy cảm hứng từ hộp cơm bento truyền thống của Nhật Bản) là phong cách bố cục chia ô bất đối xứng (asymmetric grid) phổ biến trong thiết kế giao diện của Apple, Linear và MotionSites.ai. Mỗi tính năng được đóng gói trong một thẻ (card) với kích thước và trọng số thị giác khác nhau.
- **Tác dụng trong KeyCraft 3D:** Giới thiệu 4 trụ cột công nghệ của dự án trong một khung nhìn thống nhất:
  1. **3D Exploded View 7 Tầng:** Ô lớn nhất (span 2 cột trên desktop), nhấn mạnh tính năng bung linh kiện trực quan.
  2. **Web Audio Synthesizer:** Ô chuyên biệt với sóng âm và thông số mô phỏng âm học.
  3. **AI Acoustic Architect:** Ô thể hiện năng lực Agentic Tool Calling của Gemini.
  4. **Enterprise Security Shield:** Ô bảo mật Brute-force, JWT và Signed CAPTCHA.
- **Cách sử dụng (Syntax Tailwind CSS):**
  ```tsx
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {/* Thẻ chiếm 2 cột */}
    <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-xl">
      ...
    </div>
    {/* Thẻ chiếm 1 cột */}
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-xl">
      ...
    </div>
  </div>
  ```
- **Điểm mạnh (Pros):**
  - Trực quan, hiện đại, kích thích sự tò mò khám phá.
  - Tương thích hoàn hảo (Responsive) từ điện thoại 1 cột đến màn hình lớn 3 cột.
- **Hạn chế (Cons):**
  - Cần tính toán tỉ lệ `col-span` và `row-span` cẩn thận để không bị khoảng trống (orphan whitespace) trên các breakpoint trung gian (`md: 768px`).

---

### 1.3. `Interactive Hero Audio Preview` — Kích Hoạt Âm Thanh Tức Thì Không Cần 3D Canvas
- **Định nghĩa:** Nhúng trực tiếp singleton `soundEngine` (Web Audio API) vào thẻ xem trước trên Hero Section của Landing Page. Người dùng có thể click nghe thử 4 dạng âm thanh:
  - **Crisp Clack** (Plate Nhôm $680\text{Hz}$)
  - **Deep Thock** (Plate POM $340\text{Hz}$)
  - **Balanced Pop** (Plate FR4 $520\text{Hz}$)
  - **Silent Muted** (Plate PC $290\text{Hz}$)
- **Tác dụng:**
  - Cho phép người dùng kiểm chứng ngay giá trị cốt lõi của sản phẩm ("âm thanh giống thật") trong 3 giây đầu tiên mà chưa cần tải mô hình 3D.
  - Thỏa mãn chính sách User Gesture của trình duyệt: người dùng click vào thẻ preview sẽ đồng thời kích hoạt `AudioContext` ở trạng thái sẵn sàng (`running`).
- **Cách sử dụng:**
  ```typescript
  // Nhập trực tiếp soundEngine từ thư viện âm thanh
  import { soundEngine } from '@/lib/audio/soundEngine';

  function previewSound(plate: PlateMaterial, switchType: SwitchType) {
    soundEngine.playKeySound('KeyA', { plateMaterial: plate, switchType });
  }
  ```

---

## 2. Bản Chất Hoạt Động (Under The Hood)

### Sơ Đồ Kiến Trúc Luồng Người Dùng & Điều Hướng (Data & Navigation Flow)

```text
[ Người Dùng Truy Cập URL ]
            │
            ├──> "/" (Landing Page - src/app/page.tsx)
            │      │
            │      ├── [Hero Section]
            │      │     └── [Interactive Sound Preview] ──> Gọi soundEngine.playKeySound()
            │      │                                          (Chạy Web Audio API không cần Three.js)
            │      ├── [Bento Grid Features] (4 trụ cột: 3D, Audio, AI, Security)
            │      ├── [Acoustic Showcase] (So sánh 4 chất liệu Plate: Nhôm, POM, FR4, PC)
            │      ├── [Architecture Telemetry] (Next.js 16, Three.js, pgvector, Redis)
            │      └── [Nút "Trải Nghiệm Studio 3D" / CTA] ──> Chuyển hướng sang "/studio"
            │
            └──> "/studio" (3D Studio - src/app/studio/page.tsx)
                   │
                   ├── [3D Canvas Dynamic Import] ──> Tải Three.js, R3F, Shaders, 7-layer Model
                   ├── [Sidebar Controls] (Thiết kế, Âm thanh, Trợ lý AI)
                   └── [Zustand Store] (useKeyboardStore & useStageStore)
```

### Các Khái Niệm Cốt Lõi Từ Số 0
1. **Zero-asset Sound Rendering:** Không một file `.mp3` hay `.wav` nào cần được tải về qua mạng. Mọi âm sắc đều được tính toán từ các hàm toán học vật lý (`OscillatorNode`, `BiquadFilterNode`, `Math.random()`) với thời gian phản hồi bằng 0 mili-giây.
2. **Cinematic Dark Luxury Aesthetic:**
   - Nền đen than chì sâu thẳm (`bg-[#0c0d0e]`).
   - Viền kim loại mảnh phát quang nhẹ (`border-white/10`, `hover:border-cyan-500/30`).
   - Lớp kính mờ lỏng (`backdrop-blur-xl bg-white/[0.02]`).
   - Điểm nhấn thị giác (Accent) bằng màu xanh ngọc Cyan (`#06b6d4`) và tím Indigo ma mị.

---

## 3. Tại Sao Chọn Cách Này (Trade-offs)

| Tiêu Chí | Cách Làm Cũ (Tất Cả Trong 1 Trang `/`) | Cách Làm Mới (Route Splitting `/` & `/studio`) |
| :--- | :--- | :--- |
| **Tốc độ mở trang (First Load)** | Phải tải Three.js + Canvas 3D + Shaders (~2.5MB JS), máy yếu mất 2-4s. | Landing page chỉ tải HTML/Tailwind siêu nhẹ (<150KB), xuất hiện gần như tức thì (<300ms). |
| **SEO & Marketing** | Khó làm SEO vì canvas che hết nội dung văn bản ngữ nghĩa. | Đầy đủ thẻ H1, H2, đoạn văn, schema dữ liệu có cấu trúc thân thiện với Google Search. |
| **Trải nghiệm âm thanh** | Phải vào tận studio, bấm vào phím 3D mới nghe được. | Nghe thử ngay 4 chất âm tại Hero Section chỉ với 1 cú click chuột. |
| **Độ phức tạp bảo trì** | Toàn bộ logic marketing và logic 3D bị trộn lẫn trong một file. | Tách bạch rõ ràng: `src/app/page.tsx` cho Marketing, `src/app/studio/page.tsx` cho 3D Studio. |

---

## 4. Thử Thách Tự Tay Sửa Code (5 Phút)

### Thử thách 1: Đổi âm thanh mặc định khi bấm vào thẻ Hero Preview
- **Mục tiêu:** Khi bấm vào thẻ nghe thử phím trên Landing Page, thay vì gõ phím `KeyA`, hãy đổi sang phím Spacebar để nghe tiếng trầm và buồng ngân sâu hơn.
- **Vị trí file:** `src/app/page.tsx`
- **Cách sửa:** Tìm hàm `playPreviewSound` và đổi mã phím:
  ```typescript
  // Tìm đoạn code này:
  soundEngine.playKeySound('KeyA', {
    plateMaterial: soundPreviews[activeSoundIndex].plate,
    switchType: soundPreviews[activeSoundIndex].switchType,
  });

  // Đổi 'KeyA' thành 'Space':
  soundEngine.playKeySound('Space', {
    plateMaterial: soundPreviews[activeSoundIndex].plate,
    switchType: soundPreviews[activeSoundIndex].switchType,
  });
  ```
- **Kết quả:** Bấm nghe thử trên Landing Page sẽ phát ra tiếng đập spacebar rỗng và trầm hơn hẳn.

---

## 5. Ba Câu Hỏi Phỏng Vấn Thực Chiến

### Câu 1: Tại sao trong Next.js App Router, ta nên tách Landing Page (`/`) và Ứng dụng tương tác 3D (`/studio`) thành 2 route riêng biệt thay vì gom chung?
> **Đáp án:**  
> 1. **Hiệu năng & Bundle Size:** Các thư viện đồ họa 3D (`three`, `@react-three/fiber`, `@react-three/drei`) có dung lượng bundle khá lớn. Nếu gom chung, người dùng vừa vào trang chủ sẽ bị chặn luồng render (Render-blocking) để tải toàn bộ thư viện 3D dù họ chỉ muốn đọc thông tin. Tách route giúp Next.js tự động thực hiện **Route-based Code Splitting**.  
> 2. **Tối ưu hóa Core Web Vitals:** Giúp trang chủ đạt điểm FCP (First Contentful Paint) và LCP (Largest Contentful Paint) gần như tuyệt đối, cải thiện thứ hạng SEO.  
> 3. **Phân tách trách nhiệm (Separation of Concerns):** Landing page tập trung vào chuyển đổi (Conversion, Call-to-action, Storytelling), trong khi trang Studio tập trung vào hiệu năng tính toán 60fps và tương tác thời gian thực.

---

### Câu 2: Khi người dùng bấm nghe thử âm thanh trên Landing Page, làm thế nào để đảm bảo không vi phạm chính sách Autoplay Policy của trình duyệt?
> **Đáp án:**  
> Trình duyệt hiện đại (Chrome, Safari) yêu cầu `AudioContext` phải được kích hoạt hoặc tiếp tục (`ctx.resume()`) sau một hành động chủ động từ người dùng (**User Gesture** như click chuột hoặc tap màn hình).  
> Trong `src/lib/audio/soundEngine.ts`, phương thức `playKeySound` luôn kiểm tra:
> ```typescript
> if (this.audioCtx.state === 'suspended') {
>   this.audioCtx.resume();
> }
> ```
> Do hàm này chỉ được gọi trong sự kiện `onClick` của nút "Bấm nghe thử", hành vi này hoàn toàn hợp lệ theo User Gesture Policy và âm thanh phát ra ngay lập tức mà không bị trình duyệt chặn.

---

### Câu 3: Làm thế nào để Bento Grid hiển thị đẹp mắt và không bị vỡ layout khi màn hình co giãn từ điện thoại đến màn hình siêu rộng (Ultra-wide)?
> **Đáp án:**  
> Áp dụng cơ chế **Mobile-first Responsive CSS Grid**:  
> 1. Mặc định trên màn hình di động: `grid-cols-1` (tất cả các thẻ xếp chồng theo chiều dọc một cách tự nhiên).  
> 2. Trên màn hình máy tính bảng: `md:grid-cols-2`.  
> 3. Trên màn hình máy tính để bàn: `lg:grid-cols-3`, kết hợp `lg:col-span-2` cho thẻ có mức độ quan trọng cao nhất (Hero feature) và `lg:col-span-1` cho các thẻ thông số vệ tinh.  
> 4. Luôn thiết lập `min-h` cố định hoặc `flex-col justify-between` để chiều cao các thẻ cùng hàng hài hòa, tránh tình trạng răng cưa không đồng đều.
