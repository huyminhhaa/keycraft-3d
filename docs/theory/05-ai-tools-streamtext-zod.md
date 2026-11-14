# 05. AI Agentic UI: Vercel AI SDK, Tool Calling & Zod Schema Validation

> **Chủ đề:** Tích hợp bộ não trí tuệ nhân tạo (Google Gemini) vào ứng dụng 3D thông qua Vercel AI SDK, xây dựng hệ thống Tool Calling (Function Calling) và lá chắn kiểm duyệt dữ liệu nghiêm ngặt bằng Zod.  
> **Mục tiêu:** Hiểu sâu bản chất cơ chế Tool Calling của LLM, cách AI có thể trực tiếp điều khiển không gian đồ họa 3D, và nắm vững lý thuyết, ưu/nhược điểm của từng công nghệ vừa được áp dụng.

---

## 1. Bách khoa toàn thư công nghệ (Technology Deep-Dive)

### 1.1. Vercel AI SDK (`ai`)
- **Định nghĩa lý thuyết:**  
  Vercel AI SDK là một bộ thư viện mã nguồn mở chuyên sâu (Typescript-first) được thiết kế để chuẩn hóa việc kết nối, tương tác và truyền dữ liệu thời gian thực (Streaming) giữa các ứng dụng Web hiện đại và các mô hình ngôn ngữ lớn (LLMs) từ nhiều nhà cung cấp khác nhau (Google, OpenAI, Anthropic, Mistral...).
- **Tác dụng trong dự án KeyCraft 3D:**  
  Đóng vai trò là cầu nối giao tiếp cốt lõi: Tiếp nhận tin nhắn người dùng, nạp System Prompt của chuyên gia âm học, cấu hình công cụ điều khiển 3D (`tools`) và truyền luồng phản hồi tức thì (Streaming response) về giao diện mà không cần chờ toàn bộ câu trả lời sinh xong.
- **Cách sử dụng chuẩn:**
  ```typescript
  import { streamText, tool, stepCountIs } from 'ai';

  const result = streamText({
    model: google('gemini-2.0-flash'),
    system: '...',
    messages,
    tools: { ... },
    stopWhen: stepCountIs(5), // Cho phép vòng lặp đa bước suy luận
  });
  return result.toUIMessageStreamResponse();
  ```
- **Điểm mạnh (Pros):**  
  - Chuẩn hóa API: Đổi mô hình từ Gemini sang Claude hay GPT chỉ mất đúng 1 dòng code.  
  - Tích hợp sẵn cơ chế Tool Calling tự động thực thi hàm `execute`.  
  - Hỗ trợ mô hình suy luận đa bước (Multi-step Agent Loop: AI gọi tool $\rightarrow$ nhận kết quả $\rightarrow$ gọi tiếp tool khác hoặc stream kết luận).  
  - Quản lý Streaming mượt mà không gây tắc nghẽn giao diện người dùng.
- **Điểm yếu / Hạn chế (Cons):**  
  - Thư viện phát triển rất nhanh, các phiên bản lớn thường có breaking changes về tên thuộc tính (ví dụ từ `parameters` sang `inputSchema`, từ `maxSteps` sang `stopWhen: stepCountIs()`).

---

### 1.2. Google Generative AI Provider (`@ai-sdk/google`)
- **Định nghĩa lý thuyết:**  
  Đây là package adapter chính thức cung cấp driver kết nối chuyên biệt giữa Vercel AI SDK và các mô hình thế hệ mới của Google (như Gemini 1.5 Flash, Gemini 2.0 Flash/Pro).
- **Tác dụng trong dự án KeyCraft 3D:**  
  Cung cấp "bộ não" tính toán ngôn ngữ tự nhiên: Phân tích gu thẩm mỹ và yêu cầu âm thanh phức tạp của người dùng (ví dụ: *"Tôi muốn một bộ phím gõ êm vào ban đêm nhưng âm phải trầm đầm"*), sau đó đối chiếu kiến thức âm học và quyết định tham số phần cứng chính xác.
- **Cách sử dụng chuẩn:**
  ```typescript
  import { createGoogleGenerativeAI } from '@ai-sdk/google';

  const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });
  const model = google('gemini-2.0-flash');
  ```
