# 06 — Đại tu UI: Liquid Glass, Kinetic Typography, Bento Grid & Lens Shift

> Task: **UI-redesign** (đại tu giao diện theo phong cách Cinematic Dark Luxury).
> Mục tiêu: giữ nguyên Zustand store và mô hình 3D 7 lớp, chỉ thay "lớp da" UI và cách mô hình được đóng khung trên màn hình.

---

## 1. Bách khoa công nghệ sử dụng trong task

### 1.1 `backdrop-filter` (Frosted Liquid Glass)
- **Là gì?** Thuộc tính CSS làm mờ/nhuộm *những gì nằm phía sau* một phần tử (khác `filter` làm mờ chính phần tử).
- **Tác dụng trong dự án:** Tạo các tấm kính `.glass-liquid` (navbar, panel, thẻ Acoustic) để ánh sáng ambient và mô hình 3D "chảy" xuyên qua.
- **Cách dùng:**
  ```css
  .glass-liquid {
    background: linear-gradient(180deg, rgba(255,255,255,.075), rgba(255,255,255,.012)), rgba(10,10,14,.58);
    backdrop-filter: blur(40px) saturate(170%);   /* = backdrop-blur-2xl + tăng bão hoà */
    border: 1px solid rgba(255,255,255,.1);        /* hairline border-white/10 */
    box-shadow: inset 0 1px 0 rgba(255,255,255,.14); /* inner highlight bắt sáng từ trên */
  }
  ```
  `::before` thêm quầng sáng đỉnh, `::after` thêm đường sáng 1px trên mép kính.
- **Pros:** Chân thực, thuần CSS, không cần ảnh. **Cons:** Tốn GPU khi phần tử lớn và nền phía sau chuyển động (canvas 3D); cần nền bán trong suốt đủ đậm để chữ vẫn đọc được.

### 1.2 Framer Motion — Spring, Variants, `layoutId`
- **Spring physics:** chuyển động mô phỏng lò xo (`stiffness` = độ cứng, `damping` = lực hãm, `mass` = khối lượng) thay vì đường cong thời gian cố định → cảm giác "có trọng lượng". Bộ chuẩn nằm ở `src/lib/ui/motion.ts` (`SPRINGS.snappy | smooth | gentle`).
- **Variants + stagger:** khai báo trạng thái `hidden`/`visible` một lần; phần tử cha dùng `staggerChildren` để các con xuất hiện lần lượt (`createStaggerContainer`).
- **Shared layout animation (`layoutId`):** hai phần tử khác nhau cùng `layoutId` → Framer tự nội suy vị trí/kích thước giữa chúng. Viên sáng của tab, ô lựa chọn (`OptionTile`), vòng chọn màu (`SwatchRow`) đều "trượt" sang lựa chọn mới nhờ cơ chế này.
- **`MotionConfig reducedMotion="user"`:** tôn trọng cài đặt "giảm chuyển động" của hệ điều hành.
- **Pros:** Khai báo ngắn gọn, chuyển động tự nhiên, tự xử lý ngắt giữa chừng. **Cons:** Thêm JS vào bundle; animate `filter: blur()` trên phần tử lớn có thể tốn GPU.

### 1.3 Kinetic Typography
- **Là gì?** Chữ chuyển động như một phần của bố cục. Ở đây mỗi từ nằm trong một "mặt nạ" `overflow-hidden` và trồi từ `y: 110%` lên `0%`, kèm khử nhoè `blur(12px) → 0`.
- **Accessibility:** `<h1 aria-label="câu đầy đủ">`, các mảnh chữ `aria-hidden` → trình đọc màn hình đọc liền một câu, không đọc rời từng từ.

### 1.4 Bento Grid
- **Là gì?** Lưới mô-đun gồm các ô kích thước khác nhau (như hộp cơm bento). `StudioControls` dùng `grid grid-cols-2`: thẻ rộng (`col-span-2`) cho Layout/Plate, hai thẻ hẹp cạnh nhau cho Switch/Case. `AcousticBadge` dùng `grid-cols-3`: một ô lớn chứa dạng sóng và ba ô chỉ số.

