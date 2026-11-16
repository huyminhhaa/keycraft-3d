import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { isLayerRoot, parsePartName, resolvePart } from './modelParts';

const node = (name: string, parent?: THREE.Object3D): THREE.Object3D => {
  const object = new THREE.Group();
  object.name = name;
  parent?.add(object);
  return object;
};

describe('parsePartName', () => {
  it('nhận tên bộ phận không phân biệt hoa thường', () => {
    expect(parsePartName('TopCase')).toEqual({ part: 'topCase' });
    expect(parsePartName('bottomcase_shell')).toEqual({ part: 'bottomCase' });
    expect(parsePartName('Switches')).toEqual({ part: 'switch' });
    expect(parsePartName('Detail_Foot')).toEqual({ part: 'detail' });
  });

  it('keycap đọc được mã phím và nhóm màu, kể cả đuôi số Blender thêm khi trùng tên', () => {
    expect(parsePartName('Keycap_KeyA_alpha')).toEqual({ part: 'keycap', keyCode: 'KeyA', role: 'alpha' });
    expect(parsePartName('Keycap_Space_modifier001')).toEqual({ part: 'keycap', keyCode: 'Space', role: 'modifier' });
    expect(parsePartName('Keycaps')).toEqual({ part: 'keycap' });
  });

  it('tên lạ (Cube.001, Mesh) không phải bộ phận', () => {
    expect(parsePartName('Cube001')).toBeNull();
    expect(parsePartName('Mesh')).toBeNull();
  });
});

describe('resolvePart & isLayerRoot', () => {
  it('mesh không tên lấy bộ phận theo cha; Legend giữ bộ phận riêng', () => {
    const root = node('Scene');
    const keycaps = node('Keycaps', root);
    const keyA = node('Keycap_KeyA_alpha', keycaps);
    const mesh = node('', keyA);
    const legend = node('Legend', keyA);

    expect(resolvePart(mesh, root)).toEqual({ part: 'keycap', keyCode: 'KeyA', role: 'alpha' });
    expect(resolvePart(legend, root)).toEqual({ part: 'legend' });
    expect(isLayerRoot(keycaps, root)).toBe(true);
    expect(isLayerRoot(keyA, root)).toBe(false);
  });

  it('không đi ngược lên quá gốc mô hình', () => {
    const outer = node('TopCase');
    const root = node('Scene', outer);
    const loose = node('Cube001', root);
    expect(resolvePart(loose, root)).toBeNull();
  });
});
