# 04. Hoạt Họa Tách Lớp 3D (Exploded View) Với useFrame & MathUtils.lerp

> **Chủ đề:** Lập trình chuyển động tách lớp phần cứng 3D (Exploded View) mượt mà 60/120 FPS bằng `useFrame` và thuật toán nội suy `MathUtils.lerp`, kết hợp hệ thống nhãn chú thích 3D HTML nổi chuẩn MotionSites.ai.  
> **Mục tiêu:** Nắm vững cơ chế hoạt động của vòng lặp Render Loop trong Three.js, công thức toán học nội suy tuyến tính (Linear Interpolation), kỹ thuật Frame-rate Independence và cách chiếu tọa độ 3D thành thẻ DOM 2D.

---

## 1. Bản chất hoạt động (Under the hood)

### 1.1. Luồng dữ liệu và cơ chế hoạt họa không re-render React
Khi người dùng bấm nút **"Tách Lớp 7 Phím"** trên Navbar hoặc trong bảng điều khiển, biến `isExploded` trong Zustand store đổi từ `false` sang `true`.

Nếu cập nhật bằng `useState` thông thường trong React, component sẽ bị ép re-render hàng trăm lần, làm nghẽn CPU và tụt FPS nghiêm trọng.  
Thay vào đó, chúng ta áp dụng mô hình **Imperative Direct Mutation** kết hợp với **`useFrame`**:

```
[ Người dùng bấm "Tách Lớp" ]
             |
             v
[ Zustand Store: isExploded = true ]
             |
             v (Không kích hoạt re-render liên tục)
+-----------------------------------------------------------------------+
|  VÒNG LẶP RENDER LOOP (Chạy 60 - 120 lần mỗi giây trong useFrame)      |
|                                                                       |
|  1. Xác định đích đến (Target Offset):                                |
|     const target = isExploded ? explosionOffset : 0;                  |
|                                                                       |
|  2. Tính toán vị trí nội suy mượt mà (MathUtils.lerp):                |
|     currentOffset = lerp(currentOffset, target, delta * speed);       |
|                                                                       |
|  3. Cập nhật trực tiếp ma trận tọa độ GPU qua React Ref:              |
|     pcbRef.current.position.y     = 0.28 + currentOffset * 0.35;      |
|     foamRef.current.position.y    = 0.34 + currentOffset * 0.70;      |
|     plateRef.current.position.y   = 0.40 + currentOffset * 1.05;      |
|     switchesRef.current.position.y= 0.52 + currentOffset * 1.40;      |
|     keycapsRef.current.position.y = 0.74 + currentOffset * 1.80;      |
|     topCaseRef.current.position.y = 0.44 + currentOffset * 2.15;      |
+-----------------------------------+-----------------------------------+
                                    |
                                    v (Tọa độ 3D thay đổi)
+-----------------------------------+-----------------------------------+
|  Lớp Thẻ Chú Thích 3D (<Html> từ @react-three/drei)                   |
|  - Chiếu tọa độ Vector3 (X, Y, Z) của từng layer lên màn hình 2D DOM  |
|  - Tự động di chuyển theo linh kiện khi bung ra                      |
|  - Hiệu ứng AnimatePresence mượt mà (fade in / scale up)             |
+-----------------------------------------------------------------------+
```

### 1.2. Công thức toán học: Nội suy tuyến tính (Linear Interpolation - `lerp`)
Công thức toán học cơ bản của `lerp`:
$$\text{lerp}(a, b, t) = a + (b - a) \times t$$
Trong đó:
- $a$: Giá trị hiện tại (`currentOffset.current`).
- $b$: Giá trị mục tiêu muốn hướng tới (`targetOffset`).
- $t$: Hệ số bước nhảy nằm trong khoảng $[0, 1]$.

#### Tại sao cần nhân với `delta` (Frame-rate Independence)?
Mỗi màn hình có tần số quét khác nhau (Màn hình thường: 60Hz $\rightarrow \text{delta} \approx 0.016\text{s}$; Màn hình Gaming: 144Hz $\rightarrow \text{delta} \approx 0.007\text{s}$).  
Nếu dùng một số cố định $t = 0.1$, màn hình 144Hz sẽ chạy animation nhanh gấp 2.4 lần so với màn hình 60Hz!  
Bằng cách nhân với `delta` ($\text{delta} \times \text{speed}$), quãng đường di chuyển được chuẩn hóa theo **thời gian thực tính bằng giây**, đảm bảo animation chạy mượt mà và có tốc độ hoàn toàn giống nhau trên mọi thiết bị.

---

## 2. Tại sao chọn cách này (Trade-offs & Decisions)

