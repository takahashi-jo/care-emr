// バイタルの「要注意（赤字）」判定に使う参考基準。
//
// 重要: これは診断ではなく、回診で気づきを促すための一般的な目安。単一の公的・法的な
// 基準値が定まっているわけではなく、施設・患者背景（高齢・COPD・β遮断薬内服など）で
// 適正域は変わる。将来は施設別/患者別に閾値を設定できるようにする前提で、ここに一元化する。
//
// 各項目の根拠の目安:
//  - 体温 : ≥ 37.5℃ を発熱（感染症法の発熱の定義に準拠）
//  - 血圧 : 収縮期 ≥ 140 または 拡張期 ≥ 90 を高値（高血圧治療ガイドライン JSH2019 の高血圧基準）、
//           収縮期 < 90 を低値（低血圧の目安）
//  - 脈拍 : > 100 頻脈 / < 50 明らかな徐脈（高齢・薬剤で低めのことが多いため保守的に 50）
//  - 呼吸数 : > 24 頻呼吸（呼吸不全・敗血症の early sign） / < 10 徐呼吸（呼吸抑制）
//  - SpO₂ : < 93% を要注意（室内気では 95% 以上が目安、90% 未満は呼吸不全域）
export const isVitalAbnormal = {
  temperature: (v: number) => v >= 37.5,
  spo2: (v: number) => v < 93,
  pulse: (v: number) => v < 50 || v > 100,
  respiratoryRate: (v: number) => v < 10 || v > 24,
  systolicBP: (v: number) => v >= 140 || v < 90,
  diastolicBP: (v: number) => v >= 90,
};

// 意識レベル（JCS: Japan Coma Scale）。'' は未評価、清明は正常。
// JCS II 桁以上（刺激しないと覚醒しない）を要注意として強調する。
export const JCS_LEVELS = ['清明', 'I-1', 'I-2', 'I-3', 'II-10', 'II-20', 'II-30', 'III-100', 'III-200', 'III-300'];
export const isConsciousnessAbnormal = (v?: string) => !!v && (v.startsWith('II') || v.startsWith('III'));
