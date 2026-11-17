import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embed, embedMany } from 'ai';

export const EMBEDDING_DIMENSIONS = 768;

/**
 * Tính toán độ tương đồng Cosine giữa 2 vector cùng số chiều
 * Giá trị trả về từ -1.0 đến 1.0 (càng gần 1.0 càng tương đồng ngữ nghĩa)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Sinh vector embedding giả lập (Deterministic Pseudo-Embedding) 768 chiều
 * Sử dụng cho môi trường unit test hoặc khi offline / chưa cấu hình API key
 * Đảm bảo vector trả về luôn có chuẩn L2 = 1.0 (Unit vector)
 */
export function generateDeterministicEmbedding(text: string): number[] {
  const normalized = text.toLowerCase().trim();
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);

  // Phân tích từ và character n-grams (1-gram, 2-gram, 3-gram)
  const tokens = normalized.split(/\s+/).filter(Boolean);

  // 1. Phân phối trọng số theo từ
  for (const token of tokens) {
    let hash = 5381;
    for (let j = 0; j < token.length; j++) {
      hash = ((hash << 5) + hash) + token.charCodeAt(j);
      hash = hash & hash; // Convert to 32bit integer
    }

    const index = Math.abs(hash) % EMBEDDING_DIMENSIONS;
    vector[index] += 1.5;

    // Phân tán vào các chiều lân cận (harmonic smoothing)
    vector[(index + 13) % EMBEDDING_DIMENSIONS] += 0.8;
    vector[(index + 47) % EMBEDDING_DIMENSIONS] += 0.4;
  }

  // 2. Phân tích n-grams ký tự để bắt các biến thể âm học (thock, thocky, clack, clacky)
  for (let i = 0; i < normalized.length - 2; i++) {
    const gram = normalized.slice(i, i + 3);
    let gramHash = 0;
    for (let k = 0; k < gram.length; k++) {
      gramHash = (gramHash * 31 + gram.charCodeAt(k)) & 0xffffffff;
    }
    const idx = Math.abs(gramHash) % EMBEDDING_DIMENSIONS;
    vector[idx] += 0.5;
  }

  // 3. Chuẩn hóa L2-norm để vector có độ dài đúng bằng 1.0
  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    norm += vector[i] * vector[i];
  }

  if (norm === 0) {
    // Nếu chuỗi rỗng, trả về vector đơn vị tại index 0
    vector[0] = 1.0;
    return vector;
  }

  const sqrtNorm = Math.sqrt(norm);
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    vector[i] = vector[i] / sqrtNorm;
  }

  return vector;
}

/**
 * Sinh vector embedding 768 chiều cho một đoạn văn bản
 * Sử dụng mô hình Gemini text-embedding-004 nếu có API key, tự động fallback an toàn
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY;

  if (
    !apiKey ||
    apiKey === 'your_gemini_api_key_here' ||
    process.env.NODE_ENV === 'test'
  ) {
    return generateDeterministicEmbedding(text);
  }

  try {
    const google = createGoogleGenerativeAI({ apiKey });
    const { embedding } = await embed({
      model: google.textEmbeddingModel('text-embedding-004'),
      value: text,
    });

    return embedding;
  } catch (error) {
    console.warn('[EMBEDDING_FALLBACK]: Lỗi khi gọi Gemini text-embedding-004, chuyển sang deterministic embedding:', error);
    return generateDeterministicEmbedding(text);
  }
}

/**
 * Sinh vector embedding cho hàng loạt đoạn văn bản (Batch Embedding)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY;

  if (
    !apiKey ||
    apiKey === 'your_gemini_api_key_here' ||
    process.env.NODE_ENV === 'test'
  ) {
    return texts.map(generateDeterministicEmbedding);
  }

  try {
    const google = createGoogleGenerativeAI({ apiKey });
    const { embeddings } = await embedMany({
      model: google.textEmbeddingModel('text-embedding-004'),
      values: texts,
    });

    return embeddings;
  } catch (error) {
    console.warn('[EMBEDDING_BATCH_FALLBACK]: Lỗi batch embedding, chuyển sang fallback:', error);
    return texts.map(generateDeterministicEmbedding);
  }
}