### 1.5 `next/font/google` — Inter Tight + Geist
- **Tác dụng:** tự host font lúc build (không gọi Google lúc chạy) và gắn biến CSS (`--font-inter-tight`, `--font-geist-sans`). Tailwind v4 map thành `font-display` / `font-sans` trong `@theme`.
- **Lưu ý:** phải khai báo subset `vietnamese` để dấu tiếng Việt dùng đúng font.

### 1.6 `PerspectiveCamera.setViewOffset` (Lens shift)
- **Là gì?** API Three.js render *một ô cửa sổ con* (sub-window) của một khung hình ảo lớn hơn. Giống ống kính tilt-shift: dời hình trên cảm biến mà không di chuyển máy ảnh.
- **Tác dụng:** Canvas vẫn phủ toàn màn hình, nhưng tâm mô hình được dời vào giữa vùng trống (bên trái panel trên desktop, phía trên bottom sheet trên mobile). Nhờ vậy OrbitControls vẫn xoay quanh tâm mô hình.
- **Pros:** Không méo hình, không phải render thừa pixel, không đổi logic camera preset. **Cons:** Phải tự bù `aspect` và `zoom`, vì sub-window làm fov bị "cắt" và hình tự phóng to.

---

## 2. Bản chất hoạt động (Under the hood)

```
page.tsx (MotionConfig)
 ├─ AmbientBackdrop   z-0  : 3 quả cầu glow (cyan/indigo/purple) blur-3xl trôi chậm
 ├─ KeyboardScene     z-10 : Canvas R3F toàn màn hình
 │    └─ CameraFraming      → matchMedia('(min-width:1024px)') + size
 │                         → computeFraming() → computeViewOffset() → camera.setViewOffset()
 ├─ light leak/vignette/grain z-15..17 (pointer-events-none, mix-blend)
 ├─ HeroOverlay       z-20 : KineticHeadline (đọc isExploded → tự mờ khi bung lớp)
 ├─ AcousticBadge     z-30 : soundProfile → meter.ts (toMeterPercent, describeTone, buildWaveform)
 ├─ StudioControls    z-30 : bento tabs → action của useKeyboardStore
 └─ StudioNavbar      z-40 : toggleExploded / resetConfig
```

**Luồng dữ liệu:** người dùng bấm `OptionTile "POM"` → `setPlateMaterial('pom')` trong Zustand → store tính lại `soundProfile` → `AcousticBadge` (đã subscribe `soundProfile`) render lại: dạng sóng mới từ `buildWaveform`, thanh đo co giãn bằng lò xo tới `toMeterPercent(...)`, chip đổi từ `Clack` sang `Thock`. Đồng thời `KeyboardModel` (cũng subscribe store) đổi vật liệu plate trong 3D.

**Toán lens shift (`CameraFraming.tsx`):** muốn nội dung dời trái `dx` px:
- khung đầy đủ rộng `fullWidth = w + 2dx`, tâm nằm ở `w/2 + dx`;
- cắt sub-window bắt đầu từ `x = 2dx` → tâm hiện trên màn hình ở `w/2 + dx − 2dx = w/2 − dx`. ✔
- Fov dọc trải trên `fullHeight`, nhưng ta chỉ lấy `h/fullHeight` của nó, nên hình phóng to `fullHeight/h` lần. Vì vậy cần đặt `camera.zoom = zoom × h / fullHeight` để triệt tiêu, và `camera.aspect = fullWidth / fullHeight` để không méo hình.

**Ánh sáng nền bị sàn che thì sao?** Sàn studio trong Canvas là mesh đặc nên che lớp glow `z-0`. Vì vậy có thêm lớp *light leak* `mix-blend-screen` **phủ lên** canvas. Phép blend `screen` chỉ làm sáng thêm, nên sàn kim loại bắt chút màu cyan/purple mà mô hình không bị bệt.

---

## 3. Tại sao chọn cách này (Trade-offs)

