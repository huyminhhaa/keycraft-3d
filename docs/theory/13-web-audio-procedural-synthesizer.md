# Bách Khoa Toàn Thư Web Audio API: Procedural Key Sound Synthesizer & Acoustic Physics Simulation

> **Mã tài liệu:** `13-web-audio-procedural-synthesizer`  
> **Dự án:** KeyCraft 3D — Custom Mechanical Keyboard Studio  
> **Thuộc chặng:** Chặng 3: Dữ Liệu Lớn, Vector Search & Kiến Trúc Sản Phẩm Thực Tế (Task 3.4)  
> **Trình độ:** Từ số 0 đến Kỹ sư Âm thanh Web (Web Audio Engineer)

---

## 1. Bách Khoa Công Nghệ Sử Dụng Trong Task

### 1.1. `Web Audio API` & `AudioContext` — Trái Tim Của Xử Lý Tín Hiệu Số Trên Trình Duyệt
- **Định nghĩa:** `Web Audio API` là một hệ thống con (subsystem) cấp cao của trình duyệt, được thiết kế để xử lý và tổng hợp âm thanh trong không gian mạng với độ trễ cực thấp (Zero-latency $\le 5\text{ms}$), hoạt động hoàn toàn trên một luồng âm thanh riêng biệt (Audio Render Thread) tách rời khỏi Main Thread của JavaScript.
- **Tác dụng trong KeyCraft 3D:** Khởi tạo đồ thị âm thanh (Audio Graph), điều phối các nút dao động (Oscillator), bộ lọc tần số (Filter), bộ khuếch đại (Gain) để giả lập tiếng gõ phím cơ ngay tức thì khi người dùng gõ phím thật hoặc click chuột trên mô hình 3D.
- **Cách sử dụng (Syntax chuẩn):**
  ```typescript
  // Khởi tạo AudioContext sau tương tác của người dùng (User Gesture)
  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  // Đảm bảo trạng thái running (tránh bị đình chỉ do Autoplay Policy)
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  ```
- **Điểm mạnh (Pros):**
  - **Độ trễ bằng 0:** Khác với thẻ `<audio>` thông thường, Web Audio API phản hồi ngay trong mili-giây đầu tiên người dùng bấm phím.
  - **Khả năng điều chế thời gian thực (Real-time Parameter Modulation):** Thay đổi cao độ (pitch), độ vang (resonance) và độ tắt tiếng (damping) ngay lập tức khi người dùng đổi Plate từ Nhôm sang POM.
- **Hạn chế (Cons):**
  - Trình duyệt hiện đại áp dụng chính sách bảo mật **Autoplay Policy**: AudioContext không thể tự động phát âm thanh khi vừa vào trang nếu người dùng chưa bấm/chạm vào màn hình ít nhất một lần.

---

### 1.2. `OscillatorNode` — Bộ Dao Động Tạo Sóng Âm Cơ Bản
- **Định nghĩa:** Nút âm thanh sinh ra các dạng sóng tuần hoàn liên tục (Sine, Triangle, Square, Sawtooth) với tần số (Frequency tính bằng Hertz) xác định.
- **Tác dụng trong KeyCraft 3D:**
  - **Sóng tam giác (`triangle`):** Dùng làm nguồn âm chính cho tiếng va đập đáy (Bottom-out Impact). Sóng tam giác có nhiều họa âm lẻ (odd harmonics) nhưng tắt dần nhanh, mang lại chất âm gõ cơ học mộc mạc và giòn giã.
  - **Sóng sin (`sine`):** Dùng cho các phím lớn (Spacebar, Shift) và xung vượt khấc (Tactile bump) để tạo độ trầm sâu và êm tai.
  - **Sóng vuông (`square`):** Dùng cho switch **Clicky** để mô phỏng tiếng kim loại nảy đanh sắc của lá đồng (Click bar / Click jacket).
