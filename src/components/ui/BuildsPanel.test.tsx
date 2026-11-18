import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { BuildsPanel } from './BuildsPanel';
import { useSoundStore } from '@/store/useSoundStore';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { soundEngine } from '@/lib/audio/soundEngine';
import { releaseAllKeys } from '@/lib/keyboard/pressedKeys';

/** Nút chọn mẫu (nút đầu tiên trong dòng thứ index của danh sách) */
const selectButton = (index: number): HTMLElement => within(screen.getAllByRole('listitem')[index]).getAllByRole('button')[0];

/** Promise điều khiển được: test quyết định lúc gói tiếng "tải xong" */
const deferred = () => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe('BuildsPanel: đổi mẫu phím đổi luôn tiếng gõ', () => {
  const play = vi.spyOn(soundEngine, 'playKeySound').mockImplementation(() => undefined);
  vi.spyOn(soundEngine, 'playKeyUp').mockImplementation(() => undefined);
  let loads: { id: string; resolve: () => void }[] = [];
  const selectPack = vi.fn((id: string) => {
    const d = deferred();
    loads.push({ id, resolve: d.resolve });
    return d.promise;
  });

  beforeEach(() => {
    vi.useFakeTimers();
    loads = [];
    play.mockClear();
    selectPack.mockClear();
    // Danh sách gói chưa tải xong (packs rỗng): vẫn phải đổi gói theo mẫu
    useSoundStore.setState({ packs: [], selectPack });
  });

  afterEach(() => {
    vi.useRealTimers();
    releaseAllKeys();
  });

  it('chọn mẫu luôn gọi selectPack đúng gói, kể cả khi danh sách gói chưa tải xong', () => {
    render(<BuildsPanel />);
    fireEvent.click(selectButton(0));
    expect(useKeyboardStore.getState().buildId).toBe('aula-f75-reaper');
    expect(selectPack).toHaveBeenCalledWith('aula-f75-reaper');
  });

  it('"Nghe thử" chờ gói tải xong mới gõ demo', async () => {
    render(<BuildsPanel />);
    fireEvent.click(screen.getAllByRole('button', { name: /Nghe thử AULA F75/ })[0]);
    act(() => void vi.advanceTimersByTime(2000));
    expect(play).not.toHaveBeenCalled();

    await act(async () => loads[0].resolve());
    act(() => void vi.advanceTimersByTime(2000));
    expect(play).toHaveBeenCalledWith('KeyK');
  });

  it('bấm "Nghe thử" mẫu khác khi mẫu trước chưa tải xong: chỉ mẫu cuối được gõ demo', async () => {
    render(<BuildsPanel />);
    const listen = screen.getAllByRole('button', { name: /Nghe thử/ });
    fireEvent.click(listen[0]);
    fireEvent.click(listen[3]);
    // Mẫu đầu tải xong muộn: không được gõ demo (sẽ ra tiếng mẫu cũ)
    await act(async () => loads[0].resolve());
    act(() => void vi.advanceTimersByTime(2000));
    expect(play).not.toHaveBeenCalled();

    await act(async () => loads[1].resolve());
    act(() => void vi.advanceTimersByTime(2000));
    expect(play).toHaveBeenCalled();
  });

  it('chọn mẫu mới thì dừng ngay demo đang gõ của mẫu cũ', async () => {
    render(<BuildsPanel />);
    fireEvent.click(screen.getAllByRole('button', { name: /Nghe thử/ })[0]);
    await act(async () => loads[0].resolve());
    act(() => void vi.advanceTimersByTime(300));
    const typedBefore = play.mock.calls.length;
    expect(typedBefore).toBeGreaterThan(0);

    fireEvent.click(selectButton(2));
    act(() => void vi.advanceTimersByTime(3000));
    expect(play.mock.calls.length).toBe(typedBefore);
  });

  it('bấm chuột vào nút thì bỏ focus: gõ Space sau đó không bấm lại nút', () => {
    render(<BuildsPanel />);
    const button = screen.getAllByRole('button', { name: /Nghe thử/ })[0];
    button.focus();
    fireEvent.click(button, { detail: 1 });
    expect(document.activeElement).not.toBe(button);
  });
});