| Vấn đề | Cách thông thường | Cách trong task | Lý do |
|---|---|---|---|
| Panel che mô hình | Kéo dài canvas bằng CSS (`-left-[384px]`) | `setViewOffset` lens shift | CSS làm render thừa ~30% pixel và lệch tâm khi panel đổi kích thước; lens shift chính xác và rẻ |
| Breakpoint của framing | Dựa vào bề rộng canvas | `matchMedia` cùng breakpoint `lg` với Tailwind | Bề rộng canvas có thể hụt vài px do thanh cuộn, khiến layout CSS là desktop nhưng framing lại là mobile (đã gặp thật khi chụp ảnh 1024px) |
| Thanh đo âm học | Hard-code min/max | `computeAcousticRanges()` quét mọi tổ hợp plate × switch | Công thức âm học đổi thì thanh đo vẫn chạm đúng 0% và 100% |
| Indicator đang chọn | Đổi class màu nền | `layoutId` trượt bằng lò xo | Mắt theo được "đi từ đâu tới đâu", đúng tinh thần motion design |
| Hiệu ứng nhiễu hạt | Ảnh PNG noise | SVG `feTurbulence` inline (data URI) | Không thêm request, nét ở mọi độ phân giải |

---

## 4. Thử thách tự tay sửa code (5 phút)

1. **Đổi "độ nảy" toàn bộ UI** — mở `src/lib/ui/motion.ts`, dòng `smooth: { type: 'spring', stiffness: 220, damping: 26, mass: 0.9 }`. Hạ `damping` xuống `12` rồi đổi qua lại giữa các tab trong panel: viên sáng tab sẽ nảy lố rồi mới dừng. Đặt lại `26` để có cảm giác sang trọng, êm.
2. **Đổi kích cỡ mô hình trên màn hình** — mở `src/components/canvas/CameraFraming.tsx`, hằng số `const TARGET_FILL = 0.72;`. Tăng lên `0.9` → bàn phím to hơn, lấn gần hero và thẻ Acoustic. Giảm còn `0.55` → nhiều khoảng thở hơn.
3. *(Bonus)* Trong `src/app/globals.css`, đổi `opacity: 0.07;` của `.grain-overlay` thành `0.18` để thấy rõ film grain, rồi trả về giá trị tinh tế.

---

## 5. Ba câu hỏi phỏng vấn thực chiến

**Q1. Vì sao không chỉ thu nhỏ canvas lại cho khỏi bị panel che, mà lại dùng `setViewOffset`?**
> Thu nhỏ canvas sẽ tạo đường cắt giữa sàn 3D và nền, và mất cảm giác "mô hình nằm trong không gian toàn màn hình". `setViewOffset` giữ canvas full-screen nhưng dời tâm chiếu (như lens shift của máy ảnh). Mô hình vẫn xoay quanh tâm của nó, raycasting và nhãn `Html` vẫn đúng vì chúng dùng cùng ma trận chiếu. Chỉ cần bù `aspect = fullW/fullH` và `zoom × h/fullH`.

**Q2. `layoutId` trong Framer Motion hoạt động thế nào? Khi nào nên bọc `LayoutGroup`?**
> Khi phần tử có `layoutId` X unmount và một phần tử khác có cùng X mount, Framer đo bounding box cũ và mới (kỹ thuật FLIP) rồi animate transform giữa hai vị trí. `LayoutGroup id` cô lập namespace, để hai nhóm cùng tên `layoutId` (ví dụ nhiều panel) không "nhảy" sang nhau, và để các phần tử trong nhóm cùng đo lại layout khi một phần tử thay đổi.

**Q3. Làm sao để một tiêu đề kinetic (tách từng từ) vẫn thân thiện với trình đọc màn hình và SEO?**
> Đặt câu đầy đủ vào `aria-label` của thẻ `<h1>` và gắn `aria-hidden` cho các mảnh chữ, để trình đọc màn hình đọc một câu liền mạch. Text thật vẫn nằm trong DOM, nên crawler vẫn thấy. Thêm `MotionConfig reducedMotion="user"` để người bật "giảm chuyển động" không phải xem hiệu ứng trồi chữ.
