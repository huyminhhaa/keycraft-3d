# 07 — Làm lại giao diện kiểu công cụ thật & mô hình bàn phím ANSI

> Task: **2.1c-ui-tool-redesign**. Bỏ phong cách kính mờ + glow (trông "AI"), chuyển sang bố cục công cụ cấu hình: sidebar phẳng bên trái, sân khấu 3D bên phải. Mô hình 3D dựng lại theo một chiếc TKL vỏ nhôm đỏ thật: keycap profile Cherry có ký tự, tạ đồng bên trong, đèn LED hông, gõ phím thật thì phím 3D nhấn theo.

---

## 1. Bách khoa công nghệ sử dụng trong task

### 1.1 `KeyboardEvent.code` (bắt phím vật lý)
- **Là gì?** Mã của *vị trí phím vật lý* (`KeyA`, `Digit1`, `ShiftLeft`…), không phụ thuộc bộ gõ hay ngôn ngữ. Khác `event.key` (ký tự sinh ra: "a", "A", "ă"…).
- **Tác dụng:** mỗi phím trong `src/lib/keyboard/layouts.ts` có một `code`. Khi gõ phím thật, `pressedKeys.ts` ghi `code` vào một `Set`, và keycap 3D tương ứng lún xuống.
- **Cách dùng:** `window.addEventListener('keydown', (e) => pressKey(e.code))`.
- **Pros:** đúng vị trí phím với cả bàn phím tiếng Việt (Telex/VNI) hay AZERTY. **Cons:** không có mã cho phím `Fn` (phím này do firmware xử lý, trình duyệt không nhận được).

### 1.2 Kho trạng thái ngoài React (module-level `Set`)
- **Là gì?** Một biến `Set` sống trong module JS, không phải state của React hay Zustand.
- **Tác dụng:** vòng lặp `useFrame` (60 lần/giây) đọc `isKeyPressed(code)` trực tiếp, nên gõ phím **không gây re-render** 87 component keycap.
- **Pros:** cực rẻ, không giật khi gõ nhanh. **Cons:** giao diện React không tự biết phím nào đang nhấn (ở đây không cần).

### 1.3 Biến dạng đỉnh (vertex deformation) để tạo keycap Cherry
- **Là gì?** Lấy một `RoundedBoxGeometry` rồi sửa toạ độ từng đỉnh: càng lên cao càng thu hẹp (taper), mặt trên nghiêng theo hàng (hàng số nghiêng về phía người gõ, hàng dưới cùng nghiêng ra xa).
- **Cách dùng:** `position.setXYZ(i, x * scaleX, y + ..., z * scaleZ)` rồi `computeVertexNormals()`.
- **Pros:** không cần file `.glb`, đổi kích thước phím (1u → 6.25u) chỉ bằng tham số. **Cons:** mặt trên phẳng, chưa có lõm (dish) như keycap thật.
- **Cache:** 87 phím chỉ dùng khoảng 25 geometry, vì chỉ có vài tổ hợp (bề rộng, hàng).

### 1.4 `CanvasTexture` cho ký tự trên phím
- **Là gì?** Vẽ chữ trắng lên `<canvas>` 2D rồi dùng làm texture trong suốt. Màu chữ thật do `material.color` nhuộm, chọn theo độ sáng nền keycap (`legendColorFor` dùng công thức luminance WCAG).
- **Pros:** không tải font 3D, đổi bộ màu keycap không phải vẽ lại texture. **Cons:** chữ là ảnh raster nên phóng thật gần sẽ hơi mờ.

### 1.5 `ExtrudeGeometry` + bevel (vỏ nhôm CNC)
- Ép đùn một hình chữ nhật bo góc (`THREE.Shape`) lên theo chiều cao, bật `bevelEnabled` để cạnh vát như nhôm phay CNC. Top case thêm `shape.holes` để thành khung rỗng.

### 1.6 `Environment` + `Lightformer` (ánh sáng chụp sản phẩm)
- **Là gì?** drei render vài tấm sáng chữ nhật (softbox) thành một environment map ngay trong trình duyệt.
- **Tác dụng:** nhôm anodized và keycap có vệt phản xạ như ảnh chụp studio, mà **không tải file HDR nào từ mạng**.

### 1.7 Instancing cho switch
- `InstancedMesh`: 87 switch × 3 bộ phận = 261 khối, nhưng chỉ cần 3 draw call.

---

## 2. Bản chất hoạt động (Under the hood)

```
Bàn phím thật ──keydown(code)──► pressedKeys.ts (Set) ◄── useFrame đọc mỗi khung hình
                                                          │
Sidebar (DesignPanel / SoundPanel) ──setter──► Zustand ───┼─► KeyboardModel (7 lớp)
StageOverlay (góc nhìn, tách lớp) ──────────────────────┘    ├─ Keycap × N (geometry cache + legend texture)
                                                              ├─ Switches (InstancedMesh)
                                                              └─ Vỏ ExtrudeGeometry + tạ đồng + LED hông
CameraFraming (useFrame): zoom = fit(bề rộng sân khấu, bề rộng vỏ) × hệ số tách lớp
                          tâm nhìn y nâng dần theo explosionOffset
```

