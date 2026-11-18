import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { soundEngine } from '@/lib/audio/soundEngine';
import {
  attachKeyboardListeners,
  isKeyPressed,
  isTypingTarget,
  pressKey,
  releaseAllKeys,
  releaseKey,
  shouldSuppressSpaceActivation,
} from './pressedKeys';

describe('pressedKeys', () => {
  const play = vi.spyOn(soundEngine, 'playKeySound').mockImplementation(() => undefined);
  const playUp = vi.spyOn(soundEngine, 'playKeyUp').mockImplementation(() => undefined);
  beforeEach(() => {
    play.mockClear();
    playUp.mockClear();
  });
  afterEach(() => releaseAllKeys());

  it('giữ phím (event.repeat) không phát tiếng lặp, kể cả sau khi mất focus rồi quay lại', () => {
    const detach = attachKeyboardListeners(window);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', repeat: true }));
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', repeat: true }));
    expect(play).toHaveBeenCalledTimes(1);
    detach();
  });

  it('ẩn tab (visibilitychange) thì nhả hết phím, keycap không bị lún mãi', () => {
    const detach = attachKeyboardListeners(window);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(isKeyPressed('KeyD')).toBe(false);
    // Nhả hết im lặng: không phát hàng loạt tiếng nhả
    expect(playUp).not.toHaveBeenCalled();
    visibility.mockRestore();
    detach();
  });

  it('Space trên nút vừa bấm chuột bị chặn kích hoạt lại (không chạy lại "Nghe thử" chồng tiếng)', () => {
    const detach = attachKeyboardListeners(window);
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.matches = ((selector: string) => !selector.includes('focus-visible') && selector.includes('button')) as Element['matches'];
    const down = new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true });
    button.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    // Vẫn tính là gõ phím cách để nghe tiếng
    expect(play).toHaveBeenCalledWith('Space');
    button.remove();
    detach();
  });

  it('nút được focus bằng bàn phím (:focus-visible) vẫn bấm được bằng Space', () => {
    const button = document.createElement('button');
    button.matches = (() => true) as Element['matches'];
    expect(shouldSuppressSpaceActivation({ code: 'Space', target: button })).toBe(false);
    expect(shouldSuppressSpaceActivation({ code: 'KeyA', target: button })).toBe(false);
    expect(shouldSuppressSpaceActivation({ code: 'Space', target: document.createElement('div') })).toBe(false);
  });

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
