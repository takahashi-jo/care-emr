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