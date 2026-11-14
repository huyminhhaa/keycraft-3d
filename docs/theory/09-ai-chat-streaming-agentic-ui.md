# Bài học 09: Trợ lý AI Streaming, Giao diện Tác nhân (Agentic UI) & Đồng bộ Trạng thái 3D Thời gian thực

> **Mục tiêu học tập:** Nắm vững toàn bộ kiến trúc từ số 0 về Server-Sent Events (SSE), Web Streams API (`ReadableStream`), cơ chế Agentic UI (AI điều khiển ứng dụng trực tiếp), cách xây dựng Custom React Hook `useAIAssistant`, và kỹ thuật trực quan hoá âm học (Acoustic Waveform) đồng bộ 2 chiều với 3D Canvas.

---

## 1. Bách khoa Công nghệ Sử dụng trong Task

### 1.1. Server-Sent Events (SSE) & Giao thức Truyền phát UIMessage Stream

#### A. Định nghĩa (Là gì?)
**Server-Sent Events (SSE)** là một chuẩn giao tiếp một chiều qua giao thức HTTP (thường là HTTP/1.1 hoặc HTTP/2). Máy chủ giữ một kết nối HTTP mở với header `Content-Type: text/event-stream` và liên tục "bắn" các đoạn dữ liệu dạng bản tin (events) về cho trình duyệt dưới định dạng:
```http
data: {"type": "text-delta", "delta": "Xin chào"}\n\n
```
Trong **Vercel AI SDK v7**, phương thức `result.toUIMessageStreamResponse()` đóng gói toàn bộ quá trình suy luận của mô hình ngôn ngữ lớn (LLM) — bao gồm các từ ngữ đang gõ (`text-delta`), quyết định gọi công cụ (`tool-input-available`), và kết quả thực thi công cụ (`tool-output-available`) — thành một luồng SSE có cấu trúc chuẩn.

#### B. Tác dụng trong dự án KeyCraft 3D
- Thay vì phải chờ Gemini 2.0 Flash tạo xong toàn bộ câu trả lời dài (mất 2–5 giây) mới hiển thị lên màn hình, SSE cho phép từng ký tự xuất hiện ngay lập tức sau 150–300ms.
- Quan trọng hơn hết, khi AI quyết định đổi màu vỏ hay đổi plate sang POM, gói tin gọi tool `tool-input-available` được truyền ngay qua SSE, giúp trình duyệt **cập nhật mô hình bàn phím 3D ngay trong lúc AI vẫn đang tiếp tục nói**.

#### C. Cách sử dụng (Syntax chuẩn)
```typescript
// Phía Server: Route Handler (src/app/api/chat/route.ts)
const result = streamText({
  model: google('gemini-2.0-flash'),
  system: SYSTEM_PROMPT,
  messages,
  tools: keyboardTools,
});
return result.toUIMessageStreamResponse();

// Phía Client: Đọc stream bằng ReadableStream
const response = await fetch('/api/chat', { method: 'POST', body: ... });
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunkText = decoder.decode(value, { stream: true });
  // Phân tích cú pháp data: {...}
}
```

#### D. Điểm mạnh (Pros) & Hạn chế (Cons)
* **Điểm mạnh (Pros):**
  * Chạy trên HTTP tiêu chuẩn, không cần mở cổng hay bắt tay (handshake) phức tạp như WebSocket.
  * Tương thích hoàn hảo với cơ chế Serverless (Next.js Edge / Node.js Runtime), vượt qua firewall và proxy công ty dễ dàng.
  * Tiết kiệm băng thông và tài nguyên CPU hơn nhiều so với cơ chế Polling (liên tục gửi request hỏi "xong chưa?").
* **Hạn chế (Cons):**
  * Chỉ truyền 1 chiều từ Server -> Client. Nếu Client muốn gửi thêm tin nhắn mới, bắt buộc phải gửi một HTTP POST request riêng biệt.
  * Nếu kết nối mạng giữa chừng bị ngắt (TCP drop), cần có logic xử lý buffer dở dang (remainder buffer) để không làm vỡ chuỗi JSON.

