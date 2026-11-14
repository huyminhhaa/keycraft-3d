# 03. Không Gian 3D Studio & Bàn Phím Cơ Procedural 7 Lớp

> **Chủ đề:** Dựng Không gian 3D Studio Cinematic (React Three Fiber, Drei, Post-processing Bloom) và mô hình bàn phím cơ 7 lớp bằng Procedural Geometry, kết hợp giao diện Frosted Liquid Glass chuẩn MotionSites.ai.  
> **Mục tiêu:** Hiểu sâu bản chất kỹ thuật dựng hình tham số (Procedural 3D), hệ thống chiếu sáng studio 3 điểm, hiệu ứng hậu kỳ Bloom cho đèn LED RGB và cách Next.js App Router render WebGL không bị gián đoạn.

---

## 1. Bản chất hoạt động (Under the hood)

### 1.1. Luồng dữ liệu và cấu trúc các tầng hiển thị
Khi người dùng truy cập trang chính ([`src/app/page.tsx`](file:///d:/Projects/keycraft-3d/src/app/page.tsx)), ứng dụng kết hợp 3 lớp không gian:

```
[ Trình duyệt Người Dùng ]
      |
      +---> [ Lớp 1: Ambient Backdrop (CSS & Motion) ]
      |     - 3 quả cầu phát quang radial mesh gradient (Cyan, Indigo, Purple)
      |     - Lớp phủ nhiễu phim điện ảnh (Cinematic Noise Grid)
      |
      +---> [ Lớp 2: Không Gian 3D WebGL (Three.js / R3F Canvas) ]
      |     - CameraController: Điều hướng góc nhìn (Perspective, Top, Front, Side, Iso)
      |     - Hệ thống ánh sáng: Key Light (đổ bóng), Rim Light (viền kim loại), Fill Light
      |     - KeyboardModel (7 Lớp Procedural Geometry):
      |       1. Bottom Case (Nhôm CNC / PC mờ + Đèn gầm Underglow)
      |       2. PCB (Mạch in điện tử + Viền mạ vàng)
      |       3. Poron Foam (Mút tiêu âm)
      |       4. Switch Plate (Alu, PC, POM, FR4)
      |       5. Switches (Housing trong suốt + Stem màu theo loại switch)
      |       6. Keycaps (Phím chính + Phím điểm nhấn Esc, Enter, Space)
      |       7. Top Case (Khung nhôm viền trên)
      |     - ContactShadows: Đổ bóng tiếp xúc mặt sàn siêu thực
      |     - EffectComposer: Shader Bloom phát quang ánh sáng RGB
      |
      +---> [ Lớp 3: Giao diện Bento Glassmorphism (MotionSites.ai) ]
            - StudioNavbar: Logo, Live Pill Badge, nút Tách lớp
            - StudioControls: Bảng điều khiển chuyển tab (Phần cứng, Màu & RGB, Camera)
            - AcousticBadge: Bảng telemetry đo đạc sóng âm realtime
```

### 1.2. Giải thích các khái niệm đồ họa then chốt
1. **Procedural Geometry (Dựng hình tham số bằng code):**
   - Thay vì bắt trình duyệt tải file 3D `.gltf` hoặc `.obj` cồng kềnh (thường nặng từ 10MB–50MB và khó đổi layout linh hoạt), chúng ta dùng các khối hình học cơ bản (`boxGeometry`, `cylinderGeometry`) được tính toán vị trí bằng thuật toán toán học.
   - Nhờ đó, ứng dụng **tải gần như tức thì (0 MB tải ngoài)**, và khi người dùng đổi từ layout 65% sang 75% hay TKL, code sẽ tự tính lại số hàng/cột và vẽ lại phím trong vài mili-giây.
2. **Chiếu sáng Studio 3 điểm (Three-Point Lighting):**
   - **Key Light (Ánh sáng chính):** Đặt ở góc cao phía trước để tạo khối và bóng đổ sắc nét (`castShadow`).
   - **Rim Light (Ánh sáng ven):** Đặt phía sau lệch góc với màu xanh cyan nhạt (`#38bdf8`), giúp tách bạch các cạnh kim loại vát CNC của bàn phím khỏi nền tối.
   - **Fill Light (Ánh sáng phụ):** Ánh sáng tím dịu lấp đầy những vùng tối quá gắt.
3. **Hiệu ứng Hậu kỳ Bloom (Post-processing Bloom):**
   - Thư viện `@react-three/postprocessing` quét toàn bộ khung hình GPU sau khi render. Những pixel nào có độ sáng vượt qua ngưỡng `luminanceThreshold` (đặc biệt là vật liệu `meshStandardMaterial` có `emissive` của đèn LED dưới gầm), Bloom sẽ làm nhòe và khuếch tán ánh sáng ra xung quanh, tạo cảm giác bóng đèn LED neon phát quang như thực tế.

---

## 2. Tại sao chọn cách này (Trade-offs & Architectural Decisions)

| Hướng tiếp cận | Giải pháp trong KeyCraft 3D | Cách làm truyền thống | Phân tích Đánh đổi |
| :--- | :--- | :--- | :--- |
| **Nạp mô hình 3D** | **Procedural 3D Geometry** | Tải file `.gltf` / `.glb` tạo sẵn từ Blender | **Procedural:** Không tốn băng thông tải file, tùy biến màu sắc/kích thước từng phím linh hoạt 100% bằng code. Tuy nhiên cần viết code tính toán tọa độ lưới phím chi tiết hơn. |
| **Chất liệu kính & nhựa mờ** | **`meshPhysicalMaterial`** | `meshBasicMaterial` hoặc `meshLambertMaterial` | **`meshPhysicalMaterial`** hỗ trợ `transmission`, `roughness` và độ tán xạ ánh sáng, tạo ra cảm giác Polycarbonate/Acrylic mờ đục cao cấp đúng chuẩn bàn phím custom ngoài đời thực. |
| **Tích hợp Canvas vào Next.js**| **`dynamic(() => ..., { ssr: false })`** | Import trực tiếp `import Canvas ...` | Tránh hoàn toàn lỗi **Hydration Failed** do WebGL chỉ tồn tại ở phía Client trình duyệt, đảm bảo Server Component render khung HTML trước rồi mới mount Canvas mượt mà. |

---

## 3. Thử thách tự tay sửa code (5 phút)

Hãy trải nghiệm việc tùy biến đồ họa 3D trực tiếp trong mã nguồn:

### Thử thách 1: Thay đổi cường độ phát sáng Bloom của đèn LED gầm
1. Mở file [`src/components/canvas/KeyboardScene.tsx`](file:///d:/Projects/keycraft-3d/src/components/canvas/KeyboardScene.tsx#L125).
2. Tìm khối cấu hình `Bloom`:
   ```tsx
   <Bloom
     luminanceThreshold={0.75}
     luminanceSmoothing={0.9}
     intensity={1.1}
     mipmapBlur
   />
   ```
3. **Thử nghiệm:** Thử tăng `intensity={2.5}` và giảm `luminanceThreshold={0.4}`.
   - *Hiện tượng:* Toàn bộ đèn gầm RGB và các phím màu sáng sẽ tỏa ra vầng sáng rực rỡ phong cách Cyberpunk cực mạnh.

### Thử thách 2: Bổ sung thêm một Preset màu sắc cho Vỏ Case
1. Mở file [`src/components/ui/StudioControls.tsx`](file:///d:/Projects/keycraft-3d/src/components/ui/StudioControls.tsx#L85).
2. Trong mảng `caseColors`, thêm màu Vàng Champagne:
   ```typescript
   { label: 'Champagne Gold', hex: '#d97706' },
   ```
3. Chạy `npm test -- --run` để kiểm tra test tự động. Sau đó bạn sẽ thấy một nút màu vàng sang trọng xuất hiện trong tab **Màu & RGB**!

---

## 4. Ba câu hỏi phỏng vấn thực chiến (Interview Q&A)

### Câu hỏi 1: Tại sao trong Three.js, khi tạo nhiều đối tượng lặp lại (như 80+ phím switch), việc gom nhóm hoặc tối ưu số lượng Draw Calls lại quan trọng?
> **Đáp án:**  
> Mỗi một thẻ `<mesh>` thông thường tương ứng với một lệnh vẽ (Draw Call) gửi từ CPU sang GPU. Nếu một bàn phím có 80 phím, mỗi phím gồm 3 bộ phận (bottom housing, top housing, stem) cộng thêm keycap, tổng số Draw Calls có thể vượt quá 300–400 lệnh mỗi frame, làm nghẽn cổ chai CPU.  
> Để đạt hiệu năng tối đa khi dự án mở rộng, ta có thể áp dụng kỹ thuật **InstancedMesh** (`<instancedMesh>`), cho phép GPU vẽ hàng trăm phím giống nhau chỉ với **duy nhất 1 Draw Call**, giảm tải CPU tới 90%.

---

### Câu hỏi 2: Tại sao ta cần đặt `maxPolarAngle={Math.PI / 2.15}` trong `OrbitControls`?
> **Đáp án:**  
> Góc `polarAngle` đại diện cho góc quay theo phương thẳng đứng (từ trên đỉnh đầu xuống dưới chân). Góc $\pi / 2$ radian tương đương $90^\circ$ (ngang tầm mắt với mặt sàn).  
> Nếu không giới hạn góc này, người dùng khi kéo chuột sẽ xoay camera xuống bên dưới mặt sàn studio, nhìn thấy phần đáy rỗng của không gian 3D, phá vỡ trải nghiệm đắm chìm (Immersion). Đặt `Math.PI / 2.15` đảm bảo camera luôn dừng lại ở một góc nhìn điện ảnh vừa sát mặt bàn.

---

### Câu hỏi 3: Làm thế nào để phối hợp hiệu ứng `backdrop-blur` (Glassmorphism) của CSS với Canvas WebGL 3D mà không gây lag trình duyệt?
> **Đáp án:**  
> Lớp `backdrop-filter: blur(...)` trong CSS buộc trình duyệt phải chụp lại các pixel bên dưới nó rồi áp dụng thuật toán Gaussian Blur trên từng khung hình render. Nếu đặt các panel kính mờ quá lớn đè lên toàn bộ Canvas WebGL đang chuyển động liên tục, GPU sẽ phải tính toán 2 lần (render 3D + blur 2D).  
> **Giải pháp tối ưu:**
> 1. Sử dụng thuộc tính `pointer-events-none` cho container bao ngoài và chỉ bật `pointer-events-auto` trên từng thẻ card nhỏ gọn.
> 2. Giữ diện tích các panel kính ở mức vừa phải (dưới 30% diện tích màn hình) và sử dụng `will-change: transform` khi kích hoạt hoạt họa di chuyển bảng điều khiển.