- **Cách sử dụng:**
  ```typescript
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(520, ctx.currentTime);
  // Hạ tần số nhanh (Pitch Drop) tạo cảm giác va đập vật lý
  osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.015);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.07);
  ```

---

### 1.3. `BiquadFilterNode` — Bộ Lọc Âm Thanh Định Hình Âm Sắc Plate (Clack vs Thock)
- **Định nghĩa:** Bộ lọc kỹ thuật số bậc hai (Second-order IIR Filter), cho phép lọc và làm nổi bật các dải tần số cụ thể của tín hiệu âm thanh.
- **Các loại bộ lọc áp dụng trong bàn phím:**
  - **`bandpass` (Lọc dải thông):** Chỉ cho dải tần số quanh tần số trung tâm $f_0$ đi qua, điều chỉnh bởi hệ số phẩm chất $Q$ (Quality Factor).
    - **Plate Nhôm (`aluminum`):** Tần số trung tâm cao ($680\text{Hz}$), $Q = 4.5$ tạo âm thanh đanh, nảy (**Crisp Clack**).
    - **Plate POM / PC:** Tần số trung tâm trầm ($290\text{Hz} - 340\text{Hz}$), $Q = 1.8 - 2.2$ tạo chất âm trầm ấm, dày đặc (**Deep Thock**).
  - **`highpass` (Lọc dải cao):** Dùng cho dải tiếng ồn ma sát (Friction noise) trên $1400\text{Hz} - 2200\text{Hz}$.
- **Cách sử dụng:**
  ```typescript
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(680, ctx.currentTime);
  filter.Q.setValueAtTime(4.5, ctx.currentTime);
  ```

---

### 1.4. `AudioBufferSourceNode` & Noise Burst — Giả Lập Tiếng Gió Và Ma Sát Vỏ Switch
- **Định nghĩa:** Tạo xung tín hiệu ngẫu nhiên (White Noise) thông qua mảng số thực `Float32Array` trong khoảng $[-1.0, 1.0]$.
- **Tác dụng:** Trong thế giới thực, khi thanh trượt (stem) của switch trượt trong lòng vỏ (housing), luôn có một tiếng rít ma sát siêu nhỏ (scratchiness/air release) kéo dài chừng $25\text{ms} - 30\text{ms}$. Việc cộng thêm tầng noise burst này biến âm thanh điện tử khô cứng thành âm thanh cơ khí tự nhiên 100%.

---

### 1.5. `GainNode` & Đường Cong Bao Âm Lượng ADSR (Attack - Decay Envelope)
- **Định nghĩa:** Bộ điều khiển biên độ (âm lượng) theo thời gian bằng các hàm nội suy toán học `linearRampToValueAtTime` và `exponentialRampToValueAtTime`.
- **Đặc trưng gõ phím cơ:**
  - **Attack (Thời gian dâng cực đại):** Cực kỳ nhanh, chỉ $2\text{ms} - 3\text{ms}$ mô phỏng thời khắc va chạm tức thì.
  - **Decay (Thời gian tắt tiếng):** Tắt theo hàm mũ tự nhiên từ $50\text{ms}$ đến $90\text{ms}$ tùy thuộc vào độ tắt tiếng `damping` của Plate. Riêng switch **Silent**, decay bị cắt xuống một nửa ($30\text{ms}$) mô phỏng miếng đệm cao su giảm chấn triệt tiêu dao động.

---

## 2. Bản Chất Hoạt Động (Under The Hood)

### 2.1. Đồ Thị Âm Thanh Đa Tầng (Multi-Layer Audio Graph Flow)
Khi người dùng nhấn phím (hoặc click chuột lên mô hình 3D), luồng xử lý tín hiệu diễn ra như sau:

