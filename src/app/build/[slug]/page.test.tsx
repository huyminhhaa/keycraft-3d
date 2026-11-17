import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BuildDetailClient } from './BuildDetailClient';
import type { Build } from '@/db/schema';
import { soundEngine } from '@/lib/audio/soundEngine';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('@/components/canvas/KeyboardScene', () => ({
  KeyboardScene: () => <div data-testid="mock-keyboard-scene">3D Scene Mock</div>,
}));

vi.spyOn(soundEngine, 'playKeySound').mockImplementation(() => {});

const mockBuild: Build = {
  id: 'build-123',
  slug: 'deep-thock-custom-75-abcd',
  title: 'KeyCraft Deep Thock 75',
  description: 'Bản build custom âm trầm ấm với plate POM',
  userId: null,
  config: {
    modelId: 'procedural-default',
    layout: '75%',
    isExploded: false,
    explosionOffset: 1.5,
    plateMaterial: 'pom',
    caseMaterial: 'aluminum',
    switchType: 'linear',
    keycapColor: '#1e293b',
    keycapModifierColor: '#c41f2d',
    keycapAccentColor: '#3b82f6',
    caseColor: '#0f172a',
    underglowColor: '#00f0ff',
    underglowBrightness: 0.8,
    underglowEnabled: true,
    cameraPreset: 'perspective',
    soundProfile: {
      pitchMultiplier: 0.85,
      damping: 0.88,
      resonance: 1.25,
      label: 'Deep Thock',
    },
  },
  viewCount: 42,
  forkCount: 7,
  isPublic: true,
  createdAt: new Date('2026-11-17T10:00:00Z'),
  updatedAt: new Date('2026-11-17T10:00:00Z'),
};

describe('BuildDetailClient (src/app/build/[slug]/BuildDetailClient.tsx)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('render đầy đủ thông tin bản build và các huy hiệu linh kiện', () => {
    render(<BuildDetailClient build={mockBuild} />);

    expect(screen.getByText('KeyCraft Deep Thock 75')).toBeDefined();
    expect(screen.getByText(/Bản build custom âm trầm ấm/)).toBeDefined();
    expect(screen.getByText('75% Layout')).toBeDefined();
    expect(screen.getByText('Plate POM')).toBeDefined();
    expect(screen.getByText('Switch linear')).toBeDefined();
    expect(screen.getByText('42 lượt xem')).toBeDefined();
    expect(screen.getByText('7 remix')).toBeDefined();
  });

  it('nhấn nút Remix trong Studio điều hướng sang /studio', () => {
    render(<BuildDetailClient build={mockBuild} />);

    const remixBtn = screen.getByRole('button', { name: /Remix trong Studio/ });
    fireEvent.click(remixBtn);

    expect(mockPush).toHaveBeenCalledWith('/studio');
  });

  it('nhấn nút nghe thử âm thanh kích hoạt soundEngine', () => {
    render(<BuildDetailClient build={mockBuild} />);

    const keyABtn = screen.getByRole('button', { name: /Phím A/ });
    fireEvent.click(keyABtn);

    expect(soundEngine.playKeySound).toHaveBeenCalledWith('KeyA', {
      plateMaterial: 'pom',
      switchType: 'linear',
    });
  });

  it('nhấn nút Sao chép liên kết ghi URL vào clipboard', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<BuildDetailClient build={mockBuild} />);

    const copyBtn = screen.getByRole('button', { name: /Sao chép liên kết/ });
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalled();
  });
});
