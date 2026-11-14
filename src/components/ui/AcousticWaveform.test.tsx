import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AcousticWaveform } from './AcousticWaveform';
import { useKeyboardStore } from '@/store/useKeyboardStore';

describe('AcousticWaveform Component', () => {
  beforeEach(() => {
    useKeyboardStore.getState().resetConfig();
  });

  it('render vùng đo lường âm học với đầy đủ nhãn tiếp cận aria', () => {
    render(<AcousticWaveform />);
    const region = screen.getByRole('region', { name: 'Đo lường âm học thời gian thực' });
    expect(region).toBeDefined();
    expect(screen.getByText(/Âm sắc:/)).toBeDefined();
  });

  it('hiển thị 12 thanh dải sóng âm', () => {
    const { container } = render(<AcousticWaveform />);
    const barsContainer = container.querySelector('.h-8');
    expect(barsContainer).toBeDefined();
    const bars = barsContainer?.querySelectorAll('span');
    expect(bars?.length).toBe(12);
  });

  it('cập nhật chỉ số cao độ và cộng hưởng theo store', () => {
    useKeyboardStore.getState().setPlateMaterial('pom');
    useKeyboardStore.getState().setSwitchType('linear');

    render(<AcousticWaveform />);
    const profile = useKeyboardStore.getState().soundProfile;

    expect(screen.getByText(`Cao độ: ${profile.pitchMultiplier.toFixed(2)}x`)).toBeDefined();
    expect(screen.getByText(`Cộng hưởng: ${profile.resonance.toFixed(2)}x`)).toBeDefined();
    expect(screen.getByText(`Triệt tiêu: ${profile.damping.toFixed(2)}`)).toBeDefined();
  });

  it('thêm hiệu ứng animate-sound-wave khi isStreaming = true', () => {
    const { container } = render(<AcousticWaveform isStreaming={true} />);
    const animatedBars = container.querySelectorAll('.animate-sound-wave');
    expect(animatedBars.length).toBe(12);
  });
});
