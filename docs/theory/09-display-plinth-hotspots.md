# 09 — Bệ trưng bày, điểm chú thích & thu gọn thanh cấu hình

> Task: **2.2b-stage-fill**. Giữ nguyên giao diện, thêm: nút thu/mở thanh cấu hình, bệ trưng bày tròn thay cho sàn phản chiếu bị lộ mép, các điểm chú thích "+" gắn trên mô hình, luồng đèn rọi từ trên xuống.

## 1. Bách khoa công nghệ

- **`drei <Html>` gắn vào toạ độ 3D**: mỗi frame chiếu điểm 3D ra toạ độ màn hình và đặt một thẻ HTML ở đó. Nhờ vậy điểm "+" bám theo bộ phận khi bàn xoay quay. Thẻ là HTML thật, nên Tab tới được và trình đọc màn hình đọc được. *Hạn chế:* không tự bị che khi bộ phận quay ra phía sau (tuỳ chọn `occlude` phải raycast mỗi frame, khá tốn).
- **`CylinderGeometry` + `CircleGeometry` + `RingGeometry`**: ba hình cơ bản ghép thành bệ: thân, mặt bóng (dùng `MeshReflectorMaterial` khi máy đủ khoẻ) và viền sáng mảnh cùng màu LED.
- **CSS `:hover` / `:focus-within`**: thẻ chú thích hiện ra mà không cần state React.

## 2. Bản chất hoạt động

```
useStageStore.sidebarOpen ──► page.tsx: lg:grid-cols-[360px_1fr] ↔ lg:grid-cols-[1fr], sidebar lg:hidden
                          └─► StageOverlay: nút PanelLeftClose/Open (aria-expanded, aria-controls)
setActiveTab('ai') ─────────► tự mở lại thanh (nút "Trợ lý AI" trên sân khấu không bao giờ mở vào chỗ trống)
Canvas đổi kích thước ──────► CameraFraming tự canh lại zoom (không cần code thêm)

useKeyboardStore ──► buildHotspots(state): vị trí Esc, Space, góc vỏ, hông LED + chữ lấy đúng cấu hình
                  └► <Html> cho từng điểm (ẩn khi đang mở đầu hoặc tách lớp)
```

**Lỗi đã sửa:** đợt 2.1d dùng sàn phẳng 22×22 có `alphaMap` tròn để mờ dần ra mép. Trên GPU thật, `MeshReflectorMaterial` bỏ qua `alphaMap`, nên lộ ra một tấm hình thang có mép cứng (thấy rõ trong ảnh chụp của chủ dự án). Bệ tròn là một vật thể thật nên mép tròn là đúng, không cần làm mờ nữa. File `floorTexture.ts` và test của nó đã được xoá.

## 3. Trade-offs

| Cách | Vì sao không / có |
|---|---|
| Animate độ rộng cột khi thu gọn | Canvas resize mỗi frame → WebGL dựng lại buffer liên tục, giật. Chọn chuyển ngay |
| Thêm chữ, thẻ, dải số liệu cho đỡ trống | Quy tắc nền của Hallmark: không bịa số liệu, không dùng nhãn in hoa (eyebrow). Chọn lấp chỗ trống bằng chính vật thể (bệ) và thông tin thật (chú thích) |
| Chấm nhấp nháy liên tục | Bị cấm vì là "chấm trang trí". Chọn chấm tĩnh có dấu "+", phóng to khi hover/focus |

## 4. Thử thách tự tay sửa code (5 phút)

1. `src/components/canvas/KeyboardScene.tsx`: đổi `PLINTH = { radius: 3.7, height: 0.3 }` thành `{ radius: 4.2, height: 0.6 }` để có bệ to và dày như bục triển lãm.
2. `src/components/canvas/Hotspots.tsx`: thêm một điểm cho phím Enter: `center('Enter')` với tiêu đề `'Phím nhấn Enter'`, rồi reload trang.

## 5. Ba câu hỏi phỏng vấn

**Q1. Vì sao điểm chú thích dùng HTML chứ không vẽ trong WebGL?**
> HTML cho chữ sắc nét, CSS hover/focus và khả năng truy cập (Tab, aria-label) miễn phí. `drei Html` chỉ việc chiếu toạ độ 3D ra màn hình mỗi frame.

**Q2. Nút "Trợ lý AI" trên sân khấu bấm khi thanh cấu hình đang thu gọn thì sao?**
> `setActiveTab` đặt luôn `sidebarOpen: true`. Quy tắc nằm trong store nên mọi nơi gọi đều đúng, không phải nhớ xử lý ở từng nút.

**Q3. Một vật liệu bỏ qua `alphaMap` thì làm sao "mờ dần" sàn?**
> Thường thì không nên ép. Đổi hình học để mép là chủ đích (bệ tròn, vật thể thật), hoặc che mép bằng sương mù/phông cùng màu. Sửa tận gốc vẫn hơn đắp thêm shader.
