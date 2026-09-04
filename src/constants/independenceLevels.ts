// 日常生活自立度のランク（厚労省判定基準）。フォームの選択肢に使う。'' は未評価。
// 臨床分類のため各ランク値はそのまま表示（UI 文言のみ i18n 管理）。
export const PHYSICAL_INDEPENDENCE_RANKS = ['J1', 'J2', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const DEMENTIA_INDEPENDENCE_RANKS = ['自立', 'I', 'IIa', 'IIb', 'IIIa', 'IIIb', 'IV', 'M'] as const;
