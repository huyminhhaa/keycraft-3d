# Bách Khoa Toàn Thư pgvector & RAG: Tìm Kiếm Ngữ Nghĩa Âm Học Bàn Phím Cơ & Vector Embedding 768 Chiều

> **Mã tài liệu:** `15-pgvector-rag-acoustic-catalog`  
> **Dự án:** KeyCraft 3D — Custom Mechanical Keyboard Studio  
> **Thuộc chặng:** Chặng 3: Dữ Liệu Lớn, Vector Search & Kiến Trúc Sản Phẩm Thực Tế (Task 3.2)  
> **Trình độ:** Từ số 0 đến Kỹ sư AI & Database (AI & Database Engineer)

---

## 1. Bách Khoa Công Nghệ Sử Dụng Trong Task

### 1.1. `pgvector` & Vector Distance Operators (`<=>`, `<->`) trong PostgreSQL 17
- **Định nghĩa:** `pgvector` là một tiện ích mở rộng (extension) mã nguồn mở của PostgreSQL, cho phép lưu trữ trực tiếp các vector nhiều chiều (Vector Embeddings) và thực hiện các phép tìm kiếm láng giềng gần nhất (k-Nearest Neighbors - kNN) siêu tốc bằng các chỉ mục HNSW (Hierarchical Navigable Small World) hoặc IVFFlat.
- **Tác dụng trong KeyCraft 3D:** Lưu trữ các vector 768 chiều biểu diễn đặc tính âm học (âm Thock, Clack, Creamy, Pop, Silent) của từng loại switch (Oil King, Boba U4T, MX Black...) và plate (POM, FR4, Nhôm...).
- **Toán tử khoảng cách trong pgvector:**
  - `<=>` (Cosine Distance): Tính theo góc giữa 2 vector ($1 - \cos(\theta)$), phản ánh độ tương đồng về mặt ý nghĩa ngữ nghĩa (Semantic Similarity), không phụ thuộc vào độ dài văn bản. Đây là toán tử tối ưu nhất cho bài toán RAG.
  - `<->` (L2 / Euclidean Distance): Khoảng cách hình học Euclid giữa 2 điểm.
  - `<#>` (Negative Inner Product): Tích vô hướng đổi dấu (dùng khi vector đã được chuẩn hóa).
- **Cách sử dụng (Syntax chuẩn trong SQL & Drizzle ORM):**
  ```sql
  -- Kích hoạt extension
  CREATE EXTENSION IF NOT EXISTS vector;

  -- Tạo bảng với cột vector 768 chiều (khớp với Google Gemini text-embedding-004)
  CREATE TABLE hardware_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    acoustic_description TEXT,
    embedding VECTOR(768)
  );

  -- Truy vấn top 3 linh kiện tương đồng ngữ nghĩa nhất với câu hỏi
  SELECT name, 1 - (embedding <=> '[0.012, -0.045, ...]'::vector) AS similarity
  FROM hardware_components
  ORDER BY embedding <=> '[0.012, -0.045, ...]'::vector ASC
  LIMIT 3;
  ```
- **Điểm mạnh (Pros):**
  - **Tất cả trong một (All-in-one Database):** Không cần cài thêm cơ sở dữ liệu vector rời như Pinecone, Weaviate hay Milvus. Dữ liệu quan hệ người dùng (Users), bản build (Builds) và vector embeddings nằm chung trong cùng 1 cụm PostgreSQL, đảm bảo tính toàn vẹn giao dịch (ACID).
  - Tốc độ truy vấn dưới 10ms khi đánh chỉ mục HNSW.
- **Hạn chế (Cons):**
  - Đòi hỏi PostgreSQL container phải cài sẵn extension `pgvector` (sử dụng image `pgvector/pgvector:pg17`).

---

### 1.2. `Vector Embedding 768 Chiều` & Mô Hình `text-embedding-004`
- **Định nghĩa:** Vector Embedding là quá trình biến đổi một đoạn văn bản tự nhiên (như *"Switch gõ trầm đầm tiếng thock ấm"*) thành một chuỗi gồm 768 con số thực liên tục ($\mathbf{v} \in \mathbb{R}^{768}$). Các đoạn văn bản có ý nghĩa gần nhau sẽ có các vector nằm sát nhau trong không gian hình học 768 chiều.
- **Tác dụng:** Giúp máy tính hiểu được rằng:
  - *"Switch linear gõ thock ấm"* cực kỳ tương đồng với *"Gateron Oil King"* hay *"Plate POM"*.
  - Dù hai câu không hề trùng khớp chính xác từng từ khóa (Exact Keyword Match), hệ thống vẫn tìm thấy đúng linh kiện người dùng cần.
- **Cách sử dụng (Syntax Vercel AI SDK):**
  ```typescript
  import { createGoogleGenerativeAI } from '@ai-sdk/google';
  import { embed } from 'ai';

  const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });

  const { embedding } = await embed({
    model: google.textEmbeddingModel('text-embedding-004'),
    value: 'Switch gõ thock trầm ấm cho bàn phím cơ',
  });
  // embedding là mảng number[] gồm đúng 768 phần tử
  ```
