/**
 * 7-Layer File Upload Security Guard (Zero-Execution Multimodal Pipeline)
 *
 * Bảo vệ ứng dụng khỏi:
 * 1. MIME Spoofing / Extension Spoofing (đổi tên virus.exe -> anh.jpg) qua kiểm tra Magic Bytes
 * 2. Stored XSS qua SVG / HTML (cấm tuyệt đối image/svg+xml, text/html)
 * 3. Path Traversal & Double Extensions (../../shell.php, keyboard.jpg.exe)
 * 4. DoS / OOM / Image Decompression Bomb (giới hạn dung lượng + đọc kích thước pixel <= 4096px)
 * 5. Malicious PDF Active Content (chặn /JavaScript, /JS, /Launch, /OpenAction, /EmbeddedFile)
 * 6. Indirect Prompt Injection trong file văn bản (bọc thẻ <attached_file untrusted_data="true">)
 * 7. Zero-Disk / Zero-Execution (không ghi vào public/, không eval/exec, chỉ xử lý trong RAM)
 */

export const MAX_ATTACHMENTS_PER_MESSAGE = 3;
export const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB mỗi file
export const MAX_TOTAL_PAYLOAD_BYTES = 8 * 1024 * 1024; // 8 MB tổng payload
export const MAX_IMAGE_DIMENSION = 4096; // Chống Pixel Flood / Image Bomb
export const MAX_TEXT_CHARS = 16_000;

export const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const ALLOWED_PDF_MIMES = new Set(['application/pdf']);
export const ALLOWED_TEXT_MIMES = new Set([
  'text/plain',
  'text/markdown',
  'application/json',
  'text/csv',
]);

export const ALLOWED_MIMES = new Set([
  ...ALLOWED_IMAGE_MIMES,
  ...ALLOWED_PDF_MIMES,
  ...ALLOWED_TEXT_MIMES,
]);

export const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md', '.markdown'],
  'application/json': ['.json'],
  'text/csv': ['.csv'],
};

const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'dll', 'bat', 'cmd', 'com', 'msi', 'scr', 'pif', 'ps1', 'vbs', 'vbe',
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'sh', 'bash', 'zsh',
  'php', 'phtml', 'py', 'rb', 'pl', 'jar', 'class', 'war',
  'html', 'htm', 'xhtml', 'svg', 'svgz', 'xml',
  'zip', 'rar', '7z', 'tar', 'gz', 'iso', 'img', 'dmg',
  'docm', 'xlsm', 'pptm', 'lnk', 'hta',
]);

export interface IncomingAttachmentPayload {
  name: string;
  mimeType: string;
  /** Dữ liệu base64 thuần (không chứa tiền tố data:...;base64,) hoặc data URL */
  dataBase64: string;
}

export interface ValidatedAttachment {
  name: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'pdf' | 'text';
  bytes: Uint8Array;
  /** Nội dung văn bản đã bọc khung chống prompt injection (chỉ có khi kind === 'text') */
  wrappedText?: string;
}

export type ValidationResult =
  | { ok: true; attachments: ValidatedAttachment[] }
  | { ok: false; error: string; code: string };

/**
 * Làm sạch tên file: loại bỏ path traversal (../, \), ký tự điều khiển và kiểm tra double extension
 */
export function sanitizeFileName(rawName: string): { ok: true; name: string } | { ok: false; error: string } {
  if (!rawName || typeof rawName !== 'string') {
    return { ok: false, error: 'Tên tệp không hợp lệ.' };
  }

  // Chặn null byte hoặc ký tự điều khiển
  if (/[\x00-\x1f\x7f]/.test(rawName)) {
    return { ok: false, error: 'Tên tệp chứa ký tự điều khiển bị cấm.' };
  }

  // Chỉ lấy basename cuối cùng để vô hiệu hóa path traversal (../../etc/passwd)
  const base = rawName.split(/[\\/]/).pop()?.trim() || '';
  if (!base || base === '.' || base === '..') {
    return { ok: false, error: 'Tên tệp không hợp lệ.' };
  }

  // Kiểm tra mọi phần mở rộng (chống double extension như payload.jpg.exe hoặc virus.php.png)
  const segments = base.toLowerCase().split('.');
  if (segments.length < 2) {
    return { ok: false, error: 'Tệp phải có phần mở rộng hợp lệ (.jpg, .png, .webp, .pdf, .txt, .md, .json, .csv).' };
  }

  for (let i = 1; i < segments.length; i++) {
    if (DANGEROUS_EXTENSIONS.has(segments[i])) {
      return {
        ok: false,
        error: `Từ chối tệp "${base}": phát hiện phần mở rộng nguy hiểm (.${segments[i]}).`,
      };
    }
  }

  const safe = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  return { ok: true, name: safe };
}