```
[ Sự kiện KeyDown / PointerDown ]
              │
              ▼
  soundEngine.playKeySound(code)
              │
  ┌───────────┴─────────────────────────────────────────┐
  │                                                     │
[ Layer 1: Bottom-out Impact ]            [ Layer 2: Friction Noise ]
  Oscillator (Triangle/Sine)                BufferSource (White Noise)
              │                                         │
  Frequency Drop (500Hz -> 300Hz)           Highpass Filter (1400Hz+)
              │                                         │
  BiquadFilter (Bandpass theo Plate)                    │
              │                                         │
  Gain Envelope (Decay 60ms)                Gain Envelope (Decay 25ms)
              │                                         │
  └───────────┬─────────────────────────────────────────┘
              │
              ▼
    [ Layer 3: Switch 특 tính ]
    - Clicky: Square wave pulse (3.2kHz click)
    - Tactile: Sine wave bump pulse (180Hz)
    - Silent: Triệt tiêu Layer 2, giảm Decay 60%
              │
              ▼
      Master GainNode (Volume / Mute)
              │
              ▼
      ctx.destination (Loa / Tai nghe máy tính)
```

---

## 3. Tại Sao Chọn Cách Này (Trade-offs)

| Tiêu chí so sánh | Procedural Audio (Cách của KeyCraft) | Tải file Audio Samples (.mp3/.wav) |
| :--- | :--- | :--- |
| **Dung lượng tải trang** | **0 KB:** Không cần tải bất kỳ file audio nào từ server. | Tốn từ **2 MB đến 20 MB** tải các file âm thanh switch. |
| **Độ trễ (Latency)** | **Zero-latency ($\le 5\text{ms}$):** Phát ngay lập tức khi ngón tay chạm phím. | Dễ bị trễ (lag) nếu mạng chậm hoặc file chưa tải xong. |
| **Khả năng biến hóa âm sắc** | **Vô hạn:** Tự do chỉnh cao độ, độ vang, plate nhôm/POM, phím to/nhỏ chỉ bằng 1 dòng code toán học. | **Bị đóng băng:** Muốn đổi tiếng plate nhôm sang POM phải đi thu âm lại 1 bộ file mới. |
| **Hiện tượng "Machine Gun Effect"** | **Khắc phục 100%:** Áp dụng Jitter ngẫu nhiên vi mô ($\pm 2\%$ pitch, $\pm 5\%$ gain) nên mỗi lần gõ đều độc bản như bàn phím thật. | Gõ liên tục nghe như tiếng súng máy lặp lại đơn điệu vì cùng phát 1 file audio. |

---

## 4. Thử Thách Tự Tay Sửa Code (5 Phút)