- **Điểm mạnh (Pros):**  
  - Tốc độ sinh token (Time to First Token - TTFT) cực kỳ nhanh, gần như tức thì.  
  - Ngữ cảnh cửa sổ cực lớn (hỗ trợ hàng triệu tokens).  
  - Hỗ trợ Native Function Calling với độ chính xác cao.  
  - Có hạn mức miễn phí (Free Tier) rất rộng rãi trên Google AI Studio.
- **Điểm yếu / Hạn chế (Cons):**  
  - Cần tài khoản Google Cloud hoặc Google AI Studio để lấy API Key.  
  - Khi sử dụng hạn mức miễn phí có thể bị áp giới hạn số lượt gọi mỗi phút (Rate limits: 15 RPM).

---

### 1.3. Zod (`zod`)
- **Định nghĩa lý thuyết:**  
  Zod là thư viện khai báo cấu trúc dữ liệu (Schema Declaration) và thẩm định kiểu dữ liệu thời gian thực (Runtime Type Validation) số 1 trong hệ sinh thái TypeScript.
- **Tác dụng trong dự án KeyCraft 3D:**  
  Đóng vai trò là **"Lá chắn thép bảo vệ Studio 3D"**: Khi AI quyết định thay đổi màu sắc hay linh kiện, Zod sẽ kiểm tra tính hợp lệ của tham số do AI sinh ra (màu có đúng mã HEX `#RGB` không? layout có nằm trong danh sách `65% | 75% | TKL` không? độ sáng đèn gầm có vượt quá `1.0` không?). Nếu AI sinh sai tham số, Zod sẽ chặn đứng ngay lập tức để không làm vỡ giao diện 3D.
- **Cách sử dụng chuẩn:**
  ```typescript
  import { z } from 'zod';

  export const updateKeyboardConfigSchema = z.object({
    layout: z.enum(['65%', '75%', 'TKL']).optional(),
    caseColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
    underglowBrightness: z.number().min(0).max(1).optional(),
  });

  // Tự động suy luận kiểu dữ liệu tĩnh TypeScript
  export type UpdateKeyboardConfigInput = z.infer<typeof updateKeyboardConfigSchema>;
  ```
- **Điểm mạnh (Pros):**  
  - Không trùng lặp code: Khai báo schema một lần, tự động suy luận ra kiểu TypeScript tương ứng (`z.infer<T>`).  
  - Thẩm định ở thời điểm chạy (Runtime Validation): Bắt lỗi dữ liệu từ API hoặc AI bên ngoài mà TypeScript thuần không thể bắt được khi đã compile thành JavaScript.  
  - Cung cấp thông báo lỗi tiếng Việt dễ hiểu và chi tiết cho từng trường dữ liệu.
- **Điểm yếu / Hạn chế (Cons):**  
  - Chiếm thêm dung lượng bundle (~12KB gzipped) - tuy nhiên hoàn toàn xứng đáng với độ an toàn mà nó mang lại.

---

## 2. Bản chất hoạt động (Under the hood)

### 2.1. Vòng lặp Agentic Multi-Step Tool Calling
Khái niệm **Agentic UI** nghĩa là giao diện người dùng có thể được điều khiển tự động bởi một AI Agent.  
Dưới đây là hành trình của một tin nhắn từ khi người dùng gõ phím cho đến khi mô hình 3D biến đổi:

```
[ Người dùng chat ]
"Hãy làm cho bàn phím của tôi có âm Deep Thock, đổi case sang màu tím Cyber và bung lớp cho tôi xem"
                         |
                         v POST /api/chat
+-------------------------------------------------------------------------------+
| Next.js API Route (src/app/api/chat/route.ts)                                 |
| 1. Kiểm tra GOOGLE_GENERATIVE_AI_API_KEY trong .env.local                     |
| 2. Nạp KEYBOARD_ARCHITECT_SYSTEM_PROMPT                                       |
| 3. Chuyển đổi Zod Schemas thành chuẩn JSON Schema gửi cho Gemini               |
+----------------------------------------+--------------------------------------+
                                         |
                                         v
+-------------------------------------------------------------------------------+
| Mô Hình Google Gemini 2.0 Flash                                               |
| - Đọc hiểu ngữ cảnh âm học: "Deep Thock" => cần Plate POM, Switch Linear      |
| - Nhận thấy người dùng yêu cầu hành động => CẦN GỌI TOOL                      |
| - Phản hồi gói lệnh:                                                          |
|   {                                                                           |
|     toolName: "updateKeyboardConfig",                                         |
|     args: { plateMaterial: "pom", switchType: "linear", caseColor: "#3b0764" }|
|   }                                                                           |
|   {                                                                           |
|     toolName: "toggleExplodedView",                                           |
|     args: { isExploded: true, explosionOffset: 2.0 }                          |
|   }                                                                           |
+----------------------------------------+--------------------------------------+
                                         |
                                         v
+-------------------------------------------------------------------------------+
| AI SDK Execution Engine (Tại Server)                                          |
| - Zod thẩm định args: Hợp lệ 100%                                             |
| - Gọi hàm execute() của từng tool => Trả kết quả về cho Gemini                |
| - Gemini tiếp tục stream câu trả lời giải thích bằng lời cho người dùng       |
+----------------------------------------+--------------------------------------+
                                         |
                                         v (Gói dữ liệu Data Stream trả về Client)
+-------------------------------------------------------------------------------+
| Trình duyệt Người Dùng (Zustand Store)                                        |
| - Đọc kết quả tool call => Gọi store.applyAIConfig(...)                       |
| - 3D Canvas lập tức đổi màu tím, plate POM và bung lớp 7 linh kiện ở 60 FPS! |
+-------------------------------------------------------------------------------+
```

---

## 3. Tại sao chọn cách này (Trade-offs & Decisions)

| Hướng tiếp cận | Giải pháp trong KeyCraft 3D | Hướng làm thông thường | Lý do & Đánh đổi |
| :--- | :--- | :--- | :--- |
| **Giao tiếp với AI** | **Structured Tool Calling** | Chatbot trả lời văn bản thông thường | **Tool Calling:** Biến AI thành một kỹ sư thực thi thật sự. Thay vì bảo người dùng *"Bạn hãy tự bấm vào tab màu và chọn mã tím"*, AI tự động gửi lệnh chỉnh sửa Canvas 3D cho người dùng. |
| **Bảo vệ dữ liệu** | **Zod Schema Validation** | Viết các hàm `if / else` thủ công | **Zod:** Tự động validate kiểu số, chuỗi, biểu thức chính quy (Regex) và enum chỉ với vài dòng code, đồng thời xuất ngược ra JSON Schema tiêu chuẩn để LLM hiểu được mà không cần viết prompt mô tả dài dòng. |
| **Kiến trúc luồng Stream** | **`toUIMessageStreamResponse`** | Chờ toàn bộ văn bản rồi trả về một cục JSON | **Streaming:** Trả về từng mảnh chữ (chunk) và trạng thái tool theo thời gian thực, người dùng nhìn thấy AI gõ chữ ngay sau 200ms thay vì phải nhìn màn hình loading 4–5 giây. |

---

## 4. Thử thách tự tay sửa code (5 phút)

Hãy trải nghiệm việc mở rộng năng lực của AI Agent:

