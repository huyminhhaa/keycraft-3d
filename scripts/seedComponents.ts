import { pool, db } from '../src/db';
import { hardwareComponents } from '../src/db/schema';
import { HARDWARE_CATALOG } from '../src/lib/ai/hardwareCatalog';
import { generateEmbedding } from '../src/lib/ai/embedding';
import { sql } from 'drizzle-orm';

async function seed() {
  console.log('🚀 [KEYCRAFT SEED]: Bắt đầu nạp dữ liệu phần cứng âm học & Vector Embedding (768d)...');

  try {
    // 1. Kiểm tra kết nối và extension vector
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log('✅ [KEYCRAFT SEED]: Đã kiểm tra extension "vector" trong PostgreSQL.');

    let insertedCount = 0;

    for (const item of HARDWARE_CATALOG) {
      const fullText = `${item.name} (${item.type}) - Chất liệu: ${item.material}. ${item.acousticDescription}`;
      const embedding = await generateEmbedding(fullText);

      const vectorLiteral = `[${embedding.join(',')}]`;

      await db.execute(sql`
        INSERT INTO ${hardwareComponents} (
          type,
          name,
          material,
          acoustic_description,
          sound_profile,
          specs,
          embedding
        ) VALUES (
          ${item.type},
          ${item.name},
          ${item.material},
          ${item.acousticDescription},
          ${JSON.stringify(item.soundProfile)}::jsonb,
          ${JSON.stringify(item.specs)}::jsonb,
          ${vectorLiteral}::vector
        )
        ON CONFLICT DO NOTHING;
      `);

      insertedCount++;
      console.log(`   [${insertedCount}/${HARDWARE_CATALOG.length}] Đã nạp: ${item.name} (${item.type}) - Vector 768d`);
    }

    console.log(`🎉 [KEYCRAFT SEED]: Hoàn thành nạp ${insertedCount} linh kiện vào bảng hardware_components!`);
  } catch (error) {
    console.error('❌ [KEYCRAFT SEED ERROR]: Lỗi trong quá trình seed dữ liệu:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
