import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StudioPage from './page';

// Mock Canvas 3D dynamic import
vi.mock('@/components/canvas/KeyboardScene', () => ({
  default: () => <div data-testid="mock-keyboard-scene">Keyboard 3D Scene Mock</div>,
}));

describe('StudioPage (/studio)', () => {
  it('render giao diện studio bàn phím 3D thành công', () => {
    render(<StudioPage />);
    expect(screen.getByRole('main')).toBeDefined();
    expect(screen.getByLabelText('Cấu hình bàn phím')).toBeDefined();
  });
});
