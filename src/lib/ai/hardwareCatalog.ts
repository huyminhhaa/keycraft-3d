import type { SoundProfile } from '@/types/keyboard';
import { calculateSoundProfile } from '@/store/useKeyboardStore';

export interface HardwareCatalogItem {
  id: string;
  type: 'switch' | 'plate' | 'case' | 'foam';
  name: string;
  material: string;
  acousticDescription: string;
  soundProfile: SoundProfile;
  specs: Record<string, unknown>;
}

export const HARDWARE_CATALOG: HardwareCatalogItem[] = [
  // ============================================================================
  // 1. SWITCHES (Các dòng switch nổi tiếng đại diện cho các phong cách âm học)
  // ============================================================================
  {
    id: 'switch-gateron-oil-king',
    type: 'switch',
    name: 'Gateron Oil King',
    material: 'Nylon Top / INK Bottom / POM Stem',
    acousticDescription:
      'Switch linear cao cấp với chất âm Deep Thock cực kỳ trầm ấm và đặc quánh. Nhờ housing nylon pha đặc biệt kết hợp đáy INK đen và lube nhà máy chuẩn xác, Oil King triệt tiêu hoàn toàn tiếng ping lá đồng và tạp âm high-pitch, tạo nên tiếng gõ chắc nịch, đầm và tròn tiếng.',
    soundProfile: {
      pitchMultiplier: 0.82,
      damping: 0.85,
      resonance: 1.35,
      label: 'Deep Thock',
    },
    specs: {
      switchType: 'linear',
      actuationForce: 55,
      bottomOutForce: 80,
      preTravel: 2.0,
      totalTravel: 4.0,
      factoryLubed: true,
      soundSignature: 'deep_thock',
    },
  },
  {
    id: 'switch-cherry-mx-black',
    type: 'switch',
    name: 'Cherry MX Black (Hyperglide)',
    material: 'Full Nylon Housing / POM Stem',
    acousticDescription:
      'Huyền thoại switch linear cổ điển chuẩn mực của âm Clack. Vỏ nylon cổ điển tạo ra tiếng va chạm dứt khoát, âm gõ đanh giòn, sáng rõ, tách bạch từng phím bấm. Khi kết hợp với plate nhôm, cho ra tiếng Clack sắc bén đặc trưng của bàn phím cơ retro cao cấp.',
    soundProfile: {
      pitchMultiplier: 1.25,
      damping: 0.65,
      resonance: 1.15,
      label: 'Classic Clack',
    },
    specs: {
      switchType: 'linear',
      actuationForce: 60,
      bottomOutForce: 80,
      preTravel: 2.0,
      totalTravel: 4.0,
      soundSignature: 'clack',
    },
  },
  {
    id: 'switch-boba-u4t',
    type: 'switch',
    name: 'Gazzew Boba U4T',
    material: 'Boba Plastic Blend / Long Pole POM Stem',
    acousticDescription:
      'Switch tactile đỉnh cao của phong cách Thocky Pop. Thiết kế stem dài (long-pole) chạm đáy sớm cùng khấc tactile chữ D mượt mà tạo nên âm thanh gõ bùng nổ, tiếng "thock" giòn tan, chắc khỏe và có độ nảy rõ rệt khi nhả phím.',
    soundProfile: {
      pitchMultiplier: 0.95,
      damping: 0.75,
      resonance: 1.4,
      label: 'Thocky Pop',
    },
    specs: {
      switchType: 'tactile',
      actuationForce: 62,
      bottomOutForce: 68,
      preTravel: 2.0,
      totalTravel: 3.2,
      stemStyle: 'long-pole',
      soundSignature: 'thocky_pop',
    },
  },
  {
    id: 'switch-holy-panda',
    type: 'switch',
    name: 'Drop + Invyr Holy Panda',
    material: 'Invyr Housing / Halo Stem',
    acousticDescription:
      'Tượng đài switch tactile với khấc nảy gắt và âm thanh Crisp Snappy Clack đặc trưng. Âm va đập ở đáy sắc sảo, dội âm vang dứt khoát mang đến sự phấn khích tột độ cho người gõ thích cảm giác cơ học mãnh liệt.',
    soundProfile: {
      pitchMultiplier: 1.18,
      damping: 0.68,
      resonance: 1.25,
      label: 'Crisp Clack',
    },
    specs: {
      switchType: 'tactile',
      actuationForce: 67,
      bottomOutForce: 67,
      preTravel: 2.0,
      totalTravel: 3.3,
      soundSignature: 'crisp_clack',
    },
  },
  {
    id: 'switch-kailh-box-white',
    type: 'switch',
    name: 'Kailh Box White',
    material: 'Polycarbonate / POM Stem / Click Bar',
    acousticDescription:
      'Switch clicky hiện đại sử dụng cơ chế Click Bar độc quyền. Tiếng click phát ra cả khi nhấn xuống lẫn khi nhả lên, âm thanh thanh thoát, trong trẻo như tiếng tinh thể pha lê va chạm, không bị chói tai hay rè như click-jacket truyền thống.',
    soundProfile: {
      pitchMultiplier: 1.35,
      damping: 0.55,
      resonance: 1.45,
      label: 'Crisp Clicky',
    },
    specs: {
      switchType: 'clicky',
      actuationForce: 45,
      bottomOutForce: 55,
      preTravel: 1.8,
      totalTravel: 3.6,
      mechanism: 'click_bar',
      soundSignature: 'crisp_clicky',
    },
  },
  {
    id: 'switch-gazzew-boba-u4-silent',
    type: 'switch',
    name: 'Gazzew Boba U4 (Silent Tactile)',
    material: 'Boba Plastic / Silicone Padded Stem',
    acousticDescription:
      'Switch khấc giảm chấn triệt để (Silent Tactile). Đệm silicone ở hai đầu stem hấp thụ hoàn toàn xung lực va chạm khi chạm đáy và nảy về, tạo âm thanh siêu êm ái như hạt mưa rơi nhẹ trên kính, phù hợp tuyệt đối cho môi trường văn phòng và làm việc ban đêm.',
    soundProfile: {
      pitchMultiplier: 0.88,
      damping: 0.95,
      resonance: 0.45,
      label: 'Silent Muted',
    },
    specs: {
      switchType: 'silent_linear',
      actuationForce: 62,
      bottomOutForce: 68,
      noiseLevelDb: 28,
      soundSignature: 'silent_muted',
    },
  },
  {
    id: 'switch-outemu-silent-peach',
    type: 'switch',
    name: 'Outemu Silent Peach V3',
    material: 'Nylon Housing / POM Stem / Silicone Ring',
    acousticDescription:
      'Switch linear siêu êm giá quốc dân (Whisper Quiet). Cấu trúc giảm chấn kép giúp triệt tiêu trên 90% biên độ sóng âm, âm gõ êm mượt, không gây tiếng click hay tiếng dội buồng phím.',
    soundProfile: {
      pitchMultiplier: 0.9,
      damping: 0.96,
      resonance: 0.4,
      label: 'Whisper Silent',
    },
    specs: {
      switchType: 'silent_linear',
      actuationForce: 40,
      bottomOutForce: 50,
      noiseLevelDb: 25,
      soundSignature: 'whisper_silent',
    },
  },
  {
    id: 'switch-gateron-milky-yellow',
    type: 'switch',
    name: 'Gateron Milky Yellow Pro',
    material: 'Proprietary Milky Plastic Blend / POM Stem',
    acousticDescription:
      'Switch linear quốc dân trứ danh với âm thanh Creamy Thock ấm áp và êm dịu. Chất liệu nhựa Milky độc quyền đem lại cảm giác gõ mượt mà tự nhiên cùng âm gõ trầm đều đặc, không đanh gắt.',
    soundProfile: {
      pitchMultiplier: 0.92,
      damping: 0.8,
      resonance: 1.2,
      label: 'Creamy Thock',
    },
    specs: {
      switchType: 'linear',
      actuationForce: 50,
      bottomOutForce: 62,
      preTravel: 2.0,
      totalTravel: 4.0,
      soundSignature: 'creamy_thock',
    },
  },

  // ============================================================================
  // 2. PLATES (Tấm định vị switch quyết định độ vang và cao độ va đập)
  // ============================================================================
  {
    id: 'plate-pom',
    type: 'plate',
    name: 'POM Plate (Polyoxymethylene 1.5mm)',
    material: 'POM',
    acousticDescription:
      'Tấm plate số 1 cho người mê âm Thock trầm sâu. Vật liệu POM có tính đàn hồi cao và mật độ hấp thụ dao động cao tần tuyệt vời, biến mọi cú gõ thành tiếng "thock" sâu thẳm, mềm tay và êm dịu.',
    soundProfile: {
      pitchMultiplier: 0.85,
      damping: 0.88,
      resonance: 1.25,
      label: 'Deep Thock',
    },
    specs: {
      thicknessMm: 1.5,
      flexLevel: 'high',
      soundTendency: 'deep_thock',
    },
  },
  {
    id: 'plate-fr4',
    type: 'plate',
    name: 'FR4 Plate (Sợi Thủy Tinh Mạ Đồng 1.2mm)',
    material: 'FR4 Epoxy Glass',
    acousticDescription:
      'Chất liệu cấu tạo tương tự bo mạch PCB, mang đến độ nhún vừa vặn và âm thanh cân bằng tuyệt đối giữa Clack và Thock. Âm thanh tròn, chắc, giòn tan (Poppy) và không bị đanh gắt.',
    soundProfile: {
      pitchMultiplier: 1.0,
      damping: 0.78,
      resonance: 1.18,
      label: 'Balanced Poppy',
    },
    specs: {
      thicknessMm: 1.2,
      flexLevel: 'medium',
      soundTendency: 'balanced_poppy',
    },
  },
  {
    id: 'plate-aluminum',
    type: 'plate',
    name: 'Aluminum Plate (Nhôm Anodized 1.5mm)',
    material: 'Aluminum 6063',
    acousticDescription:
      'Plate kim loại nhôm cho độ cứng cáp vượt trội, phản hồi phím tức thì và âm thanh Clack đanh giòn, sáng rõ. Rất thích hợp cho người gõ thích âm sắc kim loại sáng, dứt khoát và chơi game tốc độ cao.',
    soundProfile: {
      pitchMultiplier: 1.28,
      damping: 0.62,
      resonance: 1.32,
      label: 'Bright Clack',
    },
    specs: {
      thicknessMm: 1.5,
      flexLevel: 'stiff',
      soundTendency: 'bright_clack',
    },
  },
  {
    id: 'plate-polycarbonate',
    type: 'plate',
    name: 'Polycarbonate Plate (PC Mờ 1.5mm)',
    material: 'Polycarbonate',
    acousticDescription:
      'Plate nhựa PC mềm dẻo mang lại cảm giác gõ êm ái đàn hồi cao, tản sáng LED RGB tuyệt đẹp và chất âm trầm ấm, đầm chắc (Classic Thock).',
    soundProfile: {
      pitchMultiplier: 0.88,
      damping: 0.84,
      resonance: 1.15,
      label: 'Soft Thock',
    },
    specs: {
      thicknessMm: 1.5,
      flexLevel: 'ultra_high',
      soundTendency: 'soft_thock',
    },
  },

  // ============================================================================
  // 3. CASE & FOAM (Vỏ bàn phím và các lớp tiêu âm / tán âm buồng rỗng)
  // ============================================================================
  {
    id: 'foam-poron-sheet',
    type: 'foam',
    name: 'Poron PCB & Case Foam (Mút Tiêu Âm Cao Cấp)',
    material: 'High-density Poron Urethane',
    acousticDescription:
      'Mút xốp Poron mật độ phân tử cao lót giữa PCB và đáy vỏ, hấp thụ hoàn toàn sóng âm phản xạ trong khoang rỗng. Làm biến mất hoàn toàn tiếng vang kim loại, biến âm gõ trở nên tập trung, đầm đặc và sạch sẽ.',
    soundProfile: {
      pitchMultiplier: 0.9,
      damping: 0.95,
      resonance: 0.8,
      label: 'Focused Damped',
    },
    specs: {
      density: 'high',
      thicknessMm: 3.5,
      soundEffect: 'eliminate_hollow_echo',
    },
  },
  {
    id: 'foam-ixpe-switch-pad',
    type: 'foam',
    name: 'IXPE Switch Pad 0.5mm',
    material: 'Irradiated Cross-linked Polyethylene',
    acousticDescription:
      'Tấm đệm IXPE dán trực tiếp trên mặt PCB tại chân switch. Tạo hiệu ứng âm học "Marbly / Raindrop" nổi tiếng, làm tiếng gõ giòn tan như những viên bi cẩm thạch gõ vào nhau.',
    soundProfile: {
      pitchMultiplier: 1.12,
      damping: 0.72,
      resonance: 1.38,
      label: 'Marbly Raindrop',
    },
    specs: {
      thicknessMm: 0.5,
      soundEffect: 'marbly_raindrop',
    },
  },
  {
    id: 'case-aluminum-cnc',
    type: 'case',
    name: 'Aluminum CNC 6063 Case',
    material: 'Solid Aluminum 6063',
    acousticDescription:
      'Vỏ nhôm CNC nguyên khối nặng từ 1.5kg - 2.5kg, mang lại sự đầm chắc tuyệt đối trên bàn làm việc. Khối kim loại dày giảm thiểu rung chấn và cộng hưởng vỏ, cho âm thanh tập trung, chắc nịch.',
    soundProfile: {
      pitchMultiplier: 1.1,
      damping: 0.8,
      resonance: 1.1,
      label: 'Solid Metallic',
    },
    specs: {
      manufacturing: '5-axis CNC Machining',
      weightKg: 1.8,
      anodized: true,
    },
  },

  // ============================================================================
  // 4. LINH KIỆN TRONG THƯ VIỆN BUILD PHÍM THẬT (src/lib/keyboard/builds.ts)
  // Chỉ ghi thông số đã xác minh từ trang hãng/shop/review; soundProfile tính bằng
  // cùng mô hình với store (calculateSoundProfile) theo loại switch/plate, không phải số đo thật.
  // ============================================================================
  {
    id: 'switch-kailh-cocoa',
    type: 'switch',
    name: 'Kailh Cocoa',
    material: 'Không công bố trong nguồn đã tra',
    acousticDescription:
      'Switch linear lube sẵn, là switch stock của WOBKEY Rainy75 Pro và Crush 80 Reboot Pro (plate FR4). Tom’s Hardware đánh giá Crush 80 Reboot Pro với Cocoa nghe còn hay hơn Rainy75 Pro.',
    soundProfile: calculateSoundProfile('fr4', 'linear'),
    specs: { switchType: 'linear', actuationForce: 45, preTravel: 2.0, totalTravel: 3.6, factoryLubed: true },
  },
  {
    id: 'switch-hmx-violet',
    type: 'switch',
    name: 'HMX Violet',
    material: 'Không công bố trong nguồn đã tra',
    acousticDescription: 'Switch linear stock của WOBKEY Rainy75 bản Lite và Standard (plate PP).',
    soundProfile: calculateSoundProfile('polycarbonate', 'linear'),
    specs: { switchType: 'linear' },
  },
  {
    id: 'switch-sc-princess',
    type: 'switch',
    name: 'Shortcut Studio Princess',
    material: 'Không công bố trong nguồn đã tra',
    acousticDescription:
      'Switch linear nhẹ (42g kích hoạt, 48g chạm đáy), stock của Shortcut Studio Bridge75; bản Plus/Max lắp trên plate FR4 flex-cut.',
    soundProfile: calculateSoundProfile('fr4', 'linear'),
    specs: { switchType: 'linear', actuationForce: 42, bottomOutForce: 48, totalTravel: 3.6 },
  },
  {
    id: 'switch-gateron-jupiter-banana',
    type: 'switch',
    name: 'Gateron Jupiter Banana',
    material: 'Vỏ trên PC, vỏ dưới Nylon, stem POM',
    acousticDescription:
      'Switch tactile lò xo hai tầng, là một lựa chọn stock của Keychron Q1 Max (plate PC, double-gasket).',
    soundProfile: calculateSoundProfile('polycarbonate', 'tactile'),
    specs: { switchType: 'tactile', actuationForce: 59, preTravel: 2.0, totalTravel: 3.4 },
  },
  {
    id: 'switch-gateron-double-rail-magnetic',
    type: 'switch',
    name: 'Gateron Double-Rail Magnetic',
    material: 'Không công bố trong nguồn đã tra',
    acousticDescription:
      'Switch từ Hall Effect của Keychron K2 HE: chỉnh được điểm kích hoạt 0.2–3.8mm, hỗ trợ Rapid Trigger, hợp chơi game cần phản hồi nhanh.',
    soundProfile: calculateSoundProfile('aluminum', 'linear'),
    specs: { switchType: 'hall_effect_linear', adjustableActuation: '0.2-3.8mm', rapidTrigger: true },
  },
  {
    id: 'switch-lekker-linear',
    type: 'switch',
    name: 'Wooting Lekker (L45 / L60 V2)',
    material: 'Không công bố trong nguồn đã tra',
    acousticDescription:
      'Switch Hall Effect linear của Wooting 80HE (stock: Lekker L60 V2; bản thu âm dùng Lekker Linear45 V2), lắp trên plate PC với pad silicone, gasket mount.',
    soundProfile: calculateSoundProfile('polycarbonate', 'linear'),
    specs: { switchType: 'hall_effect_linear' },
  },
  {
    id: 'switch-nuphy-raspberry',
    type: 'switch',
    name: 'NuPhy Raspberry',
    material: 'Không công bố trong nguồn đã tra',
    acousticDescription: 'Switch linear của NuPhy (dòng hợp tác với Gateron), là một lựa chọn stock của NuPhy Halo75 V2.',
    soundProfile: calculateSoundProfile('pom', 'linear'),
    specs: { switchType: 'linear' },
  },
  {
    id: 'plate-pp',
    type: 'plate',
    name: 'PP Plate (Polypropylene)',
    material: 'Polypropylene',
    acousticDescription:
      'Plate nhựa polypropylene, dùng trên WOBKEY Rainy75 Lite/Standard và Crush 80 Lite (bản Pro của hai mẫu này đổi sang FR4).',
    // Nhựa mềm như PC/POM: dùng tham số plate PC của mô hình âm thanh làm gần đúng
    soundProfile: calculateSoundProfile('polycarbonate', 'linear'),
    specs: { material: 'polypropylene' },
  },
];
