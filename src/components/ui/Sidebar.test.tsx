import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { Sidebar } from './Sidebar';
import { StageOverlay, buildStageTitle } from './StageOverlay';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { useStageStore } from '@/store/useStageStore';
import { KEYCAP_SETS } from '@/lib/keyboard/keycapSets';
import { KEYBOARD_BUILDS } from '@/lib/keyboard/builds';
import { TONE_COPY } from './SoundPanel';

describe('Sidebar', () => {
  beforeEach(() => {
    useKeyboardStore.getState().resetConfig();
    // Các test bên dưới thao tác tab Thiết kế; tab mặc định là Mẫu phím
    useStageStore.getState().setActiveTab('design');
  });

  it('h1 gọi đúng tên loại sản phẩm', () => {
    render(<Sidebar />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bàn phím cơ 3D tự cấu hình');
  });

  it('tab Mẫu phím: chọn một build thì đổi cả cấu hình 3D', () => {
    useStageStore.getState().setActiveTab('builds');
    render(<Sidebar />);
    fireEvent.click(screen.getAllByRole('button', { name: /AULA F99 Pro/ })[0]);
    expect(useKeyboardStore.getState()).toMatchObject({ buildId: 'aula-f99-asura', layout: '96%' });
    expect(screen.getByText('Mount')).toBeDefined();
  });

  it('đổi bố cục qua nhóm nút và hiển thị số phím', () => {
    render(<Sidebar />);
    const group = screen.getByRole('group', { name: 'Bố cục' });
    fireEvent.click(within(group).getByRole('button', { name: /65%/ }));
    expect(useKeyboardStore.getState().layout).toBe('65%');
    expect(within(group).getByRole('button', { name: /65%/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('68 phím', { selector: 'span.truncate' })).toBeDefined();
  });

  it('chọn chất liệu và màu vỏ; vỏ gỗ ẩn bảng màu', () => {
    render(<Sidebar />);
    fireEvent.click(within(screen.getByRole('group', { name: 'Màu vỏ' })).getByRole('button', { name: 'Xanh navy' }));
    expect(useKeyboardStore.getState().caseColor).toBe('#22355e');

    fireEvent.click(within(screen.getByRole('group', { name: 'Chất liệu vỏ' })).getByRole('button', { name: 'Gỗ' }));
    expect(useKeyboardStore.getState().caseMaterial).toBe('wood');
    expect(screen.queryByRole('group', { name: 'Màu vỏ' })).toBeNull();
  });

  it('chọn bộ keycap đặt cả 3 màu cùng lúc', () => {
    render(<Sidebar />);
    const navy = KEYCAP_SETS.find((set) => set.id === 'navy');
    if (!navy) throw new Error('missing set');
    const keycapButton = screen
      .getAllByRole('button', { name: /Xanh navy/ })
      .find((button) => !button.closest('[aria-label="Màu vỏ"]'));
    if (!keycapButton) throw new Error('missing keycap option');
    fireEvent.click(keycapButton);
    const state = useKeyboardStore.getState();
    expect([state.keycapColor, state.keycapModifierColor, state.keycapAccentColor]).toEqual([
      navy.alpha,
      navy.modifier,
      navy.accent,
    ]);
  });

  it('tắt đèn LED hông bằng công tắc và ẩn thanh độ sáng', () => {
    render(<Sidebar />);
    const toggle = screen.getByRole('switch', { name: 'Bật đèn LED hông' });
    expect(screen.getByRole('slider')).toBeDefined();
    fireEvent.click(toggle);
    expect(useKeyboardStore.getState().underglowEnabled).toBe(false);
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('tab Âm thanh: đổi plate cập nhật hồ sơ âm thanh', () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole('tab', { name: 'Âm thanh' }));
    expect(screen.getByRole('tab', { name: 'Âm thanh' }).getAttribute('aria-selected')).toBe('true');

    expect(screen.getByText(TONE_COPY.Balanced.sentence)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /POM/ }));
    expect(useKeyboardStore.getState().plateMaterial).toBe('pom');
    expect(screen.getByText(TONE_COPY.Thock.sentence)).toBeDefined();
    expect(screen.getAllByRole('meter')).toHaveLength(3);
  });

  it('nút Đặt lại cấu hình đưa store về mặc định', () => {
    useKeyboardStore.getState().setLayout('65%');
    render(<Sidebar />);
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại cấu hình' }));
    expect(useKeyboardStore.getState().layout).toBe('TKL');
  });
});

describe('StageOverlay', () => {
  beforeEach(() => {
    useKeyboardStore.getState().resetConfig();
  });

  it('chọn góc nhìn camera', () => {
    render(<StageOverlay />);
    fireEvent.click(screen.getByRole('button', { name: 'Trên' }));
    expect(useKeyboardStore.getState().cameraPreset).toBe('top');
  });

  it('tách lớp hiện thanh khoảng cách, ghép lại thì ẩn', () => {
    render(<StageOverlay />);
    fireEvent.click(screen.getByRole('button', { name: /Tách 7 lớp/ }));
    expect(useKeyboardStore.getState().isExploded).toBe(true);
    const range = screen.getByRole('slider', { name: 'Khoảng cách giữa các lớp' });
    fireEvent.change(range, { target: { value: '2.4' } });
    expect(useKeyboardStore.getState().explosionOffset).toBe(2.4);

    fireEvent.click(screen.getByRole('button', { name: /Ghép lại/ }));
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('nút thu gọn thanh cấu hình bật/tắt sidebarOpen; mở tab Trợ lý AI thì thanh hiện lại', () => {
    useStageStore.setState({ sidebarOpen: true });
    render(<StageOverlay />);
    const toggle = screen.getByRole('button', { name: 'Thu gọn thanh cấu hình' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(useStageStore.getState().sidebarOpen).toBe(false);
    expect(screen.getByRole('button', { name: 'Mở thanh cấu hình' }).getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Hỏi Trợ lý AI' }));
    expect(useStageStore.getState().sidebarOpen).toBe(true);
  });

  it('nút Xoay 360° bật/tắt bàn xoay', () => {
    useStageStore.setState({ autoRotate: true });
    render(<StageOverlay />);
    const button = screen.getByRole('button', { name: 'Xoay 360°' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(useStageStore.getState().autoRotate).toBe(false);
  });

  it('tiêu đề sân khấu hiện tên máy và mô tả cấu hình, ẩn khi tách lớp', () => {
    const { container } = render(<StageOverlay />);
    expect(screen.getByText('KeyCraft')).toBeDefined();
    expect(screen.getByText('Vỏ nhôm đỏ, keycap Đỏ hai tông, plate FR4, switch Linear.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Tách 7 lớp/ }));
    expect(container.querySelector('.stage-title--hidden')).not.toBeNull();
  });

  it('chuyển sang tab Trợ lý AI và hiển thị panel chat', () => {
    render(<Sidebar />);
    const aiTab = screen.getByRole('tab', { name: 'Trợ lý AI' });
    fireEvent.click(aiTab);
    expect(useStageStore.getState().activeTab).toBe('ai');
    expect(screen.getByText('Kiến trúc sư âm học')).toBeDefined();
  });

  it('buildStageTitle: vỏ gỗ không kèm màu, màu lạ và keycap tự phối vẫn mô tả được', () => {
    expect(
      buildStageTitle({
        layout: '65%',
        caseMaterial: 'wood',
        caseColor: '#b3141f',
        plateMaterial: 'pom',
        switchType: 'tactile',
      })
    ).toEqual({ brand: 'KeyCraft', model: '65%', subtitle: 'Vỏ gỗ, keycap tự phối, plate POM, switch Tactile.' });
    expect(
      buildStageTitle({
        layout: 'TKL',
        caseMaterial: 'aluminum',
        caseColor: '#123456',
        keycapSetName: 'Rêu',
        plateMaterial: 'fr4',
        switchType: 'linear',
      }).subtitle
    ).toBe('Vỏ nhôm, keycap Rêu, plate FR4, switch Linear.');
  });

  it('buildStageTitle: build thật thì tên hãng + tên mẫu, dòng dưới là linh kiện thật', () => {
    const zoom = KEYBOARD_BUILDS.find((b) => b.id === 'zoom75-ee')!;
    const base = { layout: zoom.look.layout, caseMaterial: zoom.look.caseMaterial, caseColor: zoom.look.caseColor };
    const title = buildStageTitle({ ...base, plateMaterial: zoom.look.plateMaterial, switchType: zoom.look.switchType, realBuild: zoom });
    expect(title.brand).toBe('Meletrix');
    expect(title.model).toBe('Zoom75');
    expect(title.subtitle).toContain('WS Morandi');
    // Người dùng đổi plate khác build: ghi theo lựa chọn mới
    expect(buildStageTitle({ ...base, plateMaterial: 'fr4', switchType: zoom.look.switchType, realBuild: zoom }).subtitle).toContain('plate FR4');
  });
});
