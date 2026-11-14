import { describe, it, expect, afterEach } from 'vitest';
import {
  attachKeyboardListeners,
  isKeyPressed,
  isTypingTarget,
  pressKey,
  releaseAllKeys,
  releaseKey,
} from './pressedKeys';

describe('pressedKeys', () => {
  afterEach(() => releaseAllKeys());

  it('nhấn và nhả một phím', () => {
    pressKey('KeyA');
    expect(isKeyPressed('KeyA')).toBe(true);
    releaseKey('KeyA');
    expect(isKeyPressed('KeyA')).toBe(false);
  });

  it('isTypingTarget bỏ qua ô nhập chữ nhưng không bỏ qua thanh trượt hay nút', () => {
    const text = document.createElement('input');
    const range = document.createElement('input');
    range.type = 'range';
    expect(isTypingTarget(text)).toBe(true);
    expect(isTypingTarget(range)).toBe(false);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it('listener trên window nhấn/nhả theo KeyboardEvent.code và nhả hết khi mất focus', () => {
    const detach = attachKeyboardListeners(window);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(isKeyPressed('KeyJ')).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyJ' }));
    expect(isKeyPressed('KeyJ')).toBe(false);

    window.dispatchEvent(new Event('blur'));
    expect(isKeyPressed('Space')).toBe(false);
    detach();
  });

  it('không bắt phím khi đang gõ trong ô nhập liệu', () => {
    const detach = attachKeyboardListeners(window);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }));
    expect(isKeyPressed('KeyQ')).toBe(false);
    input.remove();
    detach();
  });
});
