# Bài học Lý thuyết 25: Đồ Họa 3D Siêu Thực PBR, Điêu Khắc Keycap Chuẩn 5 Profile & Studio Lighting

> **Mã task:** `5.1-photorealistic-pbr`  
> **Chặng 5:** Nâng cấp Đồ họa Siêu thực & Trang tự build /assembly (Chuẩn KeyCapy)  
> **Mục tiêu:** Xóa bỏ hoàn toàn cảm giác "đồ họa nhựa giả lập", đưa KeyCraft 3D đạt đẳng cấp render studio siêu thực với công nghệ Micro-PBR procedural, điêu khắc vertex mesh chuẩn 5 Profile (Cherry, OEM, XDA, MOA, SA) và nâng cấp ánh sáng ấm điện ảnh.

---

## 1. Bách khoa Công nghệ Sử dụng trong Task

### 1.1. Procedural Micro-PBR Textures (`DataTexture`)
- **Định nghĩa:** Thay vì tải các tệp ảnh PNG/JPG nặng nề từ internet (dễ lỗi mạng, CORS và tốn băng thông), ta sinh trực tiếp ma trận điểm ảnh nhị phân trong bộ nhớ RAM bằng mảng nhị phân `Uint8Array` rồi bọc vào `THREE.DataTexture(data, width, height, RGBAFormat)`.
- **Tác dụng trong KeyCraft 3D:**
  - Kênh **R (Red)** lưu độ cao vi mô (`bumpMap`), tạo các hạt sần micro-surface siêu mịn.
  - Kênh **G (Green)** lưu độ nhám vi mô (`roughnessMap`), khiến ánh sáng phản xạ tán xạ tự nhiên.
  - Kênh **B (Blue)** lưu độ kim loại (`metalnessMap`), phân biệt rõ kim loại nhôm CNC với nhựa PBT phi kim.
- **Cách sử dụng (Syntax chuẩn):**
  ```typescript
  import * as THREE from 'three';

  const size = 256;
  const data = new Uint8Array(size * size * 4);
  // Điền dữ liệu RGBA cho từng pixel
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  ```
- **Điểm mạnh (Pros):**
  - Tải tức thì 0ms, không phụ thuộc mạng, dung lượng bundle cực nhẹ.
  - Chạy được ở cả môi trường trình duyệt WebGL lẫn môi trường Node.js / jsdom khi chạy unit tests (không bị lỗi thiếu `HTMLCanvasElement`).
- **Điểm yếu / Hạn chế (Cons):**
  - Cần tính toán công thức toán học (PRNG, sóng sin/cos, noise) khéo léo để tạo vân vật liệu thuyết phục.

---

### 1.2. AgX Tone Mapping (`THREE.AgXToneMapping`)
- **Định nghĩa:** Thuật toán biến đổi dải màu động cao (HDR - High Dynamic Range) sang dải màu màn hình tiêu chuẩn (SDR), được phát triển để khắc phục nhược điểm "cháy sáng đổi màu" (hue shift và clipping) của ACES Filmic.
- **Tác dụng trong KeyCraft 3D:** Khi đèn studio chiếu gắt vào góc nhôm hoặc mặt phím trắng, ACES Filmic thường làm bết trắng và ngả vàng/xanh gắt. AgX giữ nguyên sắc thái màu gốc (hue constancy), tạo vùng chuyển sáng mịn màng như phim nhựa điện ảnh cao cấp.
- **Cách sử dụng:**
  ```tsx
  <Canvas gl={{ antialias: true, toneMapping: THREE.AgXToneMapping, toneMappingExposure: 1.05 }}>
  ```
- **Ưu & Nhược điểm:**
  - *Pros:* Màu sắc trung thực, không bị bệt màu ở vùng highlight, loại bỏ cảm giác "game 3D rẻ tiền".
  - *Cons:* Yêu cầu Three.js r155 trở lên và cần tinh chỉnh nhẹ độ phơi sáng (`toneMappingExposure ~ 1.05`) để tránh ảnh bị sẫm màu.

---

### 1.3. N8AO (Screen Space Ambient Occlusion) & Crevice Shadowing
- **Định nghĩa:** Bộ đổ bóng hốc kẹt thế hệ mới cho Three.js (`@react-three/postprocessing`).
- **Tác dụng trong KeyCraft 3D:** Tạo bóng tối tự nhiên ở khe hở 1mm giữa các nút phím và chân switch cắm trên plate. Nhờ đó, các nút phím tách biệt rõ ràng thay vì dính liền thành một mảng phẳng.
- **Cấu hình tối ưu:**
  ```tsx
  <EffectComposer multisampling={4}>
    <N8AO aoRadius={0.45} distanceFalloff={0.7} intensity={2.0} quality="performance" />
    <Bloom mipmapBlur luminanceThreshold={1.15} intensity={0.35} />
  </EffectComposer>
  ```

