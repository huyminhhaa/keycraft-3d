import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { StudioNavbar } from './StudioNavbar';
import { AcousticBadge } from './AcousticBadge';
import { StudioControls } from './StudioControls';
import { useKeyboardStore } from '@/store/useKeyboardStore';

describe('UI Studio Components', () => {
  beforeEach(() => {
    useKeyboardStore.getState().resetConfig();
  });

  describe('StudioNavbar', () => {
    it('hiển thị thương hiệu KeyCraft 3D và phiên bản Studio', () => {
      render(<StudioNavbar />);
      expect(screen.getByText(/KeyCraft/i)).toBeDefined();
      expect(screen.getByText(/Studio v1.3/i)).toBeDefined();
    });

    it('nút Tách Lớp gọi toggleExploded của store khi nhấp', () => {
      render(<StudioNavbar />);
      const explodeBtn = screen.getByText(/Tách Lớp 7 Phím/i);
      expect(explodeBtn).toBeDefined();

      fireEvent.click(explodeBtn);
      expect(useKeyboardStore.getState().isExploded).toBe(true);

      // Đổi sang trạng thái "Gộp Lại"
      expect(screen.getByText(/Gộp Lại/i)).toBeDefined();
    });
  });

  describe('AcousticBadge', () => {
    it('hiển thị đúng telemetry âm học từ Zustand store', () => {
      render(<AcousticBadge />);
      expect(screen.getByText(/Acoustic Telemetry/i)).toBeDefined();
      expect(screen.getByText(/Pitch/i)).toBeDefined();
      expect(screen.getByText(/Resonance/i)).toBeDefined();
      expect(screen.getByText(/Damping/i)).toBeDefined();
    });
  });

  describe('StudioControls', () => {
    it('cho phép chuyển đổi layout bàn phím 65%, 75%, TKL', () => {
      render(<StudioControls />);
      const tklBtn = screen.getByRole('button', { name: 'TKL' });
      fireEvent.click(tklBtn);
      expect(useKeyboardStore.getState().layout).toBe('TKL');

      const sixtyFiveBtn = screen.getByRole('button', { name: '65%' });
      fireEvent.click(sixtyFiveBtn);
      expect(useKeyboardStore.getState().layout).toBe('65%');
    });

    it('cho phép chuyển đổi chất liệu Switch Plate', () => {
      render(<StudioControls />);
      const pomBtn = screen.getByText('POM');
      fireEvent.click(pomBtn);
      expect(useKeyboardStore.getState().plateMaterial).toBe('pom');
    });

    it('cho phép chuyển đổi giữa các tab Phần Cứng, Màu & RGB, Góc Nhìn', () => {
      render(<StudioControls />);
      const aestheticTab = screen.getByText('Màu & RGB');
      fireEvent.click(aestheticTab);
      expect(screen.getByText(/Màu Sắc Case/i)).toBeDefined();
      expect(screen.getByText(/Đèn Gầm RGB Underglow/i)).toBeDefined();

      const cameraTab = screen.getByText('Góc Nhìn');
      fireEvent.click(cameraTab);
      expect(screen.getByText(/Góc Nhìn Studio Presets/i)).toBeDefined();
    });
  });
});
