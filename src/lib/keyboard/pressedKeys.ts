import { soundEngine } from '@/lib/audio/soundEngine';

/**
 * Kho phím đang nhấn, nằm ngoài React: vòng lặp useFrame của mô hình 3D đọc trực tiếp mỗi khung hình,
 * nên gõ phím không gây re-render giao diện.
 */

const pressed = new Set<string>();

export const pressKey = (code: string): void => {
  if (!pressed.has(code)) {
    soundEngine.playKeySound(code);
  }
  pressed.add(code);
};

export const releaseKey = (code: string): void => {
  // Chỉ phát tiếng nhả khi phím thật sự đang nhấn (rê chuột ra khỏi keycap cũng gọi releaseKey)
  if (pressed.delete(code)) soundEngine.playKeyUp(code);
};

/** Nhả hết phím im lặng (mất focus, ẩn tab): không phát tiếng nhả hàng loạt */
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

const ACTIVATABLE = 'button, [role="button"], a[href], summary, input[type="button"], input[type="checkbox"], input[type="radio"]';

/**
 * Space đang rơi vào một nút vừa được BẤM CHUỘT (focus không hiện vòng :focus-visible): trình duyệt sẽ "bấm"
 * lại nút đó khi nhả Space (ví dụ "Nghe thử" chạy lại, chồng tiếng). Người dùng chỉ đang gõ thử Space nên chặn.
 * Nút được focus bằng bàn phím (Tab) vẫn bấm được bằng Space như bình thường.
 */
export const shouldSuppressSpaceActivation = (event: Pick<KeyboardEvent, 'code' | 'target'>): boolean => {
  if (event.code !== 'Space') return false;
  const target = event.target as HTMLElement | null;
  if (!target || typeof target.matches !== 'function' || !target.matches(ACTIVATABLE)) return false;
  try {
    return !target.matches(':focus-visible');
  } catch {
    // Trình duyệt cũ không hiểu :focus-visible: coi như focus do chuột
    return true;
  }
};

/**
 * Gắn listener bàn phím thật vào window. Trả về hàm gỡ.
 * - Bỏ qua sự kiện lặp khi giữ phím (`event.repeat`): giữ phím không phát tiếng liên tục.
 * - Mất focus cửa sổ hoặc ẩn tab: nhả hết phím, không để keycap 3D lún mãi.
 * - Không chặn hành vi mặc định (Tab vẫn chuyển focus, phím tắt trình duyệt vẫn chạy), trừ Space trên nút vừa bấm chuột.
 */
export const attachKeyboardListeners = (target: Window): (() => void) => {
  const onDown = (event: KeyboardEvent) => {
    if (isTypingTarget(event.target)) return;
    if (shouldSuppressSpaceActivation(event)) event.preventDefault();
    if (event.repeat) return;
    pressKey(event.code);
  };
  const onUp = (event: KeyboardEvent) => {
    if (shouldSuppressSpaceActivation(event)) event.preventDefault();
    releaseKey(event.code);
  };
  const onBlur = () => releaseAllKeys();
  const doc = target.document;
  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') releaseAllKeys();
  };

  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  target.addEventListener('blur', onBlur);
  doc?.addEventListener('visibilitychange', onVisibility);
  return () => {
    target.removeEventListener('keydown', onDown);
    target.removeEventListener('keyup', onUp);
    target.removeEventListener('blur', onBlur);
    doc?.removeEventListener('visibilitychange', onVisibility);
    releaseAllKeys();
  };
};
