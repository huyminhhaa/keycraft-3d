# 16 — Tiếng gõ thật: cắt bản thu từ video sound test thành gói âm thanh

> Task 3.4b. Tiếng tổng hợp (bài 13) được dựng từ sóng sin và nhiễu trắng, nên người chơi phím nghe là biết giả. Bài này thay bằng **bản thu của bàn phím thật**: tải video sound test, tự cắt từng tiếng gõ, rồi phát lại khi bạn gõ.

## 0. Dùng ngay

```bash
npm run sounds                                  # tạo 10 gói trong scripts/sounds/sources.json
npm run sounds -- --only aula-f75-reaper        # tạo lại một gói
npm run sounds -- --id my-board --name "Tên phím" --switch "Tên switch" \
  --url "https://www.youtube.com/watch?v=..." [--start 5 --end 40] [--space 12-18]
```
Cần `yt-dlp` và `ffmpeg` trong PATH. Gói nằm ở `public/sounds/` và đã được commit (chủ dự án chọn đưa lên để bản deploy trên Vercel có tiếng thật). Tạo lại hoặc thêm gói thì chạy `npm run sounds` rồi commit thư mục này.

Vào studio → tab **Âm thanh** → mục **Tiếng gõ thật** để chọn gói. Lựa chọn được nhớ trong trình duyệt.

---

## 1. Bách khoa công nghệ dùng trong task

### 1.1 yt-dlp
- **Là gì:** công cụ dòng lệnh tải video và âm thanh từ YouTube và hàng nghìn trang khác.
- **Tác dụng:** `make-pack.ts` gọi `yt-dlp -f bestaudio[ext=m4a]` để chỉ tải phần tiếng, không tải hình. File được cache trong thư mục tạm, nên chạy lại không tải lại.
- **Pros:** nhanh, chỉ tải đúng luồng âm thanh.
- **Cons:** YouTube đổi cách chặn thường xuyên nên phải cập nhật (`pip install -U yt-dlp`); video bị gỡ thì lỗi (đã gặp với một video MCHOSE).

### 1.2 ffmpeg giải mã ra PCM thô
- **Là gì:** ffmpeg chuyển mọi định dạng âm thanh. `-f f32le` xuất **PCM float 32-bit**: một dãy số thực từ −1 đến 1, mỗi số là độ lệch màng loa tại một thời điểm.
- **Tác dụng:** đưa bản thu về mono 48 kHz, lọc bỏ tiếng ù dưới 40 Hz (`highpass=f=40`). Node đọc file thành `Float32Array` để xử lý.
- **Pros:** không cần thư viện âm thanh nào trong Node.
- **Cons:** file thô khá nặng (1 phút ≈ 11 MB), nhưng chỉ là file tạm.

### 1.3 Onset detection (tìm thời điểm gõ)
- **Là gì:** tìm khoảnh khắc năng lượng âm thanh **vọt lên đột ngột**, tức lúc phím chạm đáy.
- **Cách làm (`slicer.ts`):** tính RMS mỗi 1ms (đường bao năng lượng). Một điểm được tính là tiếng gõ khi: (1) vượt ngưỡng `nền + 12% × (đỉnh − nền)`, (2) gấp 2.5 lần mức thấp nhất trong 15ms trước đó, (3) cách tiếng trước ít nhất 45ms.
- **Pros:** đơn giản, nhanh, không cần AI.
- **Cons:** không biết người ta đang gõ phím nào, chỉ biết "có tiếng gõ". Vì vậy phím cách phải đoán (mục 2.3).

### 1.4 AudioBuffer + AudioBufferSourceNode (Web Audio)
- **Là gì:** `decodeAudioData` giải mã file WAV thành `AudioBuffer` nằm sẵn trong RAM. Mỗi lần gõ tạo một `AudioBufferSourceNode` (rất nhẹ, dùng một lần) để phát buffer đó.
- **Tác dụng:** `soundEngine.loadPack()` giải mã sẵn cả gói, `playSample()` phát ngay khi gõ, độ trễ chỉ vài ms.
- **Pros:** độ trễ thấp hơn hẳn thẻ `<audio>`; phát chồng nhiều tiếng cùng lúc thoải mái.
- **Cons:** phải chờ giải mã lúc đầu (gói khoảng 100–300 KB nên gần như tức thì).