---

### 1.2. Agentic UI & Đồng bộ 2 Chiều với Zustand (Realtime 3D State Sync)

#### A. Định nghĩa (Là gì?)
**Agentic UI (Giao diện Tác nhân)** là mô hình thiết kế mà ở đó AI Agent không chỉ là một chiếc hộp trả lời văn bản thụ động (Chatbot truyền thống), mà đóng vai trò là một "người vận hành hệ thống" có quyền năng tương tác, kích hoạt sự kiện và thay đổi trạng thái trực tiếp của ứng dụng giao diện.

#### B. Tác dụng trong dự án KeyCraft 3D
Khi người dùng nói: *"Tôi thích âm Thock sâu ấm, hãy chỉnh giúp tôi"*, hệ thống diễn ra 2 luồng song song:
1. **Luồng ngôn ngữ (Verbal):** AI giải thích tại sao cần dùng Plate POM và Switch Linear.
2. **Luồng tác nhân (Agentic Action):** AI gọi tool `updateKeyboardConfig({ plateMaterial: 'pom', switchType: 'linear' })`. Hàm `applyToolToStore` lập tức nạp tham số vào Zustand `applyAIConfig()` -> Mô hình 3D trong Three.js đổi ngay chất liệu và âm học đổi theo mà không cần người dùng tự bấm tay từng nút trong sidebar!

#### C. Cách sử dụng (Syntax chuẩn)
```typescript
// Trích xuất từ src/lib/ai/chatStream.ts
export function applyToolToStore(toolName: string, input: Record<string, unknown>) {
  if (toolName === 'updateKeyboardConfig') {
    useKeyboardStore.getState().applyAIConfig({
      layout: input.layout as KeyboardLayout,
      plateMaterial: input.plateMaterial as PlateMaterial,
      switchType: input.switchType as SwitchType,
      caseColor: input.caseColor as string,
    });
    return { applied: true, summary: 'Đã cập nhật cấu hình 3D' };
  }
}
```

#### D. Điểm mạnh & Hạn chế
* **Điểm mạnh:** Trải nghiệm "Ma thuật" (Magical UX) — người dùng chỉ cần mô tả mong muốn bằng ngôn ngữ tự nhiên, giao diện 3D tự động biến hình trước mắt.
* **Hạn chế:** Cần lá chắn thẩm định nghiêm ngặt (Zod validation) để AI không truyền bừa các thông số không hợp lệ (như màu HEX sai chuẩn hoặc layout không tồn tại) làm sập 3D Canvas.

---

### 1.3. Web Streams API & Quản lý Luồng Hủy Bỏ với `AbortController`

#### A. Định nghĩa (Là gì?)
**`AbortController`** là một Web API tích hợp sẵn trong trình duyệt và Node.js, cung cấp một đối tượng `AbortSignal` cho phép hủy bỏ (cancel) một hoặc nhiều tác vụ bất đồng bộ (như `fetch`, stream đọc dữ liệu hoặc Promise dài hạn) bất kỳ lúc nào.

#### B. Tác dụng trong dự án KeyCraft 3D
Khi AI đang stream một câu trả lời dài hoặc đang đổi cấu hình, nếu người dùng muốn dừng lại hoặc đặt câu hỏi khác ngay, họ chỉ cần nhấn nút **Dừng (Stop)**. `abortControllerRef.current.abort()` sẽ lập tức đóng kết nối HTTP stream, giải phóng RAM và dừng việc render không cần thiết.

#### C. Cách sử dụng (Syntax chuẩn)
```typescript
const controller = new AbortController();

fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ messages }),
  signal: controller.signal, // Gắn cờ huỷ
});

// Khi cần dừng:
controller.abort();
```

---