/**
 * Tách phần base64 thuần và giải mã sang Uint8Array
 */
export function decodeBase64Payload(raw: string): Uint8Array | null {
  if (!raw || typeof raw !== 'string') return null;
  const commaIdx = raw.indexOf(',');
  const cleaned = (raw.startsWith('data:') && commaIdx !== -1 ? raw.slice(commaIdx + 1) : raw).replace(/\s+/g, '');
  if (!cleaned || !/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) return null;
  try {
    const buf = Buffer.from(cleaned, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } catch {
    return null;
  }
}

/**
 * Kiểm tra Magic Bytes nhị phân thực tế (không tin tưởng MIME do client khai báo)
 */
export function detectMagicMime(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  // PDF: %PDF-
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return 'application/pdf';
  }

  return null;
}

/**
 * Quét chữ ký nhị phân nguy hiểm (file thực thi, kho nén, script/HTML/SVG giả mạo)
 */
export function hasDangerousBinarySignature(bytes: Uint8Array): string | null {
  if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) {
    return 'Windows PE executable (MZ header)';
  }
  if (bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) {
    return 'Linux ELF binary';
  }
  if (
    bytes.length >= 4 &&
    ((bytes[0] === 0xfe && bytes[1] === 0xed && bytes[2] === 0xfa && (bytes[3] === 0xce || bytes[3] === 0xcf)) ||
      (bytes[0] === 0xcf && bytes[1] === 0xfa && bytes[2] === 0xed && bytes[3] === 0xfe) ||
      (bytes[0] === 0xca && bytes[1] === 0xfe && bytes[2] === 0xba && bytes[3] === 0xbe))
  ) {
    return 'Mach-O / Java binary';
  }
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return 'ZIP / Archive / Office Macro container (PK header)';
  }
  if (bytes.length >= 2 && bytes[0] === 0x23 && bytes[1] === 0x21) {
    return 'Executable shell script (#! shebang)';
  }
  return null;
}

/**
 * Đọc kích thước (width, height) từ header nhị phân PNG/JPEG/WebP để chặn Image Decompression Bomb
 */
export function parseImageDimensions(bytes: Uint8Array, mime: string): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (mime === 'image/png' && bytes.length >= 24) {
    return {
      width: view.getUint32(16, false),
      height: view.getUint32(20, false),
    };
  }

  if (mime === 'image/jpeg') {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
      const isSOF =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (isSOF) {
        return {
          height: view.getUint16(offset + 5, false),
          width: view.getUint16(offset + 7, false),
        };
      }
      const segmentLen = view.getUint16(offset + 2, false);
      if (segmentLen < 2) break;
      offset += 2 + segmentLen;
    }
    return null;
  }

  if (mime === 'image/webp' && bytes.length >= 30) {
    const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (chunk === 'VP8X') {
      const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
      const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
      return { width, height };
    }
    if (chunk === 'VP8 ' && bytes.length >= 30) {
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    }
    if (chunk === 'VP8L' && bytes.length >= 25) {
      const bits = view.getUint32(21, true);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
  }

  return null;
}

/**
 * Quét PDF chứa script độc hại / auto-launch / embedded payload
 */
export function scanPdfActiveContent(bytes: Uint8Array): string | null {
  const text = Buffer.from(bytes).toString('latin1');
  const dangerousTokens = ['/JavaScript', '/JS', '/Launch', '/OpenAction', '/AA', '/EmbeddedFile', '/RichMedia', '/XFA'];
  for (const token of dangerousTokens) {
    const regex = new RegExp(`${token}(?![a-zA-Z0-9])`);
    if (regex.test(text)) {
      return token;
    }
  }
  return null;
}

