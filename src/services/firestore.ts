import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  type FieldValue
} from 'firebase/firestore';
import dayjs from 'dayjs';
import { db } from '../firebase';
import { logger } from './logger';
import type { Resident, MedicalRecord, ResidentFormData, MedicalRecordFormData } from '../types';

export const COLLECTIONS = {
  RESIDENTS: 'residents',
  MEDICAL_RECORDS: 'medicalRecords'
} as const;

const convertTimestampToDate = (timestamp: unknown): Date => {
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
    return (timestamp as { toDate: () => Date }).toDate();
  }
  return new Date(timestamp as string | number | Date);
};

const convertResidentData = (id: string, data: Record<string, unknown>): Resident => {
  const name = String(data.name || '');
  const furigana = String(data.furigana || '');

  return {
    id,
    name,
    furigana,
    lastName: String(data.lastName || name.split(' ')[0] || ''),
    firstName: String(data.firstName || name.split(' ')[1] || ''),
    lastNameKana: String(data.lastNameKana || furigana.split(' ')[0] || ''),
    firstNameKana: String(data.firstNameKana || furigana.split(' ')[1] || ''),
    gender: data.gender as '男性' | '女性',
    birthDate: convertTimestampToDate(data.birthDate),
    roomNumber: String(data.roomNumber || ''),
    admissionDate: convertTimestampToDate(data.admissionDate),
    dischargeDate: data.dischargeDate ? convertTimestampToDate(data.dischargeDate) : undefined,
    medicalHistory: String(data.medicalHistory || ''),
    medications: Array.isArray(data.medications) ? data.medications.map(String) : [],
    careLevel: data.careLevel as 1 | 2 | 3 | 4 | 5,
    createdAt: convertTimestampToDate(data.createdAt),
    updatedAt: convertTimestampToDate(data.updatedAt)
  };
};

const convertMedicalRecordData = (id: string, data: Record<string, unknown>): MedicalRecord => ({
  id,
  residentId: String(data.residentId || ''),
  date: convertTimestampToDate(data.date),
  record: String(data.record || ''),
  createdAt: convertTimestampToDate(data.createdAt),
  updatedAt: convertTimestampToDate(data.updatedAt)
});

export const residentService = {
  async getAll(): Promise<Resident[]> {
    try {
      logger.debug('Fetching all residents', {
        component: 'firestore',
        action: 'get_all_residents'
      });

      const querySnapshot = await getDocs(
        query(collection(db, COLLECTIONS.RESIDENTS), orderBy('name'))
      );

      const residents = querySnapshot.docs.map(doc => convertResidentData(doc.id, doc.data()));

      logger.info('Successfully fetched residents', {
        component: 'firestore',
        action: 'get_all_residents',
        count: residents.length
      });

      return residents;
    } catch (error) {
      logger.firestoreError('Failed to fetch all residents', error as Error, {
        action: 'get_all_residents'
      });
      throw error;
    }
  },

  async getById(id: string): Promise<Resident | null> {
    const docSnap = await getDoc(doc(db, COLLECTIONS.RESIDENTS, id));
    if (docSnap.exists()) {
      return convertResidentData(docSnap.id, docSnap.data());
    }
    return null;
  },

  async create(data: ResidentFormData): Promise<string> {
    try {
      logger.info('Creating new resident', {
        component: 'firestore',
        action: 'create_resident',
        residentName: data.name,
        roomNumber: data.roomNumber
      });

      const now = Timestamp.now();
      const nameParts = data.name.split(' ');
      const furiganaParts = data.furigana.split(' ');

      const docRef = await addDoc(collection(db, COLLECTIONS.RESIDENTS), {
        name: data.name,
        furigana: data.furigana,
        lastName: nameParts[0] || '',
        firstName: nameParts[1] || '',
        lastNameKana: furiganaParts[0] || '',
        firstNameKana: furiganaParts[1] || '',
        gender: data.gender,
        birthDate: Timestamp.fromDate(new Date(data.birthDate)),
        roomNumber: data.roomNumber,
        admissionDate: Timestamp.fromDate(new Date(data.admissionDate)),
        dischargeDate: data.dischargeDate ? Timestamp.fromDate(new Date(data.dischargeDate)) : null,
        medicalHistory: data.medicalHistory,
        medications: data.medications,
        careLevel: data.careLevel,
        createdAt: now,
        updatedAt: now
      });

      logger.userAction('resident_created', {
        component: 'firestore',
        residentId: docRef.id,
        residentName: data.name
      });

      return docRef.id;
    } catch (error) {
      logger.firestoreError('Failed to create resident', error as Error, {
        action: 'create_resident',
        residentName: data.name
      });
      throw error;
    }
  },

  async update(id: string, data: Partial<ResidentFormData>): Promise<void> {
    const updateData: Record<string, FieldValue | string | number | string[] | Date | null> = {
      updatedAt: Timestamp.now()
    };

    if (data.name !== undefined) {
      updateData.name = data.name;
      const nameParts = data.name.split(' ');
      updateData.lastName = nameParts[0] || '';
      updateData.firstName = nameParts[1] || '';
    }
    if (data.furigana !== undefined) {
      updateData.furigana = data.furigana;
      const furiganaParts = data.furigana.split(' ');
      updateData.lastNameKana = furiganaParts[0] || '';
      updateData.firstNameKana = furiganaParts[1] || '';
    }
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.birthDate !== undefined) updateData.birthDate = Timestamp.fromDate(new Date(data.birthDate));
    if (data.roomNumber !== undefined) updateData.roomNumber = data.roomNumber;
    if (data.admissionDate !== undefined) updateData.admissionDate = Timestamp.fromDate(new Date(data.admissionDate));
    if (data.dischargeDate !== undefined) {
      updateData.dischargeDate = data.dischargeDate ? Timestamp.fromDate(new Date(data.dischargeDate)) : null;
    }
    if (data.medicalHistory !== undefined) updateData.medicalHistory = data.medicalHistory;
    if (data.medications !== undefined) {
      updateData.medications = data.medications;
    }
    if (data.careLevel !== undefined) updateData.careLevel = data.careLevel;

    await updateDoc(doc(db, COLLECTIONS.RESIDENTS, id), updateData);
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.RESIDENTS, id));
  },

  // ひらがな→カタカナ変換
  convertHiraganaToKatakana(str: string): string {
    return str.replace(/[\u3041-\u3096]/g, function(match) {
      const chr = match.charCodeAt(0) + 0x60;
      return String.fromCharCode(chr);
    });
  },

  // カタカナ→ひらがな変換
  convertKatakanaToHiragana(str: string): string {
    return str.replace(/[\u30a1-\u30f6]/g, function(match) {
      const chr = match.charCodeAt(0) - 0x60;
      return String.fromCharCode(chr);
    });
  },

  async searchByName(name: string): Promise<Resident[]> {
    const searchTerm = name.trim();
    if (!searchTerm) return [];

    try {
      logger.debug('Searching residents by name', {
        component: 'firestore',
        action: 'search_by_name',
        searchTerm
      });

      // カタカナとひらがなの両方で検索
      const katakanaSearch = this.convertHiraganaToKatakana(searchTerm);

      const queries = [
      // フルネーム検索
      query(
        collection(db, COLLECTIONS.RESIDENTS),
        where('name', '>=', searchTerm),
        where('name', '<=', searchTerm + '\uf8ff')
      ),
      // 姓での検索
      query(
        collection(db, COLLECTIONS.RESIDENTS),
        where('lastName', '>=', searchTerm),
        where('lastName', '<=', searchTerm + '\uf8ff')
      ),
      // 名での検索
      query(
        collection(db, COLLECTIONS.RESIDENTS),
        where('firstName', '>=', searchTerm),
        where('firstName', '<=', searchTerm + '\uf8ff')
      ),
      // フリガナ検索（カタカナ）
      query(
        collection(db, COLLECTIONS.RESIDENTS),
        where('furigana', '>=', katakanaSearch),
        where('furigana', '<=', katakanaSearch + '\uf8ff')
      ),
      // 姓フリガナ検索
      query(
        collection(db, COLLECTIONS.RESIDENTS),
        where('lastNameKana', '>=', katakanaSearch),
        where('lastNameKana', '<=', katakanaSearch + '\uf8ff')
      ),
      // 名フリガナ検索
      query(
        collection(db, COLLECTIONS.RESIDENTS),
        where('firstNameKana', '>=', katakanaSearch),
        where('firstNameKana', '<=', katakanaSearch + '\uf8ff')
      )
      ];

      const results = await Promise.all(queries.map(q => getDocs(q)));
      const allResidents = new Map<string, Resident>();

      results.forEach(querySnapshot => {
        querySnapshot.docs.forEach(doc => {
          const resident = convertResidentData(doc.id, doc.data());
          allResidents.set(resident.id, resident);
        });
      });

      const searchResults = Array.from(allResidents.values()).sort((a, b) => a.name.localeCompare(b.name));

      logger.info('Search completed', {
        component: 'firestore',
        action: 'search_by_name',
        searchTerm,
        resultCount: searchResults.length
      });

      return searchResults;
    } catch (error) {
      logger.firestoreError('Search by name failed', error as Error, {
        action: 'search_by_name',
        searchTerm
      });
      throw error;
    }
  },

  async getByRoomNumber(roomNumber: string): Promise<Resident[]> {
    const q = query(
      collection(db, COLLECTIONS.RESIDENTS),
      where('roomNumber', '==', roomNumber)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => convertResidentData(doc.id, doc.data()));
  },

  async getByCareLevel(careLevel: number): Promise<Resident[]> {
    const q = query(
      collection(db, COLLECTIONS.RESIDENTS),
      where('careLevel', '==', careLevel),
      orderBy('name')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => convertResidentData(doc.id, doc.data()));
  },

  async getByMedication(medication: string): Promise<Resident[]> {
    const searchTerm = medication.trim();
    if (!searchTerm) return [];

    const q = query(
      collection(db, COLLECTIONS.RESIDENTS),
      where('medications', 'array-contains', searchTerm),
      orderBy('name')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => convertResidentData(doc.id, doc.data()));
  }
};

export const medicalRecordService = {
  async getByResidentId(residentId: string): Promise<MedicalRecord[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.MEDICAL_RECORDS),
        where('residentId', '==', residentId)
      );
      const querySnapshot = await getDocs(q);
      const records = querySnapshot.docs.map(doc => {
        return convertMedicalRecordData(doc.id, doc.data());
      });
      return records.sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());
    } catch {
      return [];
    }
  },

  async checkExistingRecord(residentId: string, date: string): Promise<MedicalRecord | null> {
    try {
      const targetDate = dayjs(date).format('YYYY-MM-DD');
      const q = query(
        collection(db, COLLECTIONS.MEDICAL_RECORDS),
        where('residentId', '==', residentId)
      );
      const querySnapshot = await getDocs(q);

      for (const doc of querySnapshot.docs) {
        const recordData = doc.data();
        const recordDate = dayjs(recordData.date.toDate()).format('YYYY-MM-DD');
        if (recordDate === targetDate) {
          return convertMedicalRecordData(doc.id, recordData);
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  async create(residentId: string, data: MedicalRecordFormData): Promise<string> {

    // 同一日付のレコードが既に存在するかチェック
    const existingRecord = await this.checkExistingRecord(residentId, data.date);
    if (existingRecord) {
      throw new Error(`${dayjs(data.date).format('YYYY年MM月DD日')}の診療録は既に存在します。既存の記録を編集してください。`);
    }

    const now = Timestamp.now();
    const docData = {
      residentId,
      date: Timestamp.fromDate(new Date(data.date)),
      record: data.record,
      createdAt: now,
      updatedAt: now
    };
    const docRef = await addDoc(collection(db, COLLECTIONS.MEDICAL_RECORDS), docData);
    return docRef.id;
  },

  async update(id: string, data: Partial<MedicalRecordFormData>): Promise<void> {
    const updateData: Record<string, FieldValue | string | Date> = {
      updatedAt: Timestamp.now()
    };

    if (data.date !== undefined) updateData.date = Timestamp.fromDate(new Date(data.date));
    if (data.record !== undefined) updateData.record = data.record;

    await updateDoc(doc(db, COLLECTIONS.MEDICAL_RECORDS, id), updateData);
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.MEDICAL_RECORDS, id));
  }
};