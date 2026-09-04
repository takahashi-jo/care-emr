// 検査項目マスター（老健で頻用する基本項目）。基準値は一般成人の代表的な参考値で、
// 施設・性別・年齢で異なるため、入力時は各項目の下限/上限を編集できる（既定値として使う）。
// 基準値外（下限未満・上限超過）を表示で赤く強調する。将来は施設別マスターに置換可能。
export interface LabAnalyte {
  code: string;
  name: string;
  unit?: string;
  refLow?: number;
  refHigh?: number;
}

export const LAB_ANALYTES: LabAnalyte[] = [
  { code: 'WBC', name: '白血球数 (WBC)', unit: '×10³/µL', refLow: 3.3, refHigh: 8.6 },
  { code: 'RBC', name: '赤血球数 (RBC)', unit: '×10⁶/µL', refLow: 4.0, refHigh: 5.5 },
  { code: 'Hb', name: 'ヘモグロビン (Hb)', unit: 'g/dL', refLow: 11.6, refHigh: 16.8 },
  { code: 'Plt', name: '血小板数 (Plt)', unit: '×10⁴/µL', refLow: 15.8, refHigh: 34.8 },
  { code: 'TP', name: '総蛋白 (TP)', unit: 'g/dL', refLow: 6.6, refHigh: 8.1 },
  { code: 'Alb', name: 'アルブミン (Alb)', unit: 'g/dL', refLow: 4.1, refHigh: 5.1 },
  { code: 'AST', name: 'AST', unit: 'U/L', refLow: 13, refHigh: 30 },
  { code: 'ALT', name: 'ALT', unit: 'U/L', refLow: 10, refHigh: 42 },
  { code: 'GGT', name: 'γ-GTP', unit: 'U/L', refLow: 13, refHigh: 64 },
  { code: 'TBil', name: '総ビリルビン (T-Bil)', unit: 'mg/dL', refLow: 0.4, refHigh: 1.5 },
  { code: 'BUN', name: '尿素窒素 (BUN)', unit: 'mg/dL', refLow: 8, refHigh: 20 },
  { code: 'Cr', name: 'クレアチニン (Cr)', unit: 'mg/dL', refLow: 0.46, refHigh: 1.07 },
  { code: 'eGFR', name: 'eGFR', unit: 'mL/min/1.73m²', refLow: 60 },
  { code: 'Na', name: 'ナトリウム (Na)', unit: 'mEq/L', refLow: 138, refHigh: 145 },
  { code: 'K', name: 'カリウム (K)', unit: 'mEq/L', refLow: 3.6, refHigh: 4.8 },
  { code: 'Cl', name: 'クロール (Cl)', unit: 'mEq/L', refLow: 101, refHigh: 108 },
  { code: 'CRP', name: 'CRP', unit: 'mg/dL', refHigh: 0.14 },
  { code: 'Glu', name: '血糖 (Glu)', unit: 'mg/dL', refLow: 73, refHigh: 109 },
  { code: 'HbA1c', name: 'HbA1c', unit: '%', refLow: 4.9, refHigh: 6.0 },
  { code: 'LDL', name: 'LDLコレステロール', unit: 'mg/dL', refHigh: 139 },
  { code: 'HDL', name: 'HDLコレステロール', unit: 'mg/dL', refLow: 40 },
  { code: 'TG', name: '中性脂肪 (TG)', unit: 'mg/dL', refLow: 30, refHigh: 149 },
];

export const LAB_ANALYTE_BY_CODE: Record<string, LabAnalyte> = Object.fromEntries(
  LAB_ANALYTES.map((a) => [a.code, a]),
);

// 基準値外の判定（下限未満・上限超過。基準値未設定側は判定しない）
export const isLabAbnormal = (value: number, refLow?: number, refHigh?: number): boolean =>
  (refLow != null && value < refLow) || (refHigh != null && value > refHigh);