---

### 1.4. Điêu khắc Vertex Mesh Keycap 5 Profile (`src/lib/keycapGeometry.ts`)
- **Định nghĩa:** Kỹ thuật thao tác trực tiếp lên toạ độ đỉnh `(x, y, z)` của hình học 3D (`BufferAttribute.position`) để tạo ra hình dáng keycap cơ học chuẩn xác của 5 profile:
  1. **Cherry:** Thấp gọn, nghiêng theo hàng R1–R4, lõm trụ (cylindrical dish) theo trục X.
  2. **OEM:** Tương tự Cherry nhưng thân cao hơn 18% và độ dốc lớn hơn 15%.
  3. **XDA:** Chiều cao đồng đều 0.17, mặt phím rộng (`topScale = 0.86`), lòng chảo cầu nông.
  4. **MOA:** Chiều cao 0.205, bo tròn 4 góc cực mềm (`radius = 0.09`) như viên kẹo marshmallow, lòng chảo cầu sâu 0.045.
  5. **SA:** Cao vút (+35% so với Cherry), bo tròn cổ điển, lòng chảo cầu sâu 0.055 chuẩn phong cách bàn phím máy tính cổ điển thập niên 1970s.

---

## 2. Bản chất Hoạt động (Under the Hood)

Sơ đồ luồng hình thành vật liệu và mô hình 3D siêu thực:

```
[Profile & Parameters] (Cherry/OEM/XDA/MOA/SA, row 1-4, widthU)
         │
         ▼
[src/lib/keycapGeometry.ts]
  ├── 1. Tạo RoundedBoxGeometry(bottomWidth, height, bottomDepth, 6, radius)
  ├── 2. Bóc tách và chia lưới mịn mặt trên (12x12 quads = 288 triangles)
  ├── 3. Vertex Deformation (y > 0):
  │       ├── Taper: x, z thu nhỏ dần về đỉnh theo topScale
  │       ├── Concave Dish: trừ tọa độ y theo bán kính tâm r (trụ hoặc cầu)
  │       └── Tilt: nghiêng mặt phím theo hàng profile (slope = tan(tilt))
  ├── 4. World-space UV Mapping (giữ kích thước hạt PBT đều trên mọi phím)
  ├── 5. Translate yMin về chính xác y = 0
  └── 6. computeVertexNormals() & lưu Cache
         │
         ▼
[src/lib/textures.ts] (DataTexture 256x256 Micro-PBR)
  ├── PBT Noise: Bump (110-170) + Roughness (~0.72) + Sheen
  ├── CNC Aluminum: Bead-blast bump + Roughness (~0.26) + Metalness (~0.85)
  ├── Deskmat Fabric: Sợi dệt đan chéo sin/cos + Roughness (~0.88)
  └── Switch Housing: MeshPhysicalMaterial (transmission 0.7, ior 1.48)
         │
         ▼
[Render Scene (KeyboardScene.tsx & StudioLighting.tsx)]
  ├── Ánh sáng: DirectionalLight màu nắng ấm #fff3e0 (intensity 2.4) + Ambient ấm #fff6eb
  ├── Shadow: ContactShadows (opacity 0.5, blur 2.0)
  ├── Tone Mapping: THREE.AgXToneMapping (exposure 1.05)
  └── Hậu kỳ: N8AO (bóng khe phím aoRadius 0.45) + Bloom nhẹ mipmapBlur
```

---

## 3. Tại sao Chọn Cách này (Trade-offs & So sánh)

