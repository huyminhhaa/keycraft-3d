# 22 — Ảnh thật, module phần cứng 3D theo ảnh, và sửa lỗi chuyển/dính tiếng (Task 3.8)

> Mục tiêu: 41/41 mẫu phím nhìn ra đúng con phím trong ảnh (màn hình lớn AULA L99, con lăn, núm xoay, khung skeletal…),
> đổi mẫu là đổi tiếng ngay, gõ nhanh / dùng Unikey không còn "dính tiếng nổ to", phím Space không to vọt.

---

## 1. Bách khoa công nghệ dùng trong task

### 1.1 `sharp` (xử lý ảnh trong Node)
- **Là gì:** thư viện xử lý ảnh viết trên libvips, Next.js đã cài sẵn để tối ưu ảnh.
- **Tác dụng ở đây:** `npm run photos` (`scripts/builds/sync-photos.ts`) đọc ảnh trong `pics/<tên mẫu>/`, xoay theo EXIF, đổ nền trắng cho PNG trong suốt, thu cạnh dài về ≤ 1280px **giữ tỷ lệ**, nén JPEG mozjpeg rồi ghi đè `public/builds/<id>.jpg`. Thư mục trống thì giữ ảnh cũ.
- **Cú pháp:** `sharp(file).rotate().flatten({ background: '#fff' }).resize(w, h, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86, mozjpeg: true }).toFile(out)`
- **Ưu:** rất nhanh, ít RAM, một dòng làm cả chuỗi. **Nhược:** module native (cần đúng nền tảng khi cài).

### 1.2 `DynamicsCompressorNode` (Web Audio)
- **Là gì:** bộ nén/giới hạn âm lượng có sẵn trong trình duyệt.
- **Tác dụng:** đặt trước loa (`masterGain → limiter → destination`), threshold −10dB, ratio 12, attack 2ms, release 80ms. Gõ dồn 5–6 phím cùng lúc thì biên độ cộng lại vượt ngưỡng và bị ép xuống, không còn tiếng "bụp" vỡ loa.
- **Ưu:** chạy trên luồng audio, không tốn JS. **Nhược:** ép quá mạnh sẽ làm tiếng "dẹt"; vì vậy chỉ là lưới an toàn, phần chính là giới hạn voice + chuẩn hoá gain.

### 1.3 `AbortController`
- **Là gì:** API huỷ `fetch` đang chạy.
- **Tác dụng:** bấm liên tiếp nhiều mẫu phím → lần tải trước bị huỷ ngay (`controller.abort()`), không tốn băng thông và không có kết quả "về muộn" ghi đè gói mới.

### 1.4 `Map` làm cache LRU
- `Map` giữ thứ tự chèn → xoá rồi chèn lại = "vừa dùng". Giữ tối đa 12 gói đã giải mã; quay lại mẫu đã nghe là có tiếng ngay **0ms**.

### 1.5 Zod `discriminatedUnion` + `transform`
- `moduleSchema` (src/lib/keyboard/modules.ts) là hợp các kiểu `knob | roller | screen | lightbar | badge | blank`, phân biệt bằng trường `kind`. TypeScript tự thu hẹp kiểu trong `switch (module.kind)`.
- `look.transform(...)` tự suy `caseShape.knob` từ danh sách module → không bao giờ lệch nhau.

### 1.6 `InstancedMesh`, `ExtrudeGeometry` có lỗ, `CanvasTexture`
- Gân đáy Halo75 (~200 thanh) là **một** InstancedMesh → 1 draw call.
- Khung skeletal Mercury K1 là `ExtrudeGeometry` từ `Shape` có `holes` hình bầu dục; phía sau là tấm phát sáng.
- Giao diện màn hình (đồng hồ, máy tính bỏ túi L99, trạng thái S75), vân carbon forged, đá marble, dải cầu vồng đều vẽ bằng Canvas 2D → `CanvasTexture`, **cache theo khoá** nên đổi qua lại 41 mẫu không tạo texture mới.

---

## 2. Bản chất hoạt động (Under the hood)

