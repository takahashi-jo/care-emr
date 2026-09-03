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
  medications: string[];
  careLevel?: 1 | 2 | 3 | 4 | 5;
  createdAt: Date;
  updatedAt: Date;
}

export interface MedicalRecord {
  id: string;
  residentId: string;
  date: Date;
  record: string;
  createdAt: Date;
  updatedAt: Date;
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
  medications: string[];
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
}