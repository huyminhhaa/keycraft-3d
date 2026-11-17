import { describe, it, expect } from 'vitest';
import {
  searchHardwareComponents,
  searchInMemoryCatalog,
} from './semanticSearch';
import { generateDeterministicEmbedding } from './embedding';

describe('Semantic Search RAG (src/lib/ai/semanticSearch.ts)', () => {
  it('tìm kiếm switch cho âm Thock trầm sâu gợi ý đúng Gateron Oil King hoặc POM Plate', async () => {
    const results = await searchHardwareComponents({
      query: 'switch âm trầm thock sâu ấm áp',
      type: 'switch',
      limit: 3,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(3);

    // Kết quả tìm kiếm switch phải có Gateron Oil King hoặc Milky Yellow
    const names = results.map((r) => r.name);
    const hasThockySwitch = names.some(
      (name) => name.includes('Oil King') || name.includes('Milky Yellow')
    );
    expect(hasThockySwitch).toBe(true);

    // Mọi kết quả đều phải có type là switch
    results.forEach((r) => {
      expect(r.type).toBe('switch');
      expect(r.similarity).toBeGreaterThan(0);
    });
  });

  it('tìm kiếm plate cho âm Clack đanh giòn gợi ý đúng Aluminum Plate', async () => {
    const results = await searchHardwareComponents({
      query: 'plate kim loại clack giòn nảy sáng rõ',
      type: 'plate',
      limit: 2,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('plate');
    expect(results[0].name).toContain('Aluminum');
  });

  it('tìm kiếm switch êm ái văn phòng gợi ý switch Silent', async () => {
    const results = await searchHardwareComponents({
      query: 'switch êm không ồn làm việc ban đêm văn phòng',
      type: 'switch',
      limit: 3,
    });

    expect(results.length).toBeGreaterThan(0);
    const hasSilentSwitch = results.some(
      (r) => r.name.includes('Silent') || r.acousticDescription.includes('êm ái')
    );
    expect(hasSilentSwitch).toBe(true);
  });

  it('lọc linh kiện theo type: foam trả về đúng các lớp foam tiêu âm', async () => {
    const results = await searchHardwareComponents({
      query: 'foam tiêu âm buồng rỗng',
      type: 'foam',
      limit: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => {
      expect(r.type).toBe('foam');
    });
  });

  it('searchInMemoryCatalog giới hạn đúng số lượng limit và sắp xếp theo similarity giảm dần', () => {
    const query = 'tactile bump khấc nảy pop';
    const queryVec = generateDeterministicEmbedding(query);

    const results = searchInMemoryCatalog(query, queryVec, 'all', 4);

    expect(results.length).toBe(4);
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].similarity).toBeGreaterThanOrEqual(results[i + 1].similarity);
    }
  });
});
