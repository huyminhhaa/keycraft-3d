# 08 — Sân khấu sản phẩm điện ảnh: mở đầu, bàn xoay, sàn phản chiếu, AO

> Task: **2.1d-cinematic-stage**. Giữ nguyên bố cục 2.1c, chỉ thêm các lớp hoàn thiện kiểu trang sản phẩm Apple/Sony: camera lướt vào khi mở trang, bàn xoay 360° có nút dừng, sàn bóng phản chiếu mờ dần, ambient occlusion, màu đổi dần, tiêu đề sản phẩm chữ lớn, thanh công cụ kính mờ bo tròn, tự hạ chất lượng trên máy yếu.

---

## 1. Bách khoa công nghệ sử dụng trong task

### 1.1 `MeshReflectorMaterial` (drei) + `alphaMap`
- **Là gì?** Vật liệu render lại cả cảnh từ một camera soi gương bên dưới mặt phẳng, làm mờ (blur) rồi trộn vào bề mặt, tạo ra mặt bàn bóng.
- **Tác dụng:** dưới bàn phím có một vệt phản chiếu mờ như ảnh chụp sản phẩm.
- **Mẹo chống lộ mép:** gắn `alphaMap` là một gradient tròn (`floorTexture.ts`): giữa đặc, mép trong suốt. Sàn tan vào phông CSS và không bao giờ lộ đường chân trời (lỗi từng gặp ở 2.1b).
- **Pros:** chân thực. **Cons:** render cảnh thêm một lần nữa, nên đã hạ `resolution` xuống 512 và chỉ bật khi máy đủ khoẻ.

### 1.2 `N8AO` (ambient occlusion hậu kỳ)
- **Là gì?** Tính độ "khuất sáng" của mỗi điểm từ depth buffer: khe giữa hai keycap, chân phím và góc vỏ sẽ tối đi.
- **Tác dụng:** mô hình có chiều sâu, bớt cảm giác "đồ hoạ máy tính phẳng".
- **Cách dùng:** `<N8AO halfRes aoRadius={0.35} intensity={1.6} quality="performance" />` trong `EffectComposer`.

### 1.3 `PerformanceMonitor` (drei)
- **Là gì?** Đo FPS theo từng đợt. Khi FPS tụt dưới ngưỡng, nó gọi `onDecline`.
- **Tác dụng:** `useStageStore.highQuality = false` sẽ tắt sàn phản chiếu và AO. Bàn phím, ánh sáng và bóng đổ vẫn giữ nguyên. Không bật lại để tránh nhấp nháy qua lại.

### 1.4 Chuyển động theo thời gian (time-based) thay vì theo khung hình
- `autoRotate` của OrbitControls xoay một góc cố định **mỗi khung hình**, nên màn 120Hz quay nhanh gấp đôi màn 60Hz. Ta tự xoay bằng `turntableStep(delta) = speed × delta` (rad/giây), nên tốc độ như nhau trên mọi máy. `delta` bị kẹp ở 0.25s để khi quay lại tab, mô hình không giật một góc lớn.
- Đã phát hiện vấn đề này khi đo trong Chrome headless: render bằng CPU chỉ đạt 0.4 FPS, và bàn xoay kiểu cũ gần như đứng yên.

### 1.5 Vật liệu dùng chung + nội suy màu
- 87 keycap dùng chung **3 vật liệu** (alpha / modifier / accent). Đổi bộ keycap chỉ cần `lerp` 3 màu mỗi khung hình (`stepColorToward`), không phải 87 màu, và cũng không re-render React.

---

## 2. Bản chất hoạt động (Under the hood)

```
Mở trang
  └─ CameraController.useFrame
       introDone = false → posedPosition(goal, target, introPose(t))   // lệch -0.9 rad, xa 1.35× → về đích trong 1.8s (easeOutCubic)
       introDone = true  → autoRotate ? orbitAroundY(camera, target, turntableStep(delta)) : nghỉ
  └─ OrbitControls: tắt trong lúc mở đầu; onStart (người dùng kéo) → autoRotate = false
  └─ PerformanceMonitor: FPS thấp → highQuality = false → bỏ <ReflectiveFloor/> và <N8AO/>

Đổi màu trong sidebar → Zustand → KeyboardModel tính màu đích (THREE.Color)
  └─ useFrame: stepColorToward(material.color, đích, delta × 7) cho 2 vật liệu vỏ + 3 vật liệu keycap

StageOverlay: buildStageTitle(cấu hình) → "KeyCraft TKL" + "Vỏ nhôm đỏ, keycap Đỏ hai tông, plate FR4, switch Linear."
  └─ chữ trồi lên một lần qua mặt nạ overflow-hidden (CSS keyframes), ẩn khi tách lớp
```