- **Cơ chế Fallback thông minh (Deterministic Pseudo-Embedding):**
  - Khi chạy unit test hoặc khi máy tính chưa bật Docker / thiếu Internet, hệ thống tự động chuyển sang giải thuật n-gram hash với chuẩn L2 = 1.0 ($\|\mathbf{v}\|_2 = 1.0$).
  - Đảm bảo 100% test cases luôn pass xanh mà không phụ thuộc vào kết nối mạng bên ngoài.

---

### 1.3. `RAG (Retrieval-Augmented Generation)` Cho Chuyên Gia AI Âm Học
- **Định nghĩa:** RAG là kỹ thuật "mở rộng tri thức" cho mô hình ngôn ngữ lớn (LLM). Thay vì để AI "tự bịa" (Hallucination) thông số switch hoặc giá trị vật lý, hệ thống sẽ:
  1. **Retrieve (Truy xuất):** Lấy câu hỏi người dùng đi tìm kiếm trong cơ sở dữ liệu `hardware_components`.
  2. **Augment (Bổ sung):** Nhồi các thông số kỹ thuật thực tế tìm được (lực nhấn, chất liệu vỏ nylon/POM, độ dày plate) vào ngữ cảnh của AI.
  3. **Generate (Sinh câu trả lời):** AI dựa trên sự thật (Ground truth) để tư vấn và kích hoạt công cụ 3D Studio.
- **Điểm mạnh (Pros):**
  - Thông tin tư vấn luôn chính xác 100% với thế giới thực.
  - Dễ dàng cập nhật linh kiện mới mà không cần train lại AI: chỉ cần thêm dòng vào database!

---

## 2. Bản Chất Hoạt Động (Under The Hood)

### Sơ Đồ Luồng Dữ Liệu RAG Semantic Search & Tool Calling

```text
[ Người Dùng Chat ] "Tư vấn cho mình switch nào gõ thock trầm ấm làm việc ban đêm"
        │
        ▼
[ API Route: /api/chat ]
        │
        ▼
[ Gemini 2.0 Flash ] Phân tích ý định người dùng -> Nhận diện cần tra cứu tri thức
        │
        ▼ Kích hoạt Tool: searchHardwareKnowledge({ query: "switch thock trầm ấm ban đêm" })
[ src/lib/ai/semanticSearch.ts ]
        │
        ├── 1. Sinh vector 768d của câu query qua generateEmbedding()
        │
        ├── 2. Kiểm tra Database PostgreSQL (pgvector):
        │      ├── Nếu Database online -> Thực thi:
        │      │   SELECT * FROM hardware_components ORDER BY embedding <=> queryVec ASC LIMIT 4;
        │      └── Nếu Database offline -> Tự động fallback:
        │          Tính Cosine Similarity với HARDWARE_CATALOG trong bộ nhớ (<1ms)
        │
        ▼ Trả về danh sách linh kiện thực tế:
          1. Gateron Oil King (Linear, Deep Thock, 55g) - Similarity: 0.89
          2. POM Plate 1.5mm (Âm trầm sâu) - Similarity: 0.84
          3. Gazzew Boba U4 Silent (62g, êm ái) - Similarity: 0.81
        │
        ▼
[ Gemini 2.0 Flash ]
        ├── Tổng hợp câu trả lời chi tiết gửi người dùng
        └── Kích hoạt tiếp tool updateKeyboardConfig({ plateMaterial: 'pom', switchType: 'linear' })
            └── Đồng bộ trực tiếp cấu hình 3D lên màn hình người dùng!
```

---

## 3. Tại Sao Chọn Cách Này (Trade-offs)

| Tiêu Chí | Tìm Kiếm Từ Khóa Truyền Thống (Full-text / ILIKE) | Tìm Kiếm Ngữ Nghĩa Vector (pgvector RAG) |
| :--- | :--- | :--- |
| **Độ thông minh** | Bắt buộc người dùng phải gõ đúng chữ (ví dụ: gõ "Oil King" mới ra Oil King). Nếu gõ "âm trầm như tiếng gõ gỗ" thì kết quả rỗng (0 kết quả). | Hiểu được ngữ cảnh và sắc thái âm thanh ("trầm ấm", "đầm đặc", "êm tai") và khớp với mô tả vật lý của switch tương ứng. |
| **Kiến trúc hạ tầng** | Phải dựng riêng Elasticsearch hoặc Solr phức tạp. | Tận dụng ngay chính PostgreSQL 17 đang có sẵn trong `docker-compose.yml` qua extension `vector`. |
| **Độ tin cậy của AI** | AI dễ bị ảo giác (chém gió thông số switch không có thật trên thị trường). | AI được "neo" vào cơ sở dữ liệu linh kiện thật có mã hàng, lực nhấn và âm sắc chuẩn xác. |
| **Khả năng chạy Offline** | Database sập thì tính năng tìm kiếm gãy hoàn toàn. | KeyCraft 3D có lớp **In-memory Vector Fallback**, database chưa bật app vẫn chạy trơn tru 100%. |