### 1.4. Trực quan hoá Âm học Động (Procedural Acoustic Waveform)

#### A. Định nghĩa (Là gì?)
Là kỹ thuật tính toán biên độ và chiều cao của dải sóng âm (12 thanh tần số) theo thời gian thực dựa trên các hằng số vật lý của bàn phím cơ:
$$\text{Chiếu cao thanh } i = \text{clamp}\left(18, 100, \left(W_i \times 0.6 + \sin\left(\frac{i}{11}\pi\right) \times \text{pitchMultiplier} \times 0.4\right) \times 85\right)$$

#### B. Tác dụng trong dự án KeyCraft 3D
- Biến các con số âm học khô khan (`pitchMultiplier: 0.85`, `damping: 0.55`) thành hình ảnh sóng âm nhấp nhô trực quan.
- Khi AI đang nói (`isStreaming === true`), các thanh sóng âm tự động kích hoạt animation CSS `@keyframes sound-wave` với độ trễ so le (`animationDelay: index * 60ms`), tạo cảm giác như AI đang trực tiếp phát âm thanh phân tích.

---

## 2. Bản chất Hoạt động (Under the Hood)

Dưới đây là sơ đồ luồng dữ liệu khép kín từ khi người dùng gõ câu hỏi cho đến khi mô hình 3D xoay chuyển:

```
[ Người dùng nhập: "Chỉnh cho phím thock ấm nhất" ]
                      │
                      ▼
        ┌─────────────────────────────┐
        │   src/lib/ai/useAIAssistant │
        └──────────────┬──────────────┘
                       │ HTTP POST /api/chat
                       ▼
        ┌─────────────────────────────┐
        │   src/app/api/chat/route.ts │
        └──────────────┬──────────────┘
                       │ StreamText (Gemini 2.0 Flash)
                       ▼
        ┌─────────────────────────────┐
        │  Gemini nhận System Prompt  │
        │  & Quyết định gọi Tools     │
        └──────────────┬──────────────┘
                       │
       ┌───────────────┴────────────────┐
       ▼                                ▼
[Tool Call: updateKeyboardConfig]    [Text Generation: "Tôi đã chọn..."]
       │                                │
       ▼                                ▼
[SSE: tool-input-available]          [SSE: text-delta]
       │                                │
       └───────────────┬────────────────┘
                       │ HTTP text/event-stream (Chunks)
                       ▼
        ┌─────────────────────────────┐
        │    src/lib/ai/chatStream    │
        │   parseSSELines() Buffer    │
        └──────────────┬──────────────┘
                       │
       ┌───────────────┴────────────────┐
       ▼                                ▼
[applyToolToStore()]             [setMessages(content)]
       │                                │
       ▼                                ▼
[useKeyboardStore.applyAIConfig]   [AIChatPanel hiển thị chữ]
       │
       ▼
[Three.js R3F Canvas]
- Plate chuyển thành POM
- Switch chuyển thành Linear
- soundProfile tự tính về "Deep Thock"
- Sóng âm AcousticWaveform cập nhật ngay lập tức!
```

### Giải thích từng mắt xích:
1. **Bộ đệm dòng (Line Buffer Parsing):** Dữ liệu truyền qua mạng Internet được băm nhỏ thành các gói TCP (chunks). Một chunk có thể bị đứt ngang giữa chừng một dòng JSON. Hàm `parseSSELines()` sử dụng kỹ thuật `lines.pop()` để giữ lại phần dòng chưa có dấu `\n` (gọi là `remainder`) và nối vào chunk kế tiếp, ngăn chặn 100% lỗi `SyntaxError: Unexpected end of JSON input`.
2. **Xử lý bất đồng bộ không gây giật lag (Non-blocking):** Mọi tác vụ cập nhật Zustand store diễn ra trong microtask của JavaScript, trong khi render 3D chạy trên WebGL context độc lập ở tốc độ 60/120 FPS. Do đó, việc streaming văn bản hoàn toàn không làm đứng hình hay khựng hoạt họa xoay của bàn phím.