/**
 * Thẩm định toàn bộ danh sách file đính kèm theo 7 lớp phòng thủ
 */
export function validateIncomingAttachments(rawList: unknown): ValidationResult {
  if (rawList === undefined || rawList === null) {
    return { ok: true, attachments: [] };
  }

  if (!Array.isArray(rawList)) {
    return { ok: false, code: 'INVALID_FORMAT', error: 'Danh sách tệp đính kèm không đúng định dạng.' };
  }

  if (rawList.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    return {
      ok: false,
      code: 'TOO_MANY_FILES',
      error: `Chỉ cho phép tối đa ${MAX_ATTACHMENTS_PER_MESSAGE} tệp trong mỗi tin nhắn.`,
    };
  }

  const validated: ValidatedAttachment[] = [];
  let totalBytes = 0;

  for (const item of rawList) {
    if (!item || typeof item !== 'object') {
      return { ok: false, code: 'INVALID_ITEM', error: 'Cấu trúc tệp đính kèm không hợp lệ.' };
    }

    const { name, mimeType, dataBase64 } = item as Partial<IncomingAttachmentPayload>;

    // Lớp 1: Sanitize tên file & chặn double extension / path traversal
    const nameCheck = sanitizeFileName(name || '');
    if (!nameCheck.ok) {
      return { ok: false, code: 'DANGEROUS_FILENAME', error: nameCheck.error };
    }
    const safeName = nameCheck.name;

    // Lớp 2: Kiểm tra Allowlist MIME & đuôi file tương ứng (cấm SVG, HTML, EXE...)
    const normalizedMime = (mimeType || '').trim().toLowerCase();
    if (!ALLOWED_MIMES.has(normalizedMime)) {
      return {
        ok: false,
        code: 'DISALLOWED_MIME',
        error: `Định dạng "${normalizedMime || 'không rõ'}" bị chặn vì lý do bảo mật. Chỉ chấp nhận ảnh JPG/PNG/WebP và tệp PDF/TXT/MD/JSON/CSV.`,
      };
    }

    const allowedExts = ALLOWED_EXTENSIONS[normalizedMime] || [];
    const lowerName = safeName.toLowerCase();
    if (!allowedExts.some((ext) => lowerName.endsWith(ext))) {
      return {
        ok: false,
        code: 'EXTENSION_MISMATCH',
        error: `Đuôi tệp "${safeName}" không khớp với định dạng khai báo (${normalizedMime}).`,
      };
    }

    // Lớp 3: Giải mã & kiểm tra giới hạn kích thước chống DoS/OOM
    const bytes = decodeBase64Payload(dataBase64 || '');
    if (!bytes || bytes.length === 0) {
      return { ok: false, code: 'INVALID_BASE64', error: `Tệp "${safeName}" rỗng hoặc lỗi mã hóa.` };
    }

    if (bytes.length > MAX_FILE_SIZE_BYTES) {
      return {
        ok: false,
        code: 'FILE_TOO_LARGE',
        error: `Tệp "${safeName}" vượt quá giới hạn tối đa ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
      };
    }

    totalBytes += bytes.length;
    if (totalBytes > MAX_TOTAL_PAYLOAD_BYTES) {
      return {
        ok: false,
        code: 'PAYLOAD_TOO_LARGE',
        error: `Tổng dung lượng tệp đính kèm vượt quá giới hạn ${MAX_TOTAL_PAYLOAD_BYTES / (1024 * 1024)}MB.`,
      };
    }

    // Lớp 4: Quét chữ ký nhị phân nguy hiểm (chặn .exe/.elf/.zip/.sh giả dạng)
    const dangerSig = hasDangerousBinarySignature(bytes);
    if (dangerSig) {
      return {
        ok: false,
        code: 'MALICIOUS_SIGNATURE',
        error: `Cảnh báo bảo mật: Tệp "${safeName}" chứa mã nhị phân bị cấm (${dangerSig}).`,
      };
    }

    // Lớp 5: Thẩm định chuyên sâu theo nhóm định dạng (Magic Bytes / Pixel Bomb / PDF Active Content / Text UTF-8)
    if (ALLOWED_IMAGE_MIMES.has(normalizedMime)) {
      const realMime = detectMagicMime(bytes);
      if (realMime !== normalizedMime) {
        return {
          ok: false,
          code: 'MAGIC_BYTES_MISMATCH',
          error: `Tệp "${safeName}" bị từ chối: chữ ký nhị phân không khớp với ảnh ${normalizedMime} (nghi ngờ giả mạo định dạng).`,
        };
      }

      const dims = parseImageDimensions(bytes, normalizedMime);
      if (dims && (dims.width > MAX_IMAGE_DIMENSION || dims.height > MAX_IMAGE_DIMENSION)) {
        return {
          ok: false,
          code: 'IMAGE_TOO_LARGE',
          error: `Ảnh "${safeName}" có độ phân giải quá lớn (${dims.width}×${dims.height}px, tối đa ${MAX_IMAGE_DIMENSION}px).`,
        };
      }

      validated.push({
        name: safeName,
        mimeType: normalizedMime,
        size: bytes.length,
        kind: 'image',
        bytes,
      });
    } else if (ALLOWED_PDF_MIMES.has(normalizedMime)) {
      const realMime = detectMagicMime(bytes);
      if (realMime !== 'application/pdf') {
        return {
          ok: false,
          code: 'MAGIC_BYTES_MISMATCH',
          error: `Tệp "${safeName}" không phải tài liệu PDF hợp lệ (sai chữ ký %PDF-).`,
        };
      }

      const pdfDanger = scanPdfActiveContent(bytes);
      if (pdfDanger) {
        return {
          ok: false,
          code: 'MALICIOUS_PDF',
          error: `Tệp PDF "${safeName}" bị chặn do chứa mã thực thi/nhúng nguy hiểm (${pdfDanger}).`,
        };
      }

      validated.push({
        name: safeName,
        mimeType: normalizedMime,
        size: bytes.length,
        kind: 'pdf',
        bytes,
      });
    } else {
      // File văn bản (.txt, .md, .json, .csv): cấm null-bytes, cấm thẻ HTML/SVG/Script/PHP giả mạo
      if (bytes.includes(0x00)) {
        return {
          ok: false,
          code: 'BINARY_IN_TEXT',
          error: `Tệp văn bản "${safeName}" chứa byte nhị phân (0x00) bất thường.`,
        };
      }

      let decodedText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      const headLower = decodedText.slice(0, 512).trim().toLowerCase();
      if (
        headLower.startsWith('<svg') ||
        headLower.startsWith('<html') ||
        headLower.startsWith('<!doctype html') ||
        headLower.startsWith('<?php') ||
        /<script[\s>]/i.test(decodedText)
      ) {
        return {
          ok: false,
          code: 'ACTIVE_MARKUP_BLOCKED',
          error: `Tệp "${safeName}" chứa mã HTML/SVG/Script/PHP bị cấm.`,
        };
      }

      if (normalizedMime === 'application/json') {
        try {
          JSON.parse(decodedText);
        } catch {
          return {
            ok: false,
            code: 'INVALID_JSON',
            error: `Tệp JSON "${safeName}" không đúng cú pháp hợp lệ.`,
          };
        }
      }

      if (decodedText.length > MAX_TEXT_CHARS) {
        decodedText = `${decodedText.slice(0, MAX_TEXT_CHARS)}\n...[Đã cắt gọn để bảo vệ ngữ cảnh]...`;
      }

      // Lớp 6: Bọc thẻ chống Indirect Prompt Injection
      const wrappedText = `<attached_file name="${safeName}" mime="${normalizedMime}" untrusted_data="true">\n${decodedText}\n</attached_file>`;

      validated.push({
        name: safeName,
        mimeType: normalizedMime,
        size: bytes.length,
        kind: 'text',
        bytes,
        wrappedText,
      });
    }
  }

  return { ok: true, attachments: validated };
}