- **Bố cục phím** (`layouts.ts`): mỗi hàng là danh sách phím và khoảng trống tính bằng `u`. `placeRows` cộng dồn để ra toạ độ `x, y`. `keyCenter` đổi `u` sang đơn vị 3D (`KEY_UNIT = 0.38`) và canh giữa tại gốc.
- **Bộ keycap 3 tông** (`keycapSets.ts`): phím chữ (alpha), phím chức năng (modifier) và phím nhấn (Esc/Enter). Store có thêm trường `keycapModifierColor`. AI tool `updateKeyboardConfig` cũng nhận trường này.
- **Tự canh khung**: `computeFitZoom` giải `zoom = (bề ngang nhìn thấy × 0.8) / bề rộng vỏ`. Khi tách lớp, nhân thêm `1 / (1 + 0.38 × offset)` và dời tâm nhìn lên `0.2 + 1.05 × offset`, để cả 7 lớp nằm trong khung.

---

## 3. Tại sao chọn cách này (Trade-offs)

| Vấn đề | Cách cũ | Cách mới | Lý do |
|---|---|---|---|
| UI trông "AI" | Kính mờ, glow tím/cyan, chữ gradient, nhãn mono in hoa "01 · LAYOUT", ẩn dụ "Điêu khắc âm thanh" | UI đơn sắc than chì, nhãn viết thường, tiêu đề gọi tên sản phẩm | Taste skill liệt kê đúng các dấu hiệu này là "model tells". Màu của chiếc phím nên là màu duy nhất nổi bật |
| Bố cục | Panel nổi đè lên canvas, cần lens shift | Sidebar cố định + sân khấu riêng | Không còn gì che mô hình, mobile chỉ cần xếp chồng |
| Keycap | Hộp vuông xếp lưới đều | Layout ANSI thật, profile Cherry, ký tự | Nhìn giống bàn phím thật, gõ phím thật được |
| Nền | Sàn kim loại + fog | Canvas trong suốt + ContactShadows trên phông CSS | Không còn mép sàn/chân trời, rẻ hơn |
| Âm thanh | Nhãn tiếng Anh + chip mâu thuẫn ("Crisp Clack" nhưng chip ghi "Cân bằng") | Một câu tiếng Việt suy từ cùng một hàm `describeTone` | Một sự thật, một cách nói |

---

## 4. Thử thách tự tay sửa code (5 phút)

1. **Làm keycap "cao" hơn (kiểu SA profile)**: mở `src/components/canvas/geometry/keyboardGeometry.ts`, trong `KEYCAP_PROFILE` đổi `1: { height: 0.19, ... }` thành `0.26` và `3: { height: 0.158, ... }` thành `0.22`. Hàng số và hàng Home sẽ cao vọt lên.
2. **Hành trình phím sâu hơn**: trong `src/components/canvas/KeyboardModel.tsx` đổi `export const KEY_TRAVEL = 0.07;` thành `0.12`, rồi gõ thử: phím lún sâu thấy rõ. (Test `KeyboardModel.test.ts` sẽ báo đỏ vì vượt 5mm. Đó là cách test bảo vệ thông số thật.)
3. *(Bonus)* Thêm một bộ keycap mới vào `KEYCAP_SETS` trong `src/lib/keyboard/keycapSets.ts` (ví dụ `{ id: 'ocean', name: 'Biển', alpha: '#0e3b4f', modifier: '#1f6f8b', accent: '#f2c14e' }`), rồi reload trang: nó tự xuất hiện trong danh sách.

---

## 5. Ba câu hỏi phỏng vấn thực chiến

**Q1. Vì sao bắt phím bằng `event.code` chứ không phải `event.key`?**
> `key` là ký tự sinh ra, thay đổi theo Shift, CapsLock, bộ gõ (Telex biến "aa" thành "â") và layout quốc gia. `code` là vị trí phím vật lý, luôn ổn định, nên khớp 1-1 với phím trên mô hình 3D. Khi cần hiển thị ký tự đã gõ thì mới dùng `key`.

**Q2. 87 keycap đều cần animation nhấn: làm sao để không re-render React mỗi lần gõ?**
> Lưu phím đang nhấn trong một `Set` ở ngoài React. Một vòng `useFrame` duy nhất duyệt các `THREE.Group` (lưu bằng callback ref trong `Map`) và `lerp` vị trí y về đích. React chỉ render lại khi cấu hình đổi (layout, màu), còn gõ phím chỉ chạm tới Three.js.

**Q3. Làm sao camera luôn "vừa khung" trên mọi kích thước màn hình mà người dùng vẫn cuộn để zoom được?**
> Với camera phối cảnh, bề ngang nhìn thấy ở khoảng cách d là `2·d·tan(fov/2)·aspect / zoom`. Giải ra `zoom` để vỏ chiếm 80% bề ngang, nhưng tính tại một khoảng cách *tham chiếu cố định* chứ không phải khoảng cách hiện tại. OrbitControls vẫn tự do dolly lại gần hoặc ra xa, còn `camera.zoom` chỉ đổi khi sân khấu đổi kích thước, đổi layout hoặc tách lớp.
