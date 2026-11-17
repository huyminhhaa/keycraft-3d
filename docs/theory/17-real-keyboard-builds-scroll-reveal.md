# 17 — Thư viện build phím thật & hiệu ứng trượt vào khi cuộn

> Task 3.5 (đợt 1–2) và chỉnh landing page. Chọn một build (AULA F75, Lucky65 V2, Hi75C Pro…) thì **mô hình 3D, tiếng gõ và chú thích 7 lớp đổi theo đúng build đó**, giống trang sound profile của các shop nhưng có 3D.

## 1. Bách khoa công nghệ dùng trong task

### 1.1 Dữ liệu cấu hình bằng Zod (`src/lib/keyboard/builds.ts`)
- **Là gì:** mỗi build là một object gồm `specs` (chữ, hiển thị cho người xem) và `look` (thông số cho 3D: layout, màu, chất liệu, `caseShape`). `buildSchema.parse` kiểm tra khi nạp module: sai mã màu, layout lạ hay id trùng thì báo lỗi ngay.
- **Tác dụng:** thêm build mới chỉ cần thêm một object, không phải sửa component nào.
- **Pros:** tách dữ liệu khỏi giao diện; TypeScript tự suy kiểu từ schema (`z.infer`).
- **Cons:** màu lấy theo ảnh bằng mắt nên chỉ gần đúng; thông số lấy từ trang hãng/shop, có chỗ các nguồn mâu thuẫn (ghi rõ "có nguồn ghi PP", "chưa xác minh loại").

### 1.2 Dáng vỏ tham số (`CaseShape`)
- **Là gì:** ba con số `bezel` (viền), `cornerRadius` (bo góc), `knob` (núm xoay). `getCaseDimensions(..., bezel)` và `createCaseGeometry(..., cornerRadius)` dựng vỏ theo chúng.
- **Núm xoay:** `knobKeyCode(layout)` tìm phím ngoài cùng bên phải hàng trên (vị trí núm của AULA F75, Hi75C Pro, X85, F99 Pro). Phím đó bị bỏ, một khối trụ kim loại đặt vào đúng chỗ.
- **Cons:** vẫn là hộp bo góc. Dáng đặc trưng (vát cạnh, dải trang trí, logo) cần file 3D thật (bài 12).

### 1.3 IntersectionObserver
- **Là gì:** API trình duyệt báo khi một phần tử đi vào/ra khung nhìn, không cần nghe sự kiện `scroll` (vốn chạy hàng trăm lần mỗi giây).
- **Tác dụng:** `ScrollReveal.tsx` theo dõi mọi phần tử `data-reveal`, thêm class `is-revealed` khi phần tử lộ ra 15%, rồi `unobserve` để mỗi phần tử chỉ chạy một lần.
- **Cách dùng:** `<div data-reveal="left" style={revealDelay(90)}>` (`left` = trượt từ trái, `right` = từ phải, delay để so le).
- **Pros:** nhẹ, không giật khi cuộn. **Cons:** cần JavaScript (nên trạng thái ẩn chỉ bật sau khi script chạy, mục 2.2).

### 1.4 CSS transition chỉ trên `transform` và `opacity`
- Hai thuộc tính này trình duyệt xử lý trên GPU (compositor), không phải tính lại bố cục trang. Animate `left`/`margin` sẽ làm cả trang tính lại layout mỗi khung hình và gây giật.

---

## 2. Bản chất hoạt động (Under the hood)

### 2.1 Chọn một build
```
BuildsPanel (bấm thẻ)
  ├─ useKeyboardStore.applyBuild(id) → layout, caseMaterial, màu, plate, switch, caseShape, buildId, tắt LED hông
  │     └─ KeyboardModel: vỏ theo caseShape, núm xoay, layerDetails() → chú thích 7 lớp bằng linh kiện thật
  └─ useSoundStore.selectPack(build.soundPackId) → soundEngine phát bản thu của build đó
"Nghe thử" = chọn build + playDemo(): tự nhấn/nhả "keycraft␣go↵" qua pressKey/releaseKey
                → phím 3D lún xuống và phát tiếng thật như đang có người gõ
```
Đổi plate/switch khác build thì chú thích ghi theo lựa chọn mới (`layerDetails` so sánh với `build.look`), vì lúc đó không còn là linh kiện của build nữa.

