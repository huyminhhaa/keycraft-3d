import { describe, it, expect } from 'vitest';
import {
  sanitizeFileName,
  detectMagicMime,
  validateIncomingAttachments,
  MAX_FILE_SIZE_BYTES,
} from './fileGuard';

/** Tạo 1 PNG hợp lệ tối thiểu có IHDR với kích thước width x height tùy chỉnh */
function makeMinimalPng(width: number, height: number): string {
  const buf = Buffer.alloc(33);
  // PNG signature
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  // IHDR length = 13
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf.toString('base64');
}

function makeMinimalJpeg(): string {
  const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  return buf.toString('base64');
}

describe('7-Layer File Security Guard (src/lib/security/fileGuard.ts)', () => {
  it('chặn tên file chứa double extension nguy hiểm và path traversal', () => {
    expect(sanitizeFileName('keyboard.jpg.exe').ok).toBe(false);
    expect(sanitizeFileName('shell.php.png').ok).toBe(false);
    expect(sanitizeFileName('xss.svg').ok).toBe(false);
    expect(sanitizeFileName('evil\x00.png').ok).toBe(false);

    const traversed = sanitizeFileName('../../secret/my-config.json');
    expect(traversed.ok).toBe(true);
    if (traversed.ok) {
      expect(traversed.name).toBe('my-config.json');
    }
  });

  it('chặn file thực thi .exe (MZ header) giả dạng thành ảnh .jpg', () => {
    const exeBytes = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const res = validateIncomingAttachments([
      {
        name: 'my-keyboard.jpg',
        mimeType: 'image/jpeg',
        dataBase64: exeBytes.toString('base64'),
      },
    ]);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('MALICIOUS_SIGNATURE');
    }
  });

  it('chặn file Linux ELF giả dạng thành ảnh .png', () => {
    const elfBytes = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
    const res = validateIncomingAttachments([
      {
        name: 'setup.png',
        mimeType: 'image/png',
        dataBase64: elfBytes.toString('base64'),
      },
    ]);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('MALICIOUS_SIGNATURE');
    }
  });

  it('cấm tuyệt đối ảnh SVG để ngăn Stored XSS', () => {
    const svgPayload = Buffer.from('<svg onload="alert(1)"></svg>').toString('base64');
    const res = validateIncomingAttachments([
      {
        name: 'logo.svg',
        mimeType: 'image/svg+xml',
        dataBase64: svgPayload,
      },
    ]);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('DANGEROUS_FILENAME');
    }
  });

  it('chặn thẻ <script> hoặc <svg> giấu trong tệp .txt', () => {
    const xssTxt = Buffer.from('<svg><script>fetch("https://evil.com")</script></svg>').toString('base64');
    const res = validateIncomingAttachments([
      {
        name: 'notes.txt',
        mimeType: 'text/plain',
        dataBase64: xssTxt,
      },
    ]);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('ACTIVE_MARKUP_BLOCKED');
    }
  });

  it('chặn Image Decompression Bomb (PNG 10000x10000px)', () => {
    const bombPng = makeMinimalPng(10000, 10000);
    const res = validateIncomingAttachments([
      {
        name: 'bomb.png',
        mimeType: 'image/png',
        dataBase64: bombPng,
      },
    ]);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('IMAGE_TOO_LARGE');
    }
  });

  it('chặn PDF chứa mã thực thi /JavaScript hoặc /Launch', () => {
    const maliciousPdf = Buffer.from(
      '%PDF-1.7\n1 0 obj\n<< /Type /Catalog /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>\nendobj\n%%EOF'
    ).toString('base64');

    const res = validateIncomingAttachments([
      {
        name: 'manual.pdf',
        mimeType: 'application/pdf',
        dataBase64: maliciousPdf,
      },
    ]);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('MALICIOUS_PDF');
    }
  });

  it('chặn file vượt quá giới hạn dung lượng 4MB và quá 3 file', () => {
    const oversized = Buffer.alloc(MAX_FILE_SIZE_BYTES + 10, 0x41).toString('base64');
    const resSize = validateIncomingAttachments([
      { name: 'huge.txt', mimeType: 'text/plain', dataBase64: oversized },
    ]);
    expect(resSize.ok).toBe(false);
    if (!resSize.ok) expect(resSize.code).toBe('FILE_TOO_LARGE');

    const jpeg = makeMinimalJpeg();
    const resCount = validateIncomingAttachments([
      { name: '1.jpg', mimeType: 'image/jpeg', dataBase64: jpeg },
      { name: '2.jpg', mimeType: 'image/jpeg', dataBase64: jpeg },
      { name: '3.jpg', mimeType: 'image/jpeg', dataBase64: jpeg },
      { name: '4.jpg', mimeType: 'image/jpeg', dataBase64: jpeg },
    ]);
    expect(resCount.ok).toBe(false);
    if (!resCount.ok) expect(resCount.code).toBe('TOO_MANY_FILES');
  });

  it('cho phép ảnh PNG/JPEG, PDF sạch, và bọc JSON/TXT trong khung chống Prompt Injection', () => {
    const validPng = makeMinimalPng(800, 600);
    const validPdf = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF').toString('base64');
    const validJson = Buffer.from(JSON.stringify({ layout: '75%', switch: 'Oil King' })).toString('base64');

    const res = validateIncomingAttachments([
      { name: 'desk.png', mimeType: 'image/png', dataBase64: `data:image/png;base64,${validPng}` },
      { name: 'spec.pdf', mimeType: 'application/pdf', dataBase64: validPdf },
      { name: 'build.json', mimeType: 'application/json', dataBase64: validJson },
    ]);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.attachments).toHaveLength(3);
      expect(res.attachments[0].kind).toBe('image');
      expect(res.attachments[1].kind).toBe('pdf');
      expect(res.attachments[2].kind).toBe('text');
      expect(res.attachments[2].wrappedText).toContain('untrusted_data="true"');
      expect(detectMagicMime(res.attachments[0].bytes)).toBe('image/png');
    }
  });
});