### 2.1 Ảnh thật
```
pics/AULA L99/image.png ──(PHOTO_FOLDERS: tên thư mục ↔ build.id)──► pickPrimaryPhoto()
   ảnh ngang/vuông trước ảnh dọc, rồi tới độ phân giải; tên "cover/main/dai-dien" luôn thắng
──► sharp ──► public/builds/aula-l99.jpg  (thư mục trống: giữ ảnh cũ)
```

### 2.2 Module phần cứng
```
builds.ts look.modules ─┐
layout.displays (L99) ──┼─► resolveModules() ─► PlacedModule[] { rect (u), mount: plate|case }
mẫu cũ (knob, lcd-75) ──┘          │
                                   ├─► replacedKeyCodes() ─► bỏ keycap + switch + lỗ plate ở các phím đó
                                   └─► <ModuleLayer> (parts/Modules.tsx) vẽ màn hình / núm / con lăn / đèn / badge
```
- **AULA L99** có layout riêng `75%-screen`: 75% + khối 3 cột bên phải (Print/Scroll/Pause trên hàng F, màn hình 3u × 5 hàng bên dưới). Màn hình là "vùng hiển thị" của layout nên luôn có, dù chọn layout này từ tab Thiết kế.
- **Con lăn ≠ núm**: con lăn là trụ khía nằm ngang (trục song song hàng phím) trong hốc tối có giá đỡ (Mercury K1 sau F12, Nut75 chỗ End, G87 V2 trong khoảng trống cụm điều hướng).

### 2.3 Phối màu keycap theo slot
```
key (code, role, hàng) + theme(build) ─► resolveKeycapSlot() ─► { id: "row3:pbt" | "accent:translucent" …, color, legend, finish }
KeycapMaterialPool: 1 material / slot → phím cùng slot dùng chung material; slot mới tạo, slot thừa dispose;
useFrame kéo màu dần về đích (đổi màu vẫn mượt).
```
Thứ tự ưu tiên: phím ép màu (`accentKeys`…) > màu theo hàng (`keycapRows`) > vai trò phím. Layout 60/65% không có hàng F nên hàng số đánh số 1 → gradient khớp ảnh.

### 2.4 Âm thanh khi đổi mẫu
```
choose(build): dừng demo → applyBuild → selectPack(id) LUÔN gọi
   soundEngine.loadPack(id):
     1. huỷ fetch cũ (abort), this.pack = null NGAY  ← gõ lúc này ra tiếng tổng hợp theo plate/switch MỚI
     2. có trong cache? gắn ngay, xong
     3. tải + giải mã + đo độ to từng đoạn → gains → cache → gắn nếu vẫn là yêu cầu mới nhất
listen(build): await choose → chỉ gõ demo nếu vẫn là lần bấm mới nhất (token)
```

### 2.5 Chống dính tiếng
```
keydown ─► event.repeat? bỏ ─► pressKey ─► playKeySound
                                     │ pressGate: cùng phím < 22ms hoặc phím bất kỳ < 12ms → bỏ (Unikey bắn Backspace+ký tự)
                                     ▼
                         openVoice(): > 8 voice → voice cũ nhất fade 10ms rồi stop()
                                     ▼
                     voiceGain(gain cân bằng của đoạn) → masterGain → limiter → loa
```
- **Cân bằng Space** (`loudness.ts`): đo RMS cửa sổ 5ms lớn nhất của từng đoạn. Mốc = trung vị phím thường. Space nhắm 1.08× và **trần 1.15×** phím thường; tiếng nhả 0.55× và không bao giờ khuếch đại; đỉnh sau gain ≤ 0.95. File `.wav` không đổi một byte.
- **Space trên nút vừa bấm chuột**: trình duyệt "bấm" lại nút khi nhả Space → "Nghe thử" chạy lại chồng tiếng. Nút được focus bằng chuột (không `:focus-visible`) thì chặn; nút focus bằng Tab vẫn bấm Space bình thường (giữ trợ năng). `BuildsPanel` cũng tự `blur()` sau cú bấm chuột.
- Ẩn tab (`visibilitychange`) / mất focus (`blur`): nhả hết phím im lặng.