### 2.2 Trượt vào khi cuộn, vẫn an toàn khi tắt JavaScript
```
Không có JS:  [data-reveal] hiện bình thường (CSS ẩn chỉ áp dụng dưới .reveal-ready)
Có JS:        ScrollReveal thêm .reveal-ready lên <html> → phần tử ẩn, lệch ±64px
              IntersectionObserver thấy phần tử → thêm .is-revealed → transition về vị trí gốc
Giảm chuyển động (prefers-reduced-motion): hiện ngay, không trượt
```
`overflow-x: clip` trên `html, body` để phần tử đang lệch 64px ra ngoài mép không tạo thanh cuộn ngang (`clip` thay vì `hidden` vì `hidden` làm hỏng `position: sticky` của thanh menu).

---

## 3. Tại sao chọn cách này (Trade-offs)

| Cách | Ưu | Nhược |
|---|---|---|
| **Một bộ dựng 3D + dữ liệu build (đã chọn)** | 9 build chỉ là 9 object; thêm build không cần code | Dáng vỏ là xấp xỉ |
| File .glb riêng cho từng build | Giống thật 100% | Không có file; mỗi file vài MB |
| Chỉ ảnh + tiếng, không 3D (như shop) | Dễ nhất | Mất phần tách 7 lớp và gõ thử 3D |
| `whileInView` của framer-motion cho hiệu ứng cuộn | Ít code | Render sẵn `opacity: 0` từ server: tắt JS là mất nội dung |

---

## 4. Thử thách tự tay sửa code (5 phút)

1. **Trượt xa hơn:** `src/app/globals.css` dòng 56, đổi `--reveal-x: -64px` thành `-160px` (và dòng của `right` thành `160px`). Cuộn landing page: các khối bay vào từ xa hơn.
2. **Núm xoay to hơn:** `src/components/canvas/KeyboardModel.tsx` dòng 49, đổi `radius: 0.15` thành `0.2`. Chọn AULA F75 trong tab Mẫu phím: núm xoay to ra.
3. **Thêm build của bạn:** trong `src/lib/keyboard/builds.ts` chép một object (ví dụ `lucky65-husky`), đổi `id`, `name`, `specs`, màu trong `look`. Thêm video vào `scripts/sounds/sources.json` với cùng `id`, chạy `npm run sounds -- --only <id>`, và lưu một ảnh vào `public/builds/<id>.jpg`.

---

## 5. 3 câu hỏi phỏng vấn thực chiến

**Q1. Vì sao hiệu ứng hiện khi cuộn không đặt `opacity: 0` sẵn trong HTML?**
Nếu JavaScript lỗi, bị chặn hoặc tải chậm thì nội dung biến mất, cả với công cụ tìm kiếm. Ở đây trạng thái ẩn chỉ được bật bằng class do chính script thêm vào, nên không có script thì trang vẫn đầy đủ.

**Q2. Vì sao dùng IntersectionObserver thay vì `window.addEventListener('scroll', …)` + `getBoundingClientRect()`?**
Sự kiện scroll bắn liên tục trên luồng chính, mỗi lần gọi `getBoundingClientRect` có thể ép trình duyệt tính lại layout, nên dễ giật. IntersectionObserver được trình duyệt tính bất đồng bộ và chỉ báo khi trạng thái giao nhau thay đổi.

**Q3. Thêm trường `caseShape` vào state thì bản build đã lưu trong database (task 3.3) có bị hỏng không?**
Không, vì `buildId` và `caseShape` là trường tuỳ chọn. Nơi đọc dùng `?? DEFAULT_CASE_SHAPE` nên bản lưu cũ vẫn dựng được vỏ mặc định. Đây là cách tiến hoá schema an toàn: thêm trường mới dạng tuỳ chọn có giá trị mặc định, không bắt dữ liệu cũ phải đổi.

---

## 6. Giới hạn hiện tại
- **Ảnh thật cho từng lớp (plate, foam, switch riêng lẻ) chưa có:** không tìm được nguồn ảnh đáng tin cho từng linh kiện; thẻ build dùng ảnh thật của cả build (thumbnail video).
- Màu lấy từ ảnh bằng mắt; dáng vỏ là xấp xỉ.
- Ảnh (`public/builds/`) và tiếng (`public/sounds/`) đã được commit theo yêu cầu của chủ dự án để bản deploy có tiếng thật. Nếu thiếu (xoá file, clone thiếu), thẻ build hiện dải màu thay ảnh và tiếng quay về bộ tổng hợp.