### 1.5 WAV PCM 16-bit
- **Là gì:** định dạng âm thanh không nén, gồm header 44 byte và dữ liệu mẫu. `encodeWav()` tự ghi header (RIFF, fmt, data).
- **Pros:** trình duyệt nào cũng giải mã được; không mất chất lượng.
- **Cons:** nặng hơn MP3/Opus. Mỗi đoạn chỉ khoảng 0.1s nên không đáng kể.

---

## 2. Bản chất hoạt động (Under the hood)

### 2.1 Từ video thành gói âm thanh (`scripts/sounds/make-pack.ts`)
```
YouTube ──yt-dlp──▶ .m4a ──ffmpeg──▶ Float32Array (mono 48kHz)
  detectOnsets()  → vị trí từng cú gõ
  extractClips()  → cắt từ 2ms trước cú gõ tới lúc tiếng tắt (hoặc trước cú gõ kế), đo đặc trưng
  selectClips()   → chọn 16 tiếng phím thường, ≤6 phím cách, 10 tiếng nhả
  packGain() + renderClip() → chuẩn hoá âm lượng chung, vuốt đầu/đuôi
  encodeWav()     → public/sounds/<id>/alpha-01.wav … + pack.json
  writeIndex()    → public/sounds/index.json (danh sách gói cho web)
```

### 2.2 Đặc trưng của một đoạn (`Clip`) và vì sao cần
| Đặc trưng | Ý nghĩa | Dùng để |
|---|---|---|
| `attackMs` | thời gian lên đỉnh | **loại tiếng ù/nhạc nền**: tiếng chạm đáy lên đỉnh trong vài ms, tiếng ù phồng chậm hàng chục ms |
| `secondHit` | đỉnh phụ sau 10ms / đỉnh chính | loại đoạn **dính hai phím** (gõ dồn) |
| `preNoise` | nhiễu 20ms trước cú gõ / đỉnh | chọn đoạn sạch; trung vị của cả gói thành chỉ số `noise` |
| `peak` | đỉnh | tiếng to = nhấn, tiếng nhỏ hơn hẳn (dưới 45%) = nhả phím |
| `zcr`, `tail` | độ sáng, độ ngân | đoán phím cách: trầm hơn và ngân lâu hơn (stabilizer) |

Ba bộ lọc đầu (`attackMs`, `secondHit`, cắt đuôi theo mức tạp âm) được thêm sau khi **vẽ dạng sóng ra ảnh để soi**. Bản đầu tiên nhặt nhầm cục tiếng ù vào nhóm phím cách. Kinh nghiệm: xử lý âm thanh thì luôn nhìn hoặc nghe kết quả, đừng chỉ tin vào con số.

### 2.3 Khi gõ phím trên web
```
keydown → pressedKeys.pressKey → soundEngine.playKeySound(code)
   ├─ có gói: planForKey(code) → nhóm 'space' (Space/Enter/Backspace/Shift) hoặc 'alpha'
   │          pickVariant() chọn biến thể khác lần trước, lệch ±1.5% tốc độ, −8% âm lượng
   └─ chưa có gói: bộ tổng hợp cũ (bài 13)
keyup   → releaseKey → soundEngine.playKeyUp() → nhóm 'up', âm lượng 70%
```
`useSoundStore` (Zustand) nạp `index.json` khi mở studio, chọn gói đã nhớ (localStorage) hoặc gói đầu tiên, rồi gọi `soundEngine.loadPack()`.

---

## 3. Tại sao chọn cách này (Trade-offs)

| Cách | Giống thật | Nhược điểm |
|---|---|---|
| **Cắt từ bản thu thật (đã chọn)** | Rất giống (chính là tiếng thật) | Ăn theo chất lượng mic của người quay; không tách được từng phím |
| Tổng hợp bằng code (bài 13) | Kém, nghe "điện tử" | Đổi plate/switch được ngay |
| Tự thu âm từng phím | Giống nhất, chia đúng từng phím | Phải có máy thật và mic tốt |
| Gói Mechvibes cộng đồng | Tốt | Phải tìm và tải tay từng gói; định dạng mỗi gói một kiểu |

