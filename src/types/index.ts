export type AllergyStatus = 'あり' | 'なし' | '未確認';

export interface Resident {
  id: string;
  name: string;
  furigana: string;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  gender: '男性' | '女性';
  birthDate: Date;
  roomNumber: string;
  admissionDate: Date;
  dischargeDate?: Date;
  medicalHistory: string;
  allergyStatus?: AllergyStatus;
  allergies?: string;
  careLevel?: 1 | 2 | 3 | 4 | 5;
  createdBy?: RecordAuthor;
  updatedBy?: RecordAuthor;
  deletedAt?: Date;
  deletedBy?: RecordAuthor;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecordAuthor {
  uid: string;
  name: string;   // displayName または email
}

export interface MedicalRecord {
  id: string;
  residentId: string;
  date: Date;
  record: string;
  createdBy?: RecordAuthor;
  updatedBy?: RecordAuthor;
  deletedAt?: Date;
  deletedBy?: RecordAuthor;
  createdAt: Date;
  updatedAt: Date;
}

// 診療録の訂正履歴（編集前スナップショット。追記のみ・不変）
export interface MedicalRecordRevision {
  id: string;
  date: Date;
  record: string;
  editedBy?: RecordAuthor;
  editedAt: Date;
}

export interface ResidentFormData {
  name: string;
  furigana: string;
  gender: '男性' | '女性';
  birthDate: string;
  roomNumber: string;
  admissionDate: string;
  dischargeDate?: string;
  medicalHistory: string;
  allergyStatus?: AllergyStatus;
  allergies?: string;
  careLevel?: 1 | 2 | 3 | 4 | 5;
}

export interface MedicalRecordFormData {
  date: string;
  record: string;
}

export type MedicationRoute = '経口' | '外用' | '貼付' | '注射' | 'その他';
export type MedicationType = '定期' | '頓用';

export interface Medication {
  id: string;
  residentId: string;
  name: string;          // 薬剤名（例：アムロジピン錠5mg）
  dosage: string;        // 1回量（例：1錠 / 5mg）
  frequency: string;     // 用法（例：1日2回 朝夕食後）
  route: MedicationRoute; // 経路
  type: MedicationType;   // 定期 / 頓用
  startDate: Date;        // 開始日
  endDate?: Date;         // 中止日（未設定なら継続中）
  notes?: string;         // 備考（頓用条件など）
  yjCode?: string;        // 個別医薬品(YJ)コード（薬剤マスター由来）
  hotCode?: string;       // 医薬品HOTコード
  createdBy?: RecordAuthor;
  updatedBy?: RecordAuthor;
  createdAt: Date;
  updatedAt: Date;
}

export interface MedicationFormData {
  name: string;
  dosage: string;
  frequency: string;
  route: MedicationRoute;
  type: MedicationType;
  startDate: string;      // 'YYYY-MM-DD'
  endDate?: string;
  notes?: string;
  yjCode?: string;
  hotCode?: string;
}

// 医薬品マスター1件（drugMaster コレクション）
export interface DrugMasterItem {
  id: string;
  name: string;   // 販売名（例：アムロジピン錠5mg）
  kana?: string;
  yjCode?: string;
  hotCode?: string;
}

// バイタルサイン（residents/{id}/vitals サブコレクション）。1レコード=測定1回分。
// 各測定項目は任意（その回に測ったものだけ記録する）。時系列の測定値として保持し、
// 将来の検査結果も同じ器で扱えるようにする。
export interface VitalSign {
  id: string;
  residentId: string;
  measuredAt: Date;        // 測定日時
  temperature?: number;    // 体温 ℃
  systolicBP?: number;     // 収縮期血圧 mmHg
  diastolicBP?: number;    // 拡張期血圧 mmHg
  pulse?: number;          // 脈拍 /分
  spo2?: number;           // SpO₂ %
  weight?: number;         // 体重 kg
  bloodGlucose?: number;   // 血糖 mg/dL（任意）
  notes?: string;          // 備考（測定条件・特記事項）
  createdBy?: RecordAuthor;
  updatedBy?: RecordAuthor;
  deletedAt?: Date;
  deletedBy?: RecordAuthor;
  createdAt: Date;
  updatedAt: Date;
}

export interface VitalSignFormData {
  measuredAt: string;      // 'YYYY-MM-DDTHH:mm'
  temperature?: string;
  systolicBP?: string;
  diastolicBP?: string;
  pulse?: string;
  spo2?: string;
  weight?: string;
  bloodGlucose?: string;
  notes?: string;
}

// プロブレムリスト（POMR）— residents/{id}/problems サブコレクション。
// 問題を番号付きで管理し、現行/消失で状態を持つ。真正性のため論理削除＋監査。
export type ProblemStatus = '現行' | '消失';

export interface Problem {
  id: string;
  residentId: string;
  number: number;          // 問題番号（#1, #2 ...）。消失後も番号は保持
  title: string;           // 問題名（病名。病名マスター由来 or 自由入力）
  icd10?: string;          // ICD-10 コード（病名マスター由来）
  status: ProblemStatus;
  onsetDate?: Date;        // 発症・認知日
  resolvedDate?: Date;     // 消失日（status が消失のとき）
  notes?: string;
  createdBy?: RecordAuthor;
  updatedBy?: RecordAuthor;
  deletedAt?: Date;
  deletedBy?: RecordAuthor;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProblemFormData {
  number: string;          // 入力は文字列
  title: string;
  icd10?: string;
  status: ProblemStatus;
  onsetDate?: string;      // 'YYYY-MM-DD'
  resolvedDate?: string;
  notes?: string;
}

// 病名マスター1件（diseaseMaster コレクション。MEDIS 標準病名マスター等由来）
export interface DiseaseMasterItem {
  id: string;
  name: string;            // 病名（例: 高血圧症）
  kana?: string;
  icd10?: string;          // ICD-10 コード（例: I10）
}