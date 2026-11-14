/**
 * Kho phím đang nhấn, nằm ngoài React: vòng lặp useFrame của mô hình 3D đọc trực tiếp mỗi khung hình,
 * nên gõ phím không gây re-render giao diện.
 */

const pressed = new Set<string>();

export const pressKey = (code: string): void => {
  pressed.add(code);
};

export const releaseKey = (code: string): void => {
  pressed.delete(code);
};

export const releaseAllKeys = (): void => {
  pressed.clear();
};

export const isKeyPressed = (code: string): boolean => pressed.has(code);

/** Không bắt phím khi người dùng đang gõ vào ô nhập liệu hoặc vùng soạn thảo. */
export const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!target || typeof (target as HTMLElement).tagName !== 'string') return false;
  const element = target as HTMLElement;
  const tag = element.tagName.toLowerCase();
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag === 'input') {
    const type = (element as HTMLInputElement).type;
    return !['range', 'checkbox', 'radio', 'button'].includes(type);
  }
  return element.isContentEditable === true;
};

/**
 * Gắn listener bàn phím thật vào window. Trả về hàm gỡ.
 * Không chặn hành vi mặc định (Tab vẫn chuyển focus, phím tắt trình duyệt vẫn chạy).
 */
export const attachKeyboardListeners = (target: Window): (() => void) => {
  const onDown = (event: KeyboardEvent) => {
    if (isTypingTarget(event.target)) return;
    pressKey(event.code);
  };
  const onUp = (event: KeyboardEvent) => releaseKey(event.code);
  const onBlur = () => releaseAllKeys();

  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  target.addEventListener('blur', onBlur);
  return () => {
    target.removeEventListener('keydown', onDown);
    target.removeEventListener('keyup', onUp);
    target.removeEventListener('blur', onBlur);
    releaseAllKeys();
  };
};