### Thử thách 1: Tăng độ "Đanh" (Clack) của Plate Nhôm lên cực hạn
- **Mục tiêu:** Khiến âm thanh khi chọn Plate nhôm nghe sắc và nảy như tiếng gõ trên phiến đá kim loại.
- **Tệp cần mở:** [src/lib/audio/soundEngine.ts](file:///d:/Projects/keycraft-3d/src/lib/audio/soundEngine.ts#L160)
- **Dòng code:** Trong khối `case 'aluminum':`
  ```typescript
  // Đổi baseFreq từ 680 lên 850, tăng filterQ từ 4.5 lên 6.0:
  case 'aluminum':
    baseFreq = 850 * profile.pitchMultiplier * jitter;
    filterQ = 6.0;
    decayTime = 0.05 * (1.2 / profile.damping);
    break;
  ```
- **Thử nghiệm:** Vào tab **Âm thanh** trên web, chọn Plate **Nhôm**, gõ phím và cảm nhận sự đanh giòn khác biệt rõ rệt!

### Thử thách 2: Biến phím Spacebar nghe "Thock" sâu và dày hơn nữa
- **Tệp cần mở:** [src/lib/audio/soundEngine.ts](file:///d:/Projects/keycraft-3d/src/lib/audio/soundEngine.ts#L185)
- **Dòng code:** Tìm đoạn `if (isLarge)`:
  ```typescript
  // Giảm tần số xuống sâu hơn nữa (0.55 thay vì 0.72) và tăng độ ngân (1.4):
  if (isLarge) {
    baseFreq *= 0.55;
    decayTime *= 1.4;
  }
  ```
- **Thử nghiệm:** Bấm phím **Spacebar** trên bàn phím máy tính thật của bạn để nghe tiếng nảy trầm sâu lắng!

---

## 5. 3 Câu Hỏi Phỏng Vấn Thực Chiến (Audio / Web Engineer Q&A)

### Câu 1: Tại sao trình duyệt lại chặn không cho AudioContext tự động phát âm thanh khi tải trang, và làm thế nào để xử lý đúng chuẩn?
> **Đáp án chuẩn kỹ sư:**  
> Các trình duyệt hiện đại (Chrome, Safari, Firefox) áp dụng chính sách **Autoplay Policy** nghiêm ngặt nhằm bảo vệ trải nghiệm người dùng, ngăn các trang web tự ý phát âm thanh/quảng cáo gây khó chịu. Khi trang vừa tải, `AudioContext` sẽ tự động bị đặt ở trạng thái `'suspended'`.  
> Để xử lý đúng chuẩn, ứng dụng cần thiết kế theo mô hình **Lazy Initialization** gắn liền với **User Gesture** (sự kiện click chuột, chạm màn hình hoặc bấm phím). Khi phát hiện tương tác đầu tiên, ta gọi `ctx.resume()` hoặc khởi tạo `new AudioContext()`. Khi đó, trình duyệt sẽ cấp quyền phát âm thanh mượt mà cho toàn bộ phiên làm việc tiếp theo.

### Câu 2: Hiệu ứng "Machine Gun Effect" trong game audio là gì và làm thế nào để giải quyết khi lập trình âm thanh bàn phím cơ?
> **Đáp án chuẩn kỹ sư:**  
> "Machine Gun Effect" (hiệu ứng súng máy) là hiện tượng tai người nhận thấy âm thanh bị giả tạo, cơ học và đơn điệu khi cùng một mẫu âm thanh được kích hoạt lặp đi lặp lại với tần số và biên độ giống hệt nhau trong thời gian ngắn (như khi gõ văn bản nhanh).  
> Để triệt tiêu hiện tượng này trong Procedural Audio, ta áp dụng kỹ thuật **Micro-variation (Biến thiên vi mô)**:
> 1. Nhân tần số cơ bản với một hệ số ngẫu nhiên nhẹ: $\text{pitchJitter} \in [0.98, 1.02]$ ($\pm 2\%$).
> 2. Nhân âm lượng với hệ số ngẫu nhiên: $\text{gainJitter} \in [0.95, 1.05]$ ($\pm 5\%$).
> Nhờ đó, mỗi phím gõ xuống đều có dao động vật lý độc bản, chân thực như lực tác động ngón tay ngoài đời.

### Câu 3: Kỹ thuật tổng hợp âm thanh Procedural Audio khác với Sample-based Audio thế nào về mặt sử dụng tài nguyên (CPU vs RAM/Network)?
> **Đáp án chuẩn kỹ sư:**  
> - **Sample-based Audio:** Sử dụng tài nguyên mạng (Network bandwidth) để tải các file `.wav/.mp3` và tiêu tốn bộ nhớ RAM để lưu trữ mảng buffer giải mã. Nó giải phóng nhẹ cho CPU nhưng tốn tài nguyên lưu trữ và bị giới hạn bởi độ phong phú của tập mẫu.
> - **Procedural Audio:** Không tốn 1 byte băng thông mạng và RAM vì âm thanh được tính toán bằng các công thức toán học ngay thời điểm phát (On-the-fly math synthesis). Đổi lại, nó tiêu tốn một lượng tính toán nhỏ trên Audio Render Thread của CPU. Với năng lực phần cứng hiện nay, việc chạy vài bộ Oscillator và BiquadFilter chỉ chiếm chưa tới $0.1\%$ CPU nhưng mang lại tính linh hoạt vật lý vô hạn.
