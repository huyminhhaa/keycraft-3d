import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  generateDeterministicEmbedding,
  generateEmbedding,
  generateEmbeddings,
  EMBEDDING_DIMENSIONS,
} from './embedding';

describe('Embedding Utilities (src/lib/ai/embedding.ts)', () => {
  it('tính cosineSimilarity chuẩn xác giữa các vector', () => {
    const vecA = [1, 0, 0];
    const vecB = [1, 0, 0];
    const vecC = [0, 1, 0];
    const vecD = [-1, 0, 0];

    // Hai vector giống nhau hoàn toàn -> 1.0
    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0, 5);

    // Hai vector vuông góc (trực giao) -> 0.0
    expect(cosineSimilarity(vecA, vecC)).toBeCloseTo(0.0, 5);

    // Hai vector ngược hướng -> -1.0
    expect(cosineSimilarity(vecA, vecD)).toBeCloseTo(-1.0, 5);

    // Trường hợp biên: vector rỗng hoặc khác độ dài
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it('generateDeterministicEmbedding trả về vector 768 chiều chuẩn hóa L2 = 1.0', () => {
    const text = 'Gateron Oil King switch deep thock';
    const vec = generateDeterministicEmbedding(text);

    expect(vec).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(vec).toHaveLength(768);

    // Kiểm tra chuẩn L2 (tổng bình phương các phần tử = 1.0)
    const norm = vec.reduce((sum, val) => sum + val * val, 0);
    expect(norm).toBeCloseTo(1.0, 4);
  });

  it('generateDeterministicEmbedding có tính nhất quán (Deterministic)', () => {
    const text = 'POM Plate Thock âm trầm';
    const vec1 = generateDeterministicEmbedding(text);
    const vec2 = generateDeterministicEmbedding(text);

    expect(vec1).toEqual(vec2);
  });

  it('bắt được độ tương đồng ngữ nghĩa giữa các từ khóa âm học', () => {
    const vecThockQuery = generateDeterministicEmbedding('switch thock trầm sâu');
    const vecThockMatch = generateDeterministicEmbedding('gateron oil king deep thock trầm ấm');
    const vecClackDifferent = generateDeterministicEmbedding('plate nhôm clack giòn sáng');

    const simThock = cosineSimilarity(vecThockQuery, vecThockMatch);
    const simClack = cosineSimilarity(vecThockQuery, vecClackDifferent);

    // Cùng trường từ vựng "thock trầm" phải có độ tương đồng cao hơn rõ rệt
    expect(simThock).toBeGreaterThan(simClack);
  });

  it('generateEmbedding và generateEmbeddings hoạt động mượt mà trong môi trường test', async () => {
    const vec = await generateEmbedding('Boba U4T tactile');
    expect(vec).toHaveLength(768);

    const batch = await generateEmbeddings(['Switch Linear', 'Switch Clicky']);
    expect(batch).toHaveLength(2);
    expect(batch[0]).toHaveLength(768);
    expect(batch[1]).toHaveLength(768);
  });
});
