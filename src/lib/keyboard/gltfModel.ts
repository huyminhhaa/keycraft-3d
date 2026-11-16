import * as THREE from 'three';
import type { KeyRole } from './layouts';
import { PART_LAYER, isLayerRoot, resolvePart, type ModelLayer } from './modelParts';

/**
 * Xử lý một mô hình .glb đã tải: canh vào sân khấu, tìm bộ phận theo tên, rồi mỗi khung hình
 * dời từng bộ phận (tách lớp, nhấn phím). Toàn bộ là hàm thuần trên Object3D nên test được không cần WebGL.
 */

/** Mặt bệ trưng bày (KeyboardScene đặt bệ ở đây) */
export const STAGE_FLOOR_Y = -0.19;

export interface StageFit {
  scale: number;
  position: [number, number, number];
}

/**
 * File 3D có thể tính bằng mm, cm hay m. Thu/phóng để bề ngang khớp `targetWidth`,
 * canh giữa theo x/z và đặt đáy mô hình đúng mặt bệ.
 */
export const fitToStage = (box: THREE.Box3, targetWidth: number, floorY = STAGE_FLOOR_Y): StageFit => {
  const width = box.max.x - box.min.x;
  if (box.isEmpty() || width <= 0) return { scale: 1, position: [0, floorY, 0] };
  const scale = targetWidth / width;
  const center = box.getCenter(new THREE.Vector3());
  return {
    scale,
    position: [-center.x * scale, floorY - box.min.y * scale, -center.z * scale],
  };
};

export interface TrackedNode {
  object: THREE.Object3D;
  restY: number;
  /** Có khi node là gốc của một lớp: dời theo exploded view */
  layer?: ModelLayer;
  /** Có khi node là một keycap: lún xuống khi nhấn phím đó */
  keyCode?: string;
}

export interface RecolorTargets {
  case: THREE.Mesh[];
  plate: THREE.Mesh[];
  keycaps: Record<KeyRole, THREE.Mesh[]>;
}

export interface PreparedModel {
  nodes: TrackedNode[];
  recolor: RecolorTargets;
}

export const prepareModel = (root: THREE.Object3D): PreparedModel => {
  const nodes: TrackedNode[] = [];
  const recolor: RecolorTargets = { case: [], plate: [], keycaps: { alpha: [], modifier: [], accent: [] } };

  root.traverse((object) => {
    if (object === root) return;
    const own = resolvePart(object, root);
    if (!own) return;

    const layer = isLayerRoot(object, root) ? PART_LAYER[own.part] : undefined;
    // keyCode chỉ tính khi chính tên node là Keycap_<code>_<role> (mesh con bên trong đi theo nó)
    const keyCode = own.keyCode && object.name.toLowerCase().startsWith('keycap_') ? own.keyCode : undefined;
    if (layer || keyCode) nodes.push({ object, restY: object.position.y, layer, keyCode });

    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh) return;
    if (own.part === 'topCase' || own.part === 'bottomCase') recolor.case.push(object);
    else if (own.part === 'plate') recolor.plate.push(object);
    else if (own.part === 'keycap') recolor.keycaps[own.role ?? 'alpha'].push(object);
  });

  return { nodes, recolor };
};

/**
 * Đặt vị trí y cho các node đã theo dõi. `layerDelta` và `press` tính theo đơn vị sân khấu,
 * nên chia cho `scale` để đổi về đơn vị gốc trong file.
 */
export const applyNodePositions = (
  nodes: TrackedNode[],
  layerDelta: Record<ModelLayer, number>,
  press: (code: string) => number,
  scale: number
): void => {
  const s = scale > 0 ? scale : 1;
  nodes.forEach((node) => {
    const lift = node.layer ? layerDelta[node.layer] : 0;
    const sink = node.keyCode ? press(node.keyCode) : 0;
    node.object.position.y = node.restY + (lift - sink) / s;
  });
};
