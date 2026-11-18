# 21 — Thêm 21 bàn phím thật, layout 60% và full-size, làm lại panel "Mẫu phím"

Task 3.7: thêm PMO Aurora 80, Wave 75, Weikav Nut65/75/87/108, Stars75 S, AULA F87 Pro, S75 Pro, Nova75 Pro, L99, Leobog Hi8 SE, Hi98C Pro, Wobkey Zen65, Riccks RS8, Chilkey ND75, CIDOO QK61 V2, QK75, GravaStar Mercury K1, MCHOSE G75 V2, G87 V2. Thư viện từ 20 lên 41 mẫu.

## 1. Bách khoa công nghệ dùng trong task

### 1.1 `as const` + `typeof X[number]` (TypeScript)
- **Là gì:** viết danh sách một lần (`KEYBOARD_LAYOUTS = ['60%', …, '100%'] as const`) rồi suy ra kiểu (`type KeyboardLayout = (typeof KEYBOARD_LAYOUTS)[number]`).
- **Tác dụng:** trước đây danh sách layout bị chép tay ở 5 chỗ (type, Zod build, Zod model, tool AI, test). Thêm 60%/100% chỉ cần sửa `src/types/keyboard.ts`; `z.enum(KEYBOARD_LAYOUTS)` tự nhận giá trị mới.
- **Pros:** một nguồn sự thật, quên chỗ nào là `tsc` báo. **Cons:** phải `as const`, không thì TypeScript coi là `string[]`.

### 1.2 yt-dlp + ffmpeg đọc thẳng luồng video
- `yt-dlp -g` trả về link luồng video; `ffmpeg -ss <giây> -i <link> -frames:v 1` cắt đúng 1 khung hình mà không tải cả file.
- Dùng để soi màu keycap/vỏ và linh kiện (Nut108 thấy plate đen + mạch trắng, Nut87 tương tự).
- **Cons:** chỉ thấy cái video quay; switch nằm dưới keycap thì không thấy.

### 1.3 `xstack` (ffmpeg)
- Ghép nhiều ảnh thành một lưới (`xstack=inputs=8:layout=0_0|640_0|…`) để soi 8 mẫu trong một lần xem thay vì 8 lần.

## 2. Bản chất hoạt động (Under the hood)

1. **Tiếng gõ:** script `hunt.mjs` (scratchpad) tìm `"<tên> sound test"` trên YouTube, lọc tiêu đề phải chứa tên mẫu, chạy `npm run sounds -- --id … --url …` cho từng video tới khi `pack.json` có `noise ≤ 0.02`. Video so sánh nhiều phím (S75 Pro vs F75, G75 Pro vs V2, Stars75 vs D75) bị loại vì tiếng lẫn. Video RS8 test 3 switch liền nhau nên cắt riêng đoạn Bsun TaiChi (`start: 644, end: 738` trong `scripts/sounds/sources.json`).
2. **Ảnh:** thumbnail 1280×720 của chính video tiếng gõ → `public/builds/<id>.jpg`. Thumbnail xấu (Stars75 S là màn xanh lá, G87 V2 chỉ chụp switch) thì lấy từ video review khác của đúng mẫu đó.
3. **Thông số:** trang shop/hãng + mô tả video (Wave75: "PP Plate, HMX Bamboo"; Aurora 80: "FR4, Kailh Lunar Moon God"; Zen65 Lite: "HMX Violet / PC plate").
4. **Dữ liệu → 3D:** `BATCH_3` trong `src/lib/keyboard/builds.ts` → `applyBuild` (store) → `KeyboardModel.tsx` đọc layout, màu, `shellStyle`, `pcbColor`.
5. **Layout mới** (`src/lib/keyboard/layouts.ts`): 60% = 65% bỏ cột phải và cụm mũi tên (61 phím, rộng 15u). 100% = TKL + numpad 17 phím + 4 phím media (108 phím, rộng 22.5u). Phím + và Enter numpad cao 2u ngoài đời được vẽ 1u, ô dưới để trống.
6. **Stars75 S** (`shellStyle: 'stars-s'`, `parts/ShellParts.tsx`): hai "góc vỡ" thật ra là dải đèn PC cắt kim cương chạy chéo qua góc trên-trái và dưới-phải. Dựng bằng 2 hộp mảnh xoay ±45°, vật liệu PC trong mờ phát sáng theo màu LED.
7. **Panel "Mẫu phím"** (`src/components/ui/BuildsPanel.tsx`): danh sách gọn (ảnh nhỏ, hãng, tên, chấm màu vỏ/keycap/stem switch, nút nghe riêng), lọc theo layout và theo hãng (`buildBrand` = chữ đầu của tên). Mẫu đang chọn mở ảnh lớn + lưới 6 thông số.

## 3. Tại sao chọn cách này (Trade-offs)
- **Không đoán màu switch:** 9 mẫu (Nut65/75/87/108, Nova75 Pro, L99, G75 V2, QK75, RS8) không thấy switch trong video → để `switchColors` trống (màu mặc định) thay vì bịa. Test khoá đúng danh sách này.
- **L99:** màn hình cảm ứng 3.98" bên phải chưa dựng (cần mở rộng vỏ sang phải); mô hình dùng layout 75%.
- **Mercury K1:** khung skeletal rỗng chưa dựng, dùng dáng vát hông `x85` gần nhất.
- **Lọc theo hãng bằng chữ đầu tên:** không cần thêm trường `brand` vào 41 build.

## 4. Thử thách tự tay sửa code (5 phút)
1. `src/components/canvas/parts/ShellParts.tsx`, trong `DiagonalCornerStrips`: đổi `bezel * 2.6` thành `bezel * 4` → chọn Stars75 S, dải đèn chéo dài ra cắt sâu vào góc.
2. `src/lib/keyboard/layouts.ts`, layout `'100%'`: xoá dòng `m('AudioVolumeMute', …), …` 4 phím media → Nut108 còn 104 phím chuẩn ANSI (test `countKeys('100%')` sẽ báo 104 ≠ 108, sửa test theo).

## 5. 3 câu hỏi phỏng vấn thực chiến
1. **Vì sao dùng `as const` cho danh sách layout?** Để TypeScript giữ từng giá trị literal ('60%', '100%'…), từ đó suy ra union type và đưa thẳng vào `z.enum`; thêm layout chỉ sửa 1 chỗ.
2. **Lọc video tiếng gõ "sạch" thế nào?** Tách tiếng gõ bằng phát hiện onset, đo năng lượng nền trước mỗi tiếng (`preNoise`), lấy trung vị làm `noise`; chỉ nhận gói ≤ 0.02 và loại video so sánh nhiều bàn phím vì tiếng bị trộn.
3. **Thiếu dữ liệu thật (màu switch không thấy) thì xử lý sao?** Để trống và dùng mặc định, ghi rõ trong test/tài liệu, thay vì đoán; dữ liệu sai còn tệ hơn dữ liệu thiếu.
