'use client';

export interface PreparedAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'pdf' | 'text';
  dataBase64: string;
  previewUrl?: string;
}

const CLIENT_ALLOWED_MIMES: Record<string, 'image' | 'pdf' | 'text'> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'application/pdf': 'pdf',
  'text/plain': 'text',
  'text/markdown': 'text',
  'application/json': 'text',
  'text/csv': 'text',
};

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.json': 'application/json',
  '.csv': 'text/csv',
};

const MAX_CLIENT_BYTES = 4 * 1024 * 1024; // 4 MB
const MAX_CANVAS_EDGE = 1600;

function inferMime(file: File): string {
  if (file.type && CLIENT_ALLOWED_MIMES[file.type.toLowerCase()]) {
    return file.type.toLowerCase();
  }
  const lower = file.name.toLowerCase();
  for (const [ext, mime] of Object.entries(EXT_TO_MIME)) {
    if (lower.endsWith(ext)) return mime;
  }
  return file.type || '';
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Không thể đọc tệp.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Vẽ lại ảnh qua HTML5 Canvas để:
 * 1. Tẩy sạch toàn bộ EXIF metadata (vị trí GPS, thiết bị chụp)
 * 2. Loại bỏ mã polyglot/script bị chèn ẩn sau EOF của ảnh
 * 3. Thu gọn kích thước về tối đa 1600px giúp AI nhận diện nhanh & tiết kiệm băng thông
 */
async function sanitizeImageViaCanvas(file: File, targetMime: string): Promise<{ dataUrl: string; size: number }> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    const raw = await readAsDataUrl(file);
    return { dataUrl: raw, size: file.size };
  }

  const rawDataUrl = await readAsDataUrl(file);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX_CANVAS_EDGE / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dataUrl: rawDataUrl, size: file.size });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const outputMime = targetMime === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(outputMime, 0.88);
        const comma = dataUrl.indexOf(',');
        const estimatedBytes = comma !== -1 ? Math.floor(((dataUrl.length - comma - 1) * 3) / 4) : file.size;
        resolve({ dataUrl, size: estimatedBytes });
      } catch {
        resolve({ dataUrl: rawDataUrl, size: file.size });
      }
    };
    img.onerror = () => reject(new Error(`Ảnh "${file.name}" bị hỏng hoặc không phải tệp ảnh hợp lệ.`));
    img.src = rawDataUrl;
  });
}

export async function prepareClientAttachment(file: File): Promise<PreparedAttachment> {
  if (file.size === 0) {
    throw new Error(`Tệp "${file.name}" đang bị rỗng.`);
  }
  if (file.size > MAX_CLIENT_BYTES) {
    throw new Error(`Tệp "${file.name}" vượt quá giới hạn 4MB.`);
  }

  const mimeType = inferMime(file);
  const kind = CLIENT_ALLOWED_MIMES[mimeType];

  if (!kind) {
    throw new Error(
      `Định dạng "${file.name}" không được hỗ trợ vì lý do bảo mật. Chỉ hỗ trợ ảnh JPG/PNG/WebP và tệp PDF/TXT/MD/JSON/CSV.`
    );
  }

  if (kind === 'image') {
    const sanitized = await sanitizeImageViaCanvas(file, mimeType);
    const outMime = sanitized.dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    const safeExtName =
      outMime === 'image/png'
        ? file.name.replace(/\.[^.]+$/, '.png')
        : file.name.replace(/\.[^.]+$/, '.jpg');

    return {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: safeExtName,
      mimeType: outMime,
      size: sanitized.size,
      kind: 'image',
      dataBase64: sanitized.dataUrl,
      previewUrl: sanitized.dataUrl,
    };
  }

  const dataUrl = await readAsDataUrl(file);
  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    mimeType,
    size: file.size,
    kind,
    dataBase64: dataUrl,
  };
}