| Tiêu chí | Cách làm thông thường (Box phẳng / Tải file ảnh ngoài) | Giải pháp của KeyCraft 3D (Task 5.1) |
| :--- | :--- | :--- |
| **Hình học Keycap** | Dùng `BoxGeometry` hoặc `CylinderGeometry` phẳng lì, không có lòng chảo lõm, nhìn như đồ chơi lego. | **Vertex Sculpting trên RoundedBox:** Lõm trụ cho Cherry/OEM, lõm cầu cho MOA/SA/XDA, bo tròn 4 góc mềm mại chuẩn CAD. |
| **Vật liệu PBR** | Tải texture ảnh PNG từ mạng (nặng vài MB, dễ 404, cần xử lý CORS). | **Procedural DataTexture:** Sinh trực tiếp bằng `Uint8Array` trong RAM, 0ms tải, hoàn hảo cho cả WebGL lẫn Vitest node environment. |
| **Màu sắc & Ánh sáng** | Dùng Reinhard hoặc ACES Filmic làm cháy sáng bẹt mép, ánh sáng trắng lạnh nhân tạo. | **AgX Tone Mapping + Nắng ấm (#fff3e0):** Giữ độ bão hòa màu nguyên bản, bóng đổ mềm mại, không cháy sáng. |
| **Bóng đổ khe phím** | Không có hoặc chỉ có bóng đổ phẳng, giữa các phím không có chiều sâu. | **N8AO SSAO:** Bóng đổ tối ở khe hở 1mm giữa các phím tạo cảm giác bàn phím thật nằm trên bàn. |

---

## 4. Thử thách Tự tay Sửa Code (5 Phút)

### Thử thách 1: Biến bàn phím sang Profile MOA "viên kẹo" siêu tròn
- **File:** `src/store/useKeyboardStore.ts`
- **Cách làm:** Tìm dòng khởi tạo `keycapProfile` (mặc định `'cherry'`), sửa thành `'moa'`:
  ```typescript
  keycapProfile: 'moa',
  ```
- **Hiện tượng trên trình duyệt:** Mở `http://localhost:3000/studio`, bạn sẽ thấy toàn bộ các phím đổi sang phom bầu bĩnh, 4 góc bo tròn mềm mại như viên kẹo kẹo dẻo Marshmallow và mặt trên lõm tròn đều cực kỳ êm ái!

### Thử thách 2: Tăng độ nhám PBT siêu lì cổ điển
- **File:** `src/lib/textures.ts`
- **Dòng code:** Trong hàm `createPbtMaterial`:
  ```typescript
  // Đổi roughness từ 0.72 lên 0.85 và bumpScale từ 0.0018 lên 0.0035
  roughness: 0.85,
  bumpScale: 0.0035,
  ```
- **Hiện tượng trên trình duyệt:** Nghiêng góc nhìn của camera, bề mặt phím sẽ trở nên nhám mờ lì hoàn toàn, bắt highlight mịn màng như chất liệu phím PBT double-shot cổ điển của thập niên 90.

---

## 5. 3 Câu hỏi Phỏng vấn Thực chiến (Kèm Đáp án)

### Câu 1: Tại sao trong Three.js, khi hiển thị vật liệu nhựa Polycarbonate trong suốt (như vỏ switch) ta nên dùng `MeshPhysicalMaterial` với thuộc tính `transmission` thay vì chỉ dùng `transparent: true` + `opacity`?
> **Đáp án:**  
> Thuộc tính `transparent: true` chỉ đơn thuần hòa trộn (alpha blending) pixel của vật thể với màu nền phía sau, không có hiện tượng khúc xạ ánh sáng thực tế. Trong khi đó, `MeshPhysicalMaterial` với `transmission > 0` và `ior` (Index of Refraction, ví dụ 1.48 cho PC) sẽ kích hoạt tính toán truyền quang vật lý (light transmission), mô phỏng sự bẻ cong tia sáng đi qua độ dày của vật thể (`thickness`), giúp nhìn thấy rõ chi tiết bên trong (lò xo, stem switch) với độ mờ và tán xạ quang học chân thực.

### Câu 2: Tone Mapping trong 3D WebGL là gì? Tại sao AgX Tone Mapping lại vượt trội hơn ACES Filmic đối với các cảnh có màu sắc tươi sáng và ánh sáng mạnh?
> **Đáp án:**  
> Tone Mapping là thuật toán nén dải sáng động cao (HDR - các giá trị ánh sáng vượt quá 1.0) về dải hiển thị tiêu chuẩn của màn hình (SDR [0.0, 1.0]). ACES Filmic có nhược điểm cố hữu là ở vùng ánh sáng rất mạnh (over-exposure), màu sắc dễ bị biến dạng màu sắc (hue shift - ví dụ màu vàng tươi bị ngả sang trắng hoặc đỏ cam). AgX giải quyết điều này bằng cách duy trì độ tinh khiết của màu (chromaticity constancy) khi tiến dần về màu trắng, tạo vùng chuyển tiếp mượt mà tự nhiên tương tự phản ứng của phim chụp quang học.

### Câu 3: Làm thế nào để đảm bảo texture PBR procedural (`DataTexture`) sinh ra trong Three.js có thể chạy mượt mà trong môi trường kiểm thử tự động (Unit Test Vitest / JSDOM) mà không bị crash?
> **Đáp án:**  
> Trong môi trường JSDOM (Node.js), thẻ `<canvas>` không có sẵn bộ render ngữ cảnh 2D/WebGL thật, nếu gọi `canvas.getContext('2d')` sẽ trả về `null` hoặc gây lỗi. Bằng cách sử dụng trực tiếp `new THREE.DataTexture(new Uint8Array(...), width, height, THREE.RGBAFormat)`, dữ liệu điểm ảnh được lưu trực tiếp dưới dạng mảng byte thuần trong bộ nhớ RAM máy tính. Three.js xử lý `DataTexture` hoàn toàn độc lập với DOM canvas, giúp mã nguồn chạy thông suốt 100% cả trên trình duyệt thật lẫn trong CI/CD headless test suite.