`prefers-reduced-motion`: bỏ cảnh mở đầu, tắt bàn xoay, màu đổi ngay lập tức, mọi CSS animation dừng.

---

## 3. Tại sao chọn cách này (Trade-offs)

| Mục tiêu "sang" | Cách dễ (dễ thành "AI") | Cách trong task |
|---|---|---|
| Nền cao cấp | Glow tím/cyan, blob nhoè | Phông xám chụp sản phẩm + sàn phản chiếu tan dần |
| Chuyển động | Mọi thứ fade/stagger khi cuộn | Ba chỗ có mục đích: mở đầu một lần, bàn xoay có nút dừng, phản hồi khi đổi lựa chọn |
| Tiêu đề | Chữ gradient + badge in hoa | Tên máy lớn, chữ đặc, một dòng mô tả cấu hình thật |
| Thanh công cụ | Kính mờ có viền phát sáng | Kính mờ kiểu hệ điều hành: blur + saturate, viền 0.5px, không glow |
| Hiệu năng | Bật hết, máy yếu thì giật | PerformanceMonitor tự hạ chất lượng |

Không lấy mẫu hay code từ motionsites.ai: đó là sản phẩm trả phí của người khác. Taste skill cũng cấm sao chép code, chữ, hình hay hiệu ứng đặc trưng của trang tham khảo.

---

## 4. Thử thách tự tay sửa code (5 phút)

1. **Bàn xoay nhanh hơn**: trong `src/lib/ui/cinematic.ts` đổi `export const TURNTABLE_SPEED = 0.12;` thành `0.4`. Mô hình quay một vòng trong khoảng 16 giây thay vì 52 giây.
2. **Cảnh mở đầu kịch tính hơn**: cũng trong `cinematic.ts`, ở `INTRO` đổi `azimuth: -0.9` thành `-2.4` và `distance: 1.35` thành `2`. Camera sẽ bay từ phía sau, xa gấp đôi rồi lượn về.
3. *(Bonus)* Sàn bóng hơn: trong `src/components/canvas/KeyboardScene.tsx` (component `ReflectiveFloor`) đổi `mirror={0.55}` thành `0.9` và `roughness={0.9}` thành `0.5`.

---

## 5. Ba câu hỏi phỏng vấn thực chiến

**Q1. Vì sao không dùng `autoRotate` có sẵn của OrbitControls?**
> Nó cộng một góc cố định mỗi lần `update()`, tức là mỗi khung hình. Tốc độ quay vì thế phụ thuộc tần số màn hình (60/120/144Hz) và cả khi máy giật. Chuyển động nên tính theo thời gian: `góc = tốc độ × delta`. Đồng thời kẹp `delta` để tab ẩn lâu rồi quay lại không làm mô hình nhảy.

**Q2. Làm sao để sàn phản chiếu không lộ mép thành một đường chân trời?**
> Cho sàn trong suốt dần ra mép bằng `alphaMap` hình gradient tròn, trên một canvas trong suốt đặt trước phông CSS. Mép sàn có alpha = 0 nên không còn ranh giới. Thêm `depthWrite={false}` để mặt sàn trong suốt không che bóng tiếp xúc.

**Q3. Đổi màu 87 phím cùng lúc mà vẫn mượt, làm thế nào?**
> Gom phím theo vai trò và dùng chung 3 vật liệu, rồi nội suy màu của 3 vật liệu đó trong `useFrame`. Việc này không tạo vật liệu mới, không re-render React, và mỗi khung hình chỉ tốn 3 phép `Color.lerp`. Màu khởi tạo chỉ đặt một lần qua `useState`/`useMemo`, các lần sau để vòng lặp render kéo dần về đích.
