import * as THREE from 'three';

/**
 * Xuất bàn phím đang hiển thị ra file .glb (glTF nhị phân) để mở bằng Blender rồi chỉnh tiếp.
 * Canvas nằm ngoài cây React của Sidebar, nên scene được "gửi gắm" qua một tham chiếu dùng chung.
 */
let currentScene: THREE.Scene | null = null;

/** Tên group gốc của bàn phím dựng bằng code (KeyboardModel.tsx) — nút xuất tìm group này trong scene */
export const EXPORT_ROOT_NAME = 'KeyCraftKeyboard';

export const setExportScene = (scene: THREE.Scene | null): void => {
  currentScene = scene;
};

export const getExportScene = (): THREE.Scene | null => currentScene;

/** Bản sao để xuất: bỏ đèn (đèn LED hắt sáng chỉ hợp với sân khấu của web, vào Blender sẽ chói). */
export const prepareForExport = (source: THREE.Object3D): THREE.Object3D => {
  const copy = source.clone(true);
  const lights: THREE.Object3D[] = [];
  copy.traverse((object) => {
    if (object instanceof THREE.Light) lights.push(object);
  });
  lights.forEach((light) => light.removeFromParent());
  return copy;
};

export const exportObjectToGlb = async (source: THREE.Object3D): Promise<ArrayBuffer> => {
  // Tải trình xuất khi bấm nút, không làm nặng lần tải trang đầu
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const result = await new GLTFExporter().parseAsync(prepareForExport(source), { binary: true });
  if (!(result instanceof ArrayBuffer)) throw new Error('Trình xuất không trả về dữ liệu nhị phân .glb');
  return result;
};

export const downloadFile = (data: ArrayBuffer, filename: string): void => {
  const url = URL.createObjectURL(new Blob([data], { type: 'model/gltf-binary' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Thu hồi ngay sẽ làm vài trình duyệt huỷ tải: đợi một nhịp
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
