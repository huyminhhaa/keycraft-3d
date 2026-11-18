import { describe, it, expect } from 'vitest';
import { KEY_TRAVEL, calculateLayerPositions, getCaseMaterialProps, getModelWidth, labelSide } from './KeyboardModel';

describe('KeyboardModel Logic & Calculations', () => {
  describe('calculateLayerPositions (Trục Y của 7 lớp linh kiện)', () => {
    it('ở trạng thái gộp (offset = 0), các lớp nằm sát nhau chuẩn xác', () => {
      const pos = calculateLayerPositions(0);
      expect(pos.bottomCase).toBe(0);
      expect(pos.pcb).toBe(0.28);
      expect(pos.foam).toBe(0.34);
      expect(pos.plate).toBe(0.4);
      expect(pos.switches).toBe(0.52);
      expect(pos.keycaps).toBe(0.74);
      expect(pos.topCase).toBe(0.44);

      expect(pos.pcb).toBeGreaterThan(pos.bottomCase);
      expect(pos.foam).toBeGreaterThan(pos.pcb);
      expect(pos.plate).toBeGreaterThan(pos.foam);
      expect(pos.switches).toBeGreaterThan(pos.plate);
      expect(pos.keycaps).toBeGreaterThan(pos.switches);
    });

    it('khi tách lớp (offset = 1.5), lớp càng cao bung càng xa', () => {
      const zeroPos = calculateLayerPositions(0);
      const explodedPos = calculateLayerPositions(1.5);
      const diff = (key: keyof typeof zeroPos) => explodedPos[key] - zeroPos[key];

      // Thứ tự như sơ đồ tách lớp của hãng: switch → khung vỏ trên → keycap trên cùng
      expect(diff('keycaps')).toBeGreaterThan(diff('topCase'));
      expect(diff('topCase')).toBeGreaterThan(diff('switches'));
      expect(diff('switches')).toBeGreaterThan(diff('plate'));
      expect(diff('plate')).toBeGreaterThan(diff('foam'));
      expect(diff('foam')).toBeGreaterThan(diff('pcb'));
      expect(diff('pcb')).toBeGreaterThan(0);
    });

    it('ở mức bung tối đa (offset = 3.0), không có lớp nào bị đè nhau', () => {
      const maxPos = calculateLayerPositions(3.0);
      expect(maxPos.topCase).toBeGreaterThan(5.0);
      expect(maxPos.keycaps).toBeGreaterThan(8.0);
    });

    it('khi tách lớp, đáy keycap nằm hẳn trên mép khung vỏ trên (không lọt thỏm trong khung)', () => {
      [1, 1.5, 3].forEach((offset) => {
        const pos = calculateLayerPositions(offset);
        // Đáy keycap: gốc lớp keycap − 0.17; mép trên khung vỏ trên: gốc lớp vỏ trên + 0.12
        expect(pos.keycaps - 0.17).toBeGreaterThan(pos.topCase + 0.12);
      });
    });
  });

  describe('Kích thước & vật liệu', () => {
    it('TKL rộng hơn 75%, 75% và 65% rộng bằng nhau (cùng 16u)', () => {
      expect(getModelWidth('TKL')).toBeGreaterThan(getModelWidth('75%'));
      expect(getModelWidth('75%')).toBeCloseTo(getModelWidth('65%'), 6);
    });

    it('vỏ nhôm là kim loại có màu, vỏ gỗ giữ màu gỗ bất kể màu đã chọn', () => {
      expect(getCaseMaterialProps('aluminum', '#b3141f')).toMatchObject({ color: '#b3141f' });
      expect(getCaseMaterialProps('aluminum', '#b3141f').metalness).toBeGreaterThan(0.5);
      expect(getCaseMaterialProps('wood', '#b3141f').color).toBe('#6b4226');
      expect(getCaseMaterialProps('acrylic', '#ffffff').transmission).toBeGreaterThan(0.5);
    });

    it('nhãn tách lớp xếp so le: hai lớp liền kề không cùng một bên', () => {
      const sides = ['01', '02', '03', '04', '05', '06', '07'].map(labelSide);
      for (let i = 1; i < sides.length; i++) expect(sides[i]).not.toBe(sides[i - 1]);
    });

    it('hành trình nhấn phím nằm trong khoảng hợp lý (3–5mm quy đổi)', () => {
      expect(KEY_TRAVEL).toBeGreaterThan(0.05);
      expect(KEY_TRAVEL).toBeLessThan(0.1);
    });
  });
});