---

## 4. Thử Thách Tự Tay Sửa Code (5 Phút)

### Thử thách 1: Bổ sung thêm một loại switch mới vào cơ sở tri thức
- **Mục tiêu:** Thêm switch quốc dân **"JWK Black V2"** vào danh mục linh kiện để AI có thể tự động nhận biết và tư vấn.
- **Vị trí file:** `src/lib/ai/hardwareCatalog.ts`
- **Cách làm:** Thêm đối tượng sau vào mảng `HARDWARE_CATALOG`:
  ```typescript
  {
    id: 'switch-jwk-black-v2',
    type: 'switch',
    name: 'JWK Black V2',
    material: 'Polycarbonate Top / Nylon Bottom / POM Stem',
    acousticDescription:
      'Switch linear clacky với âm gõ đanh giòn, dứt khoát. Chất âm sáng và nảy, cực kỳ thích hợp cho người thích gõ nhanh.',
    soundProfile: {
      pitchMultiplier: 1.2,
      damping: 0.7,
      resonance: 1.25,
      label: 'Crisp Clack',
    },
    specs: {
      switchType: 'linear',
      actuationForce: 58.5,
      bottomOutForce: 63.5,
      soundSignature: 'clack',
    },
  },
  ```
- **Kết quả:** Chạy `npx vitest run src/lib/ai/semanticSearch.test.ts` sẽ thấy hệ thống tự động lập chỉ mục và tìm được switch mới này khi hỏi về âm "clack đanh giòn"!

---

## 5. Ba Câu Hỏi Phỏng Vấn Thực Chiến

### Câu 1: Tại sao nên dùng toán tử Cosine Distance (`<=>`) thay vì L2 Distance (`<->`) khi tìm kiếm ngữ nghĩa văn bản với pgvector?
> **Đáp án:**  
> Vector embedding của văn bản thường được đánh giá dựa trên **hướng (direction)** trong không gian ngữ nghĩa chứ không phải **độ lớn (magnitude)** của vector.  
> Hai đoạn văn bản nói về cùng một chủ đề nhưng có độ dài khác nhau (một câu ngắn và một đoạn văn dài) sẽ có độ lớn vector khác nhau (L2 distance lớn), nhưng góc hợp giữa chúng lại rất nhỏ ($\cos(\theta) \approx 1$, do đó khoảng cách Cosine $1 - \cos(\theta) \approx 0$). Vì vậy, Cosine Distance phản ánh chính xác nhất độ tương đồng ý nghĩa ngữ nghĩa.

---

### Câu 2: Trong kiến trúc sản phẩm thật, giải pháp nào giúp hệ thống không bị treo hoặc sập khi cơ sở dữ liệu Vector Database (PostgreSQL / Pinecone) gặp sự cố mạng?
> **Đáp án:**  
> Áp dụng mô hình **Graceful Degradation (Suy giảm tính năng có kiểm soát)** kết hợp **In-memory Local Fallback**:  
> 1. Bọc truy vấn vector trong khối `try...catch` có timeout ngắn ($\le 2\text{s}$).  
> 2. Nếu kết nối database bị lỗi hoặc timeout, không ném lỗi 500 ra giao diện người dùng mà ghi log cảnh báo (`console.warn`).  
> 3. Tự động chuyển hướng truy vấn sang danh mục bản sao tĩnh (In-memory Static Catalog) đã được tính sẵn embedding cục bộ, sử dụng hàm tính `cosineSimilarity` trong RAM của Node.js. Người dùng vẫn nhận được câu trả lời chỉ trong vài mili-giây.

---

### Câu 3: Làm thế nào để tối ưu hóa hiệu năng truy vấn hàng triệu vector trong PostgreSQL với pgvector?
> **Đáp án:**  
> Mặc định pgvector thực hiện quét tuần tự (Exact Sequential Scan - KNN). Khi dữ liệu lớn, cần tạo chỉ mục xấp xỉ (Approximate Nearest Neighbor - ANN):  
> 1. **Chỉ mục HNSW (Hierarchical Navigable Small World):**
>    ```sql
>    CREATE INDEX ON hardware_components USING hnsw (embedding vector_cosine_ops)
>    WITH (m = 16, ef_construction = 64);
>    ```
>    Cho tốc độ truy vấn nhanh nhất và độ chính xác (recall) rất cao, phù hợp cho hệ thống thời gian thực.  
> 2. **Chỉ mục IVFFlat (Inverted File Flat):** Tốn ít bộ nhớ RAM hơn HNSW, phù hợp khi tài nguyên máy chủ hạn chế.
