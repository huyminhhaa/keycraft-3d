import { describe, it, expect } from 'vitest';
import {
  calculateLayerPositions,
  getLayoutSpecs,
} from './KeyboardModel';

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

      // Đảm bảo thứ tự độ cao theo thứ tự lắp ráp thực tế
      expect(pos.pcb).toBeGreaterThan(pos.bottomCase);
      expect(pos.foam).toBeGreaterThan(pos.pcb);
      expect(pos.plate).toBeGreaterThan(pos.foam);
      expect(pos.switches).toBeGreaterThan(pos.plate);
      expect(pos.keycaps).toBeGreaterThan(pos.switches);
    });

    it('khi tách lớp (offset = 1.5), khoảng cách giữa các lớp bung rộng theo cấp số nhân', () => {
      const zeroPos = calculateLayerPositions(0);
      const explodedPos = calculateLayerPositions(1.5);

      // Mỗi lớp linh kiện trên cao phải bung ra xa hơn lớp bên dưới
      const topDiff = explodedPos.topCase - zeroPos.topCase;
      const keycapDiff = explodedPos.keycaps - zeroPos.keycaps;
      const switchDiff = explodedPos.switches - zeroPos.switches;
      const plateDiff = explodedPos.plate - zeroPos.plate;
      const foamDiff = explodedPos.foam - zeroPos.foam;
      const pcbDiff = explodedPos.pcb - zeroPos.pcb;

      expect(topDiff).toBeGreaterThan(keycapDiff);
      expect(keycapDiff).toBeGreaterThan(switchDiff);
      expect(switchDiff).toBeGreaterThan(plateDiff);
      expect(plateDiff).toBeGreaterThan(foamDiff);
      expect(foamDiff).toBeGreaterThan(pcbDiff);
      expect(pcbDiff).toBeGreaterThan(0);
    });

    it('ở mức bung tối đa (offset = 3.0), không có lớp nào bị va chạm hoặc đè nhau', () => {
      const maxPos = calculateLayerPositions(3.0);
      expect(maxPos.keycaps).toBeGreaterThan(5.0);
      expect(maxPos.topCase).toBeGreaterThan(6.0);
    });
  });

  describe('getLayoutSpecs (Kích thước hình học theo Layout)', () => {
    it('tính đúng số hàng, cột và chiều dài cho 65%', () => {
      const specs65 = getLayoutSpecs('65%');
      expect(specs65.rows).toBe(5);
      expect(specs65.cols).toBe(15);
      expect(specs65.width).toBe(6.2);
      expect(specs65.depth).toBe(2.2);
    });

    it('tính đúng số hàng, cột và chiều dài cho 75%', () => {
      const specs75 = getLayoutSpecs('75%');
      expect(specs75.rows).toBe(6); // Thêm F-Row
      expect(specs75.cols).toBe(15);
      expect(specs75.width).toBe(6.6);
      expect(specs75.depth).toBe(2.6);
    });

    it('tính đúng kích thước mở rộng cho layout TKL', () => {
      const specsTKL = getLayoutSpecs('TKL');
      expect(specsTKL.rows).toBe(6);
      expect(specsTKL.cols).toBe(18); // Thêm Nav cluster
      expect(specsTKL.width).toBeGreaterThan(getLayoutSpecs('75%').width);
    });
  });
});
