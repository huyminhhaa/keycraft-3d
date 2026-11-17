import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { hardwareComponents } from '@/db/schema';
import { HARDWARE_CATALOG, type HardwareCatalogItem } from './hardwareCatalog';
import { generateEmbedding, generateDeterministicEmbedding, cosineSimilarity } from './embedding';

export interface SemanticSearchResult extends HardwareCatalogItem {
  similarity: number;
}

export interface SearchHardwareOptions {
  query: string;
  type?: 'switch' | 'plate' | 'case' | 'foam' | 'all';
  limit?: number;
}

// Bộ nhớ đệm embedding cho catalog tĩnh để tìm kiếm offline siêu tốc (<1ms)
const catalogWithEmbeddings: Array<{ item: HardwareCatalogItem; embedding: number[] }> =
  HARDWARE_CATALOG.map((item) => ({
    item,
    embedding: generateDeterministicEmbedding(`${item.name} ${item.type} ${item.material} ${item.acousticDescription}`),
  }));

/**
 * Tìm kiếm trong Catalog cục bộ bằng Cosine Similarity khi Database offline
 */
export function searchInMemoryCatalog(
  query: string,
  queryEmbedding: number[],
  type?: 'switch' | 'plate' | 'case' | 'foam' | 'all',
  limit: number = 4
): SemanticSearchResult[] {
  const normalizedType = type === 'all' ? undefined : type;

  const results: SemanticSearchResult[] = catalogWithEmbeddings
    .filter(({ item }) => !normalizedType || item.type === normalizedType)
    .map(({ item, embedding }) => {
      const similarity = cosineSimilarity(queryEmbedding, embedding);
      return {
        ...item,
        similarity: Math.round(similarity * 1000) / 1000,
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
}

/**
 * Tìm kiếm ngữ nghĩa linh kiện phần cứng (Semantic Search RAG)
 * Ưu tiên truy vấn vector từ PostgreSQL (pgvector). Tự động fallback sang in-memory catalog nếu DB offline.
 */
export async function searchHardwareComponents({
  query,
  type = 'all',
  limit = 4,
}: SearchHardwareOptions): Promise<SemanticSearchResult[]> {
  const effectiveLimit = Math.max(1, Math.min(limit, 20));
  const queryEmbedding = await generateEmbedding(query);

  // 1. Nếu môi trường test hoặc database không khả dụng, dùng in-memory fallback
  if (process.env.NODE_ENV === 'test') {
    return searchInMemoryCatalog(query, queryEmbedding, type, effectiveLimit);
  }

  // 2. Thử truy vấn qua PostgreSQL + pgvector
  try {
    const vectorLiteral = `[${queryEmbedding.join(',')}]`;
    const filterType = type === 'all' ? null : type;

    const rows = await db.execute(sql`
      SELECT 
        id,
        type,
        name,
        material,
        acoustic_description as "acousticDescription",
        sound_profile as "soundProfile",
        specs,
        ROUND((1 - (embedding <=> ${vectorLiteral}::vector))::numeric, 3)::float as similarity
      FROM ${hardwareComponents}
      WHERE (${filterType}::text IS NULL OR type = ${filterType})
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorLiteral}::vector ASC
      LIMIT ${effectiveLimit};
    `);

    if (rows && rows.rows && rows.rows.length > 0) {
      return rows.rows.map((r) => ({
        id: String(r.id),
        type: r.type as HardwareCatalogItem['type'],
        name: String(r.name),
        material: String(r.material ?? ''),
        acousticDescription: String(r.acousticDescription ?? ''),
        soundProfile: r.soundProfile as HardwareCatalogItem['soundProfile'],
        specs: (r.specs as Record<string, unknown>) ?? {},
        similarity: Number(r.similarity),
      }));
    }
  } catch (dbError) {
    // Database chưa bật hoặc chưa seed dữ liệu -> Fallback sang in-memory catalog
    console.warn('[PGVECTOR_FALLBACK]: Database pgvector không phản hồi, fallback sang in-memory catalog:', dbError);
  }

  return searchInMemoryCatalog(query, queryEmbedding, type, effectiveLimit);
}