---

## 3. Tại sao chọn cách này (Trade-offs & So sánh)

| Giải pháp | Cách làm thông thường (Thô sơ) | Cách KeyCraft 3D triển khai (Hiện đại) | Lý do chọn |
| :--- | :--- | :--- | :--- |
| **Giao thức phản hồi AI** | Chờ toàn bộ JSON phản hồi (`await res.json()`). Người dùng nhìn vòng quay loading 3–5 giây. | **Server-Sent Events (SSE)** truyền từng từ (`text-delta`) và từng tool call qua `ReadableStream`. | Giảm Time to First Token (TTFT) xuống dưới 300ms, giao diện phản hồi tức thì. |
| **Điều khiển giao diện (UI Control)** | AI chỉ in ra dòng chữ hướng dẫn: *"Bạn hãy tự bấm nút đổi plate sang POM ở cột bên trái"*. | **Agentic UI Tool Calling:** AI trực tiếp phát lệnh `updateKeyboardConfig` để tự động đổi màu, đổi layout và vật liệu. | Đạt trải nghiệm sản phẩm cao cấp (MotionSites / Apple-like), loại bỏ thao tác thủ công. |
| **Vị trí hiển thị Panel** | Modal pop-up to đùng nổi đè lên chính giữa màn hình, che khuất hoàn toàn mô hình 3D. | **Tích hợp thành Tab thứ 3 trong Sidebar** kết hợp nút nhảy nhanh trên thanh công cụ sân khấu 3D. | Đúng chuẩn Taste Skill: Người dùng vừa chat ở bên trái, vừa nhìn thấy bàn phím 3D bên phải biến đổi thời gian thực. |
| **Khi chưa có API Key** | App sập hoặc báo lỗi đỏ lòm, người dùng không thể trải nghiệm thử bất kỳ tính năng nào. | **Tự động bắt lỗi 401 & cung cấp nút Chạy Thử Demo 3D** (Set Thock, Set Clack, Tách lớp). | Chuẩn UX Production: Luôn có phương án dự phòng (Graceful Degradation) để người dùng hoặc nhà tuyển dụng trải nghiệm ngay lập tức. |

---

## 4. Thử thách Tự tay sửa Code (5 Phút)

Để hiểu sâu cơ chế hoạt động của Agentic UI và sóng âm, bạn hãy mở code và tự tay thử 2 bài tập sau:

### Thử thách 1: Thêm một câu hỏi gợi ý nhanh (Quick Suggestion Chip)
* **File:** `src/components/ui/AIChatPanel.tsx`
* **Vị trí:** Khoảng dòng 10–35 (mảng `PROMPT_SUGGESTIONS`).
* **Hành động:** Thêm một gợi ý mới về phong cách bàn phím Cyberpunk:
  ```typescript
  {
    id: 'cyberpunk',
    label: 'Phong cách Cyberpunk neon',
    prompt: 'Hãy cấu hình bàn phím vỏ nhôm màu đen, keycap xanh neon và bật đèn gầm underglow màu cyan sáng tối đa.',
  },
  ```
* **Kết quả:** Mở tab "Trợ lý AI", bạn sẽ thấy nút chip mới xuất hiện. Khi nhấn vào, AI sẽ tự động kích hoạt LED gầm và chuyển màu case ngay lập tức!

### Thử thách 2: Thay đổi số lượng thanh dải tần số của Acoustic Waveform
* **File:** `src/components/ui/AcousticWaveform.tsx`
* **Vị trí:** Khoảng dòng 23 (mảng `bars`).
* **Hành động:** Thêm 4 thông số nữa vào mảng để nâng dải sóng âm từ 12 thanh lên 16 thanh:
  ```typescript
  const bars = [
    0.28, 0.45, 0.72, 0.95, 0.65, 0.88, 1.0, 0.78, 0.55, 0.82, 0.48, 0.32,
    0.6, 0.85, 0.5, 0.3
  ].map(...)
  ```
* **Kết quả:** Dải sóng âm sẽ dày đặc và tinh xảo hơn như một bảng điều khiển mixer âm thanh phòng thu chuyên nghiệp.

---

## 5. 3 Câu hỏi Phỏng vấn Thực chiến

### Câu hỏi 1: Tại sao lại chọn Server-Sent Events (SSE) thay vì WebSocket cho bài toán AI Streaming và Tool Calling?
> **Đáp án ghi điểm:**  
> "WebSocket là giao thức song công (full-duplex) 2 chiều cần duy trì stateful TCP connection liên tục, đòi hỏi hạ tầng server phức tạp và khó scale với mô hình Serverless/Edge Computing của Next.js.  
> Trong khi đó, tương tác với LLM có tính chất **Request-Response bất đối xứng**: Client chỉ gửi prompt một lần, sau đó Server đẩy một chuỗi tokens và tool calls kéo dài về cho Client. SSE chạy trên giao thức HTTP tiêu chuẩn (HTTP/1.1 hoặc HTTP/2 multiplexing), tương thích hoàn hảo với Serverless functions, tự động đi qua các tường lửa/CDN và tốn ít tài nguyên hơn rất nhiều. Vì vậy, SSE là sự lựa chọn tối ưu về mặt kiến trúc cho các ứng dụng AI Agent hiện đại."

---

### Câu hỏi 2: Trong quá trình stream SSE, nếu một chunk dữ liệu bị cắt đôi do mạng (Packet Fragmentation), làm thế nào để tránh lỗi `JSON.parse` crash ứng dụng?
> **Đáp án ghi điểm:**  
> "Ta sử dụng kỹ thuật **Line Buffering & Remainder Accumulation**. Khi nhận mỗi chunk nhị phân từ `reader.read()`, ta decode sang chuỗi và cộng dồn vào biến `buffer`.  
> Sau đó, ta tách buffer theo ký tự xuống dòng (`buffer.split('\n')`). Phần tử cuối cùng của mảng (`lines.pop()`) chưa chắc đã kết thúc bằng `\n` nên có thể là một đoạn JSON bị đứt đoạn. Ta giữ lại phần này làm `remainder` cho lần lặp kế tiếp và chỉ chạy `JSON.parse` trên các dòng hoàn chỉnh bắt đầu bằng `data:`. Nhờ đó, ứng dụng hoạt động bền bỉ 100% trước hiện tượng phân mảnh gói tin mạng."

---

### Câu hỏi 3: Hãy giải thích cách bạn kiến trúc luồng dữ liệu 2 chiều giữa AI Tool Calling và 3D Canvas mà không gây re-render toàn bộ cây component React?
> **Đáp án ghi điểm:**  
> "Tôi sử dụng **Zustand làm single source of truth** và tách biệt rõ hai cơ chế cập nhật:
> 1. Khi AI stream sự kiện `tool-input-available`, hàm `applyToolToStore` gọi trực tiếp `useKeyboardStore.getState().applyAIConfig(input)` ngoài vòng đời render của React (không dùng state trung gian).
> 2. Phía 3D Canvas, `KeyboardModel` và `KeyboardScene` đăng ký lắng nghe (subscribe) có chọn lọc thông qua các Atomic Selectors (ví dụ: `s => s.plateMaterial`, `s => s.caseColor`).
> 3. Với các hoạt họa như tách lớp (`isExploded`), vị trí các linh kiện được nội suy mượt mà qua `useFrame` và `THREE.MathUtils.lerp` bằng cách đột biến trực tiếp matrix của Three.js Object3D thông qua Ref, hoàn toàn không kích hoạt React reconciliation, đảm bảo 3D Canvas luôn duy trì 60–120 FPS mượt mà."