| Phương pháp | `MathUtils.lerp` trong `useFrame` | CSS Transitions / Framer Motion 3D | React `useState` Animation |
| :--- | :--- | :--- | :--- |
| **Hiệu năng (FPS)** | **Cao nhất (60 - 120 FPS)**: Thay đổi trực tiếp thuộc tính ma trận của Object3D trên GPU, React không hề re-render. | Trung bình: Cần tạo bridge kết nối với R3F props. | **Tệ nhất:** Ép React re-render lại toàn bộ 7 layer phím 60 lần/giây, gây giật lag nghiêm trọng. |
| **Khả năng ngắt nhịp (Interruption Handling)** | **Hoàn hảo:** Nếu người dùng bấm "Gộp lại" khi phím đang bung dở ở 50%, thuật toán sẽ tự động lerp ngược về 0 từ đúng vị trí 50% đó, không hề bị giật hoặc nhảy hình. | Dễ bị giật hoặc phải đợi hết duration của transition. | Rất khó xử lý trạng thái dở dang mượt mà. |
| **Gắn nhãn DOM 2D** | Đồng bộ tự nhiên với thẻ `<Html>` của Drei theo tọa độ thực tế của từng linh kiện. | Phức tạp trong việc bắt kịp tọa độ CSS. | Chậm và lệch nhịp với Canvas 3D. |

---

## 3. Thử thách tự tay sửa code (5 phút)

Hãy thử nghiệm việc can thiệp vào vật lý hoạt họa tách lớp 3D:

### Thử thách 1: Tùy chỉnh tốc độ bung lớp (Animation Speed)
1. Mở file [`src/components/canvas/KeyboardModel.tsx`](file:///d:/Projects/keycraft-3d/src/components/canvas/KeyboardModel.tsx#L162).
2. Tìm dòng:
   ```typescript
   currentOffset.current = THREE.MathUtils.lerp(
     currentOffset.current,
     targetOffset,
     Math.min(1, delta * 8)
   );
   ```
3. **Thử nghiệm:**
   - Đổi `delta * 8` thành `delta * 2` để tạo hiệu ứng bung lớp chậm rãi kiểu điện ảnh điện ảnh (Slow-motion Cinematic).
   - Đổi thành `delta * 20` để phím bung ra cực nhanh và dứt khoát phong cách High-tech Studio.
4. Chạy `npm test -- --run` và quan sát kết quả.

### Thử thách 2: Đổi màu chấm tròn chỉ điểm (Dot Indicator) của Thẻ chú thích 3D
1. Mở file [`src/components/canvas/KeyboardModel.tsx`](file:///d:/Projects/keycraft-3d/src/components/canvas/KeyboardModel.tsx#L96).
2. Tìm class `bg-cyan-400` và đổi sang màu Tím Neon Cyberpunk:
   ```tsx
   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
   <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
   ```
3. Bật chế độ Tách lớp để thấy chấm định vị chuyển sang màu tím phát quang!

---

## 4. Ba câu hỏi phỏng vấn thực chiến (Interview Q&A)

### Câu hỏi 1: Cơ chế nào giúp thẻ `<Html>` trong `@react-three/drei` có thể bám dính chính xác vào một tọa độ trong không gian 3D khi người dùng xoay camera?
> **Đáp án:**  
> Trong mỗi khung hình render (Render Loop), Three.js thực hiện phép **Chiếu ma trận phối cảnh (Matrix World Projection)**:
> 1. Lấy tọa độ không gian 3D của Object (`Vector3(X, Y, Z)`).
> 2. Nhân với Ma trận Góc nhìn (View Matrix) và Ma trận Chiếu (Projection Matrix) của Camera để chuyển thành Tọa độ Thiết bị Chuẩn hóa (Normalized Device Coordinates - NDC) nằm trong khoảng $[-1, 1]$.
> 3. `@react-three/drei` ánh xạ tọa độ NDC này thành tọa độ pixel thực tế trên màn hình `(left, top)` và áp dụng `transform: translate3d(x, y, z)` lên thẻ HTML DOM bọc ngoài. Nhờ đó, thẻ HTML luôn di chuyển đồng bộ hoàn hảo với mô hình 3D.

---

### Câu hỏi 2: Tại sao trong thuật toán `MathUtils.lerp` ta cần bọc hệ số bước nhảy trong `Math.min(1, delta * speed)`?
> **Đáp án:**  
> Hệ số bước nhảy $t$ trong hàm lerp bắt buộc phải nằm trong đoạn $[0, 1]$.  
> Khi người dùng chuyển tab trình duyệt hoặc máy tính bị đơ tạm thời trong 0.5 giây, giá trị `delta` có thể vọt lên rất cao (ví dụ: $\text{delta} = 0.5\text{s} \rightarrow 0.5 \times 8 = 4.0$).  
> Nếu $t > 1$, công thức lerp sẽ làm giá trị vọt qua xa khỏi điểm đích (Overshooting), khiến mô hình 3D bị văng ra ngoài không gian. Hàm `Math.min(1, ...)` hoạt động như một chốt chặn an toàn (Clamping guard), đảm bảo bước nhảy không bao giờ vượt quá $100\%$ quãng đường còn lại.

---

### Câu hỏi 3: Làm thế nào để ngăn chặn các tương tác chuột (Click, Drag) trên nhãn HTML 3D làm vô tình kích hoạt OrbitControls bên dưới Canvas?
> **Đáp án:**  
> Trong `@react-three/drei`, thẻ `<Html>` mặc định cho phép sự kiện chuột xuyên qua hoặc chặn lại. Ta xử lý bằng cách:
> 1. Thiết lập sự kiện `e.stopPropagation()` trên container của thẻ HTML để ngăn sự kiện nổi bọt (event bubbling) lên Canvas WebGL bên dưới.
> 2. Sử dụng class `pointer-events-auto` cho nội dung thẻ và đặt `pointer-events-none` cho các vùng khoảng trống bao quanh.