### Thử thách 1: Bổ sung thêm một hồ sơ âm thanh mới cho AI
1. Mở file [`src/lib/ai/keyboardTools.ts`](file:///d:/Projects/keycraft-3d/src/lib/ai/keyboardTools.ts#L108).
2. Tại `getAcousticRecommendationSchema`, thêm kiểu âm `'clacky_marbly'` (âm đá cuội cộc cộc đặc trưng):
   ```typescript
   export const getAcousticRecommendationSchema = z.object({
     targetProfile: z
       .enum(['thock', 'deep_thock', 'clack', 'creamy', 'silent', 'clacky_marbly'])
   ```
3. Trong hàm `execute` của tool này, thêm nhánh xử lý:
   ```typescript
   case 'clacky_marbly':
     return {
       plate: 'aluminum',
       switchType: 'linear',
       foam: 'Poron đáy kết hợp tape mod',
       explanation: 'Plate nhôm kết hợp switch linear âm cao tạo tiếng va đập giòn tan tựa như tiếng những viên đá cẩm thạch va vào nhau.',
     };
   ```
4. Chạy `npm test -- --run` và quan sát xem toàn bộ test case có vượt qua không.

### Thử thách 2: Cố tình nhập mã màu sai định dạng để quan sát Zod bắt lỗi
1. Mở file [`src/lib/ai/keyboardTools.test.ts`](file:///d:/Projects/keycraft-3d/src/lib/ai/keyboardTools.test.ts#L43).
2. Thử truyền `caseColor: 'mau-xanh-la'` vào schema.
3. Chạy `npm test -- --run` để thấy Zod lập tức bắt lỗi: `"Mã màu Case phải là mã HEX hợp lệ (ví dụ: #0f172a)"`.

---

## 5. Ba câu hỏi phỏng vấn thực chiến (Interview Q&A)

### Câu hỏi 1: Sự khác biệt cơ bản giữa "Function Calling / Tool Calling" và việc ép LLM trả về JSON thuần túy (JSON Mode) là gì?
> **Đáp án:**  
> - **JSON Mode:** Chỉ đơn thuần yêu cầu LLM định dạng câu trả lời bằng cú pháp JSON hợp lệ. LLM vẫn phải tự suy nghĩ và có thể bị ảo giác (hallucination) cấu trúc key/value. Phía ứng dụng phải tự viết code `JSON.parse` và tự xử lý ngoại lệ nếu JSON bị vỡ.  
> - **Tool Calling:** Được hỗ trợ từ tầng sâu của mô hình (Native Provider API). Schema công cụ được dịch thành hàm định nghĩa mà LLM được huấn luyện chuyên biệt để gọi. LLM có thể quyết định **khi nào cần gọi tool**, **khi nào không cần gọi** (chỉ trả lời hội thoại thông thường), hoặc **gọi liên tiếp nhiều tools** theo trình tự logic trước khi đưa ra câu trả lời cuối cùng.

---

### Câu hỏi 2: Tại sao tham số `stopWhen: stepCountIs(5)` (hoặc `maxSteps`) lại cực kỳ quan trọng trong các ứng dụng AI Agent?
> **Đáp án:**  
> Khi mô hình gọi một Tool (ví dụ: `getAcousticRecommendation`), hàm `execute` ở server sẽ chạy và trả kết quả về cho LLM. Để mô hình có thể đọc kết quả đó rồi tiếp tục gọi thêm tool thứ 2 (`updateKeyboardConfig`) và cuối cùng giải thích cho người dùng, hệ thống cần cho phép **nhiều vòng lặp bước (Multi-step loop)**.  
> Tuy nhiên, nếu không đặt giới hạn dừng (`stepCountIs`), mô hình có thể rơi vào **vòng lặp vô tận (Infinite Tool Loop)** khi gặp lỗi hoặc không tìm thấy điểm dừng, dẫn đến cạn kiệt token và treo server. Giá trị 5 là ngưỡng tối ưu cho các luồng tư vấn kiến trúc phần cứng.

---

### Câu hỏi 3: Trong môi trường Production với hàng ngàn người dùng đồng thời, làm thế nào để bảo vệ API route `/api/chat` khỏi bị lạm dụng hoặc làm cạn hạn mức API của Google Gemini?
> **Đáp án:**  
> Có 3 giải pháp kiến trúc phối hợp:
> 1. **Rate Limiting bằng Redis:** Áp dụng thuật toán Sliding Window Counter lưu trong Redis dựa trên địa chỉ IP hoặc User ID (ví dụ: tối đa 10 lượt gọi mỗi phút).
> 2. **Authentication Guard:** Yêu cầu người dùng phải đăng nhập (Session JWT) trước khi được sử dụng tính năng AI Architect.
> 3. **Input Length Throttling & Caching:** Giới hạn độ dài mảng tin nhắn gửi lên (ví dụ: chỉ giữ lại 10 tin nhắn gần nhất) và lưu bộ đệm (Cache) các câu hỏi tư vấn phổ biến vào Redis để trả về ngay lập tức mà không cần gọi lại LLM.