---

## 3. Tại sao chọn cách này (Trade-offs)

| Vấn đề | Cách thường gặp | Cách ở đây | Lý do |
|---|---|---|---|
| Dính tiếng | Chỉ hạ volume | Limiter + giới hạn 8 voice + gate 12/22ms | Hạ volume làm nhỏ cả tiếng gõ thường |
| Space to | Cắt lại file wav | Gain lúc phát theo RMS đo được | Giữ nguyên chất âm bản thu |
| Đổi mẫu nhanh | Chờ tải xong mới đổi | Gỡ gói cũ ngay + cache + abort | Không bao giờ ra tiếng mẫu cũ |
| Màn hình/núm | `shellStyle` cứng theo dòng | Module đặt theo mã phím / ô lưới | 1 mẫu có thể vừa núm vừa màn hình, đúng chỗ như ảnh |
| Keycap trong | `transmission` | `transparent + opacity` | `transmission` thêm một lượt render cả cảnh → tụt FPS |
| Màu keycap | 1 material / phím | 1 material / slot | Ít material, vẫn đổi màu mượt |

FPS đo bằng Edge headless (GPU, dev mode): 60–103 FPS ở các mẫu nặng nhất (Nut108 full-size 60, L99 45 lúc trình duyệt còn biên dịch shader lần đầu).

---

## 4. Thử thách tự tay sửa code (5 phút)

1. **Space dày hơn một chút:** mở `src/lib/audio/loudness.ts`, đổi `space: 1.08` trong `LOUDNESS_TARGET` thành `1.12` (đừng vượt `SPACE_CEILING = 1.15`). Mở `/studio`, gõ Space xen phím chữ để nghe khác biệt.
2. **Đổi giao diện màn hình L99:** trong `src/lib/keyboard/modules.ts`, hàm `resolveModules`, đổi `ui: 'calculator'` của màn hình layout thành `'clock'`. Chọn AULA L99: màn hình lớn hiện đồng hồ thay vì máy tính bỏ túi.
3. (Thêm) **Thử gate chặt hơn:** trong `src/lib/audio/pressGate.ts` đổi `anyKeyMs: 12` thành `30` rồi gõ thật nhanh hai phím — bạn sẽ thấy mất tiếng (vì vậy mới chọn 12ms).

---

## 5. Ba câu hỏi phỏng vấn thực chiến

**Q1. Vì sao gỡ `this.pack = null` ngay khi bắt đầu `loadPack` thay vì đợi gói mới tải xong?**
Đợi xong thì trong khoảng tải (vài trăm ms) người dùng gõ sẽ nghe tiếng của mẫu cũ — sai về trải nghiệm. Gỡ ngay thì gõ ra tiếng tổng hợp theo plate/switch của mẫu mới (store đã đổi), và gói đã nghe nằm trong cache nên phần lớn lần đổi là tức thì.

**Q2. Limiter đã chống vỡ tiếng rồi, sao còn cần giới hạn số voice và debounce?**
Limiter chỉ ép biên độ tổng; 20 tiếng chồng nhau vẫn bị ép thành một mảng ồn và tốn CPU tạo node. Giới hạn 8 voice (fade 10ms để không có tiếng "tách") giữ số node thấp, còn gate 12ms loại các sự kiện giả của bộ gõ — vốn là nguyên nhân chính của "dính chữ".

**Q3. Thiết kế module bằng `replaces` (mã phím) thay vì toạ độ cố định có lợi gì?**
Plate/PCB/switch/keycap đều sinh từ danh sách phím, nên chỉ cần bỏ các mã phím bị thay là mọi lớp tự đúng (không khoét lỗ thừa, không vẽ switch dưới màn hình). Toạ độ suy từ layout nên đổi bezel hay layout không phải sửa số. Khi module nằm ở ô trống (khoảng cụm điều hướng TKL) hoặc trên viền vỏ thì dùng `at`.
