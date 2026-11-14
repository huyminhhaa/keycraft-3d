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
    it('hiển thị thương hiệu KeyCraft 3D và trạng thái Studio', () => {
      render(<StudioNavbar />);
      expect(screen.getByText(/KeyCraft/i)).toBeDefined();
      expect(screen.getByText(/Studio v2.0/i)).toBeDefined();
    });

    it('nút Tách Lớp gọi toggleExploded của store khi nhấp', () => {
      render(<StudioNavbar />);
      const explodeBtn = screen.getByRole('button', { name: /Tách Lớp 7 Phím/i });
      expect(explodeBtn.getAttribute('aria-pressed')).toBe('false');

      fireEvent.click(explodeBtn);
      expect(useKeyboardStore.getState().isExploded).toBe(true);
      expect(screen.getByRole('button', { name: /Gộp Lại/i }).getAttribute('aria-pressed')).toBe('true');
    });

    it('nút Reset khôi phục cấu hình mặc định', () => {
      useKeyboardStore.getState().setLayout('TKL');
      render(<StudioNavbar />);
      fireEvent.click(screen.getByRole('button', { name: /Khôi phục cấu hình mặc định/i }));
      expect(useKeyboardStore.getState().layout).toBe('75%');
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

    it('chip tính cách âm thanh đổi theo plate', () => {
      render(<AcousticBadge />);
      expect(screen.getByText('Clack')).toBeDefined();
      React.act(() => {
        useKeyboardStore.getState().setPlateMaterial('polycarbonate');
      });
      expect(screen.getByText('Thock')).toBeDefined();
    });
  });

  describe('StudioControls', () => {
    it('cho phép chuyển đổi layout bàn phím 65%, 75%, TKL', () => {
      render(<StudioControls />);
      fireEvent.click(screen.getByRole('button', { name: /TKL/ }));
      expect(useKeyboardStore.getState().layout).toBe('TKL');

      fireEvent.click(screen.getByRole('button', { name: /65%/ }));
      expect(useKeyboardStore.getState().layout).toBe('65%');
      expect(screen.getByRole('button', { name: /65%/ }).getAttribute('aria-pressed')).toBe('true');
    });

    it('cho phép chuyển đổi chất liệu Switch Plate', () => {
      render(<StudioControls />);
      fireEvent.click(screen.getByText('POM'));
      expect(useKeyboardStore.getState().plateMaterial).toBe('pom');
    });

    it('cho phép chuyển đổi giữa các tab Phần Cứng, Màu & RGB, Góc Nhìn', () => {
      render(<StudioControls />);
      const aestheticTab = screen.getByRole('tab', { name: /Màu & RGB/ });
      fireEvent.click(aestheticTab);
      expect(aestheticTab.getAttribute('aria-selected')).toBe('true');
      expect(screen.getByText(/Màu Sắc Case/i)).toBeDefined();
      expect(screen.getByText(/Đèn Gầm RGB Underglow/i)).toBeDefined();

      fireEvent.click(screen.getByRole('tab', { name: /Góc Nhìn/ }));
      expect(screen.getByText(/Góc Nhìn Studio Presets/i)).toBeDefined();
    });

    it('công tắc đèn gầm (role=switch) bật/tắt underglow trong store', () => {
      render(<StudioControls />);
      fireEvent.click(screen.getByRole('tab', { name: /Màu & RGB/ }));
      const toggle = screen.getByRole('switch', { name: /đèn gầm/i });
      expect(toggle.getAttribute('aria-checked')).toBe('true');

      fireEvent.click(toggle);
      expect(useKeyboardStore.getState().underglowEnabled).toBe(false);
      expect(toggle.getAttribute('aria-checked')).toBe('false');
    });

    it('ô màu case cập nhật caseColor theo nhãn màu', () => {
      render(<StudioControls />);
      fireEvent.click(screen.getByRole('tab', { name: /Màu & RGB/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Crimson' }));
      expect(useKeyboardStore.getState().caseColor).toBe('#881337');
    });

    it('chọn preset camera cập nhật cameraPreset', () => {
      render(<StudioControls />);
      fireEvent.click(screen.getByRole('tab', { name: /Góc Nhìn/ }));
      fireEvent.click(screen.getByRole('button', { name: /Isometric/ }));
      expect(useKeyboardStore.getState().cameraPreset).toBe('isometric');
    });

    it('nút thu gọn phản ánh trạng thái qua aria-expanded', () => {
      render(<StudioControls />);
      const collapseBtn = screen.getByRole('button', { name: /Thu gọn bảng điều khiển/i });
      expect(collapseBtn.getAttribute('aria-expanded')).toBe('true');
      fireEvent.click(collapseBtn);
      expect(screen.getByRole('button', { name: /Mở bảng điều khiển/i }).getAttribute('aria-expanded')).toBe('false');
    });
  });
});