Hệ quả phải chấp nhận: **plate/switch trên web không đổi được tiếng của bản thu.** Muốn nghe AULA F75 với switch Reaper thì chọn đúng gói đó. Vì vậy khi có bản thu, mục "Hồ sơ âm thanh" (dành cho tiếng tổng hợp) được ẩn đi.

---

## 4. Thử thách tự tay sửa code (5 phút)

1. **Tiếng nhả phím to hơn:** `src/lib/audio/soundEngine.ts` dòng 39, đổi `UP_GAIN = 0.7` thành `1`. Gõ rồi nhả chậm, nghe tiếng nhả rõ hơn.
2. **Gõ nghe "máy" hơn:** dòng 168 cùng file, đổi `0.985 + Math.random() * 0.03` thành `1`. Gõ một phím liên tục: mất độ lệch ngẫu nhiên nên nghe đều đều như máy. Đổi lại để thấy vì sao cần lệch.
3. **Thêm bàn phím của bạn:** tìm một video sound test trên YouTube (càng ít nhạc nền, ít lời nói càng tốt), thêm một dòng vào `scripts/sounds/sources.json`, chạy `npm run sounds -- --only <id>`, rồi tải lại trang. Nếu video có đoạn chỉ gõ phím cách (ví dụ giây 12–18), thêm `"space": [[12, 18]]` để chọn đúng tiếng phím cách.

---

## 5. 3 câu hỏi phỏng vấn thực chiến

**Q1. Vì sao không phát mãi một file tiếng gõ mà phải có 16 biến thể, chọn ngẫu nhiên, lệch tốc độ?**
Tai người rất nhạy với âm thanh lặp y hệt ("machine-gun effect"): gõ nhanh mà cùng một mẫu sẽ nghe giả ngay. Nhiều biến thể, không lặp biến thể vừa phát (`pickVariant`), cộng lệch ±1.5% tốc độ và âm lượng thì không có hai lần gõ nào giống hệt nhau, đúng như tay người gõ trên phím thật.

**Q2. Làm sao phân biệt tiếng gõ phím với tiếng ù hay nhạc nền khi chỉ có dãy số âm thanh?**
Dựa vào hình dạng đường bao: tiếng va chạm cơ học có sườn lên rất dốc (đạt đỉnh dưới 8ms, `MAX_ATTACK_MS`), còn tiếng nền phồng lên từ từ. Thêm bộ lọc "năng lượng gấp 2.5 lần mức thấp nhất 15ms trước" để chỉ bắt chỗ thay đổi đột ngột, và chỉ số `preNoise` để chấm độ sạch.

**Q3. Vì sao giải mã sẵn cả gói thành AudioBuffer thay vì dùng `new Audio('alpha-01.wav').play()` mỗi lần gõ?**
Thẻ `<audio>` phải tải, giải mã và lên lịch qua media pipeline, độ trễ thường vài chục ms, gõ nhanh còn bị nghẽn. AudioBuffer đã giải mã nằm sẵn trong RAM; `AudioBufferSourceNode` phát gần như tức thì và phát chồng thoải mái. Đổi lại phải tải toàn bộ gói trước, nhưng gói chỉ vài trăm KB.

---

## 6. Giới hạn hiện tại

- 3 gói bị gắn nhãn **"nhiều tạp âm"** (`noise > NOISY_PACK`, dòng 23 `soundPacks.ts`): Leobog Hi75 Vertex, Lucky65 Turtle Silent, MCHOSE Ace 68 Turbo. Muốn sạch hơn thì đổi sang video khác trong `sources.json`.
- Mỗi gói lấy theo **switch trong video**, một số video ghi "Switch theo máy" vì tiêu đề không nói rõ switch.
- Phím cách được đoán tự động; gói nào nghe sai thì dùng `--space`.
- Trang giới thiệu (`/`) vẫn dùng tiếng tổng hợp cho các nút so sánh plate.
