import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  type FieldValue
} from 'firebase/firestore';
import dayjs from 'dayjs';
import { db } from '../firebase';
import { logger } from './logger';
import type { Resident, MedicalRecord, MedicalRecordRevision, RecordAuthor, Medication, DrugMasterItem, ResidentFormData, MedicalRecordFormData, MedicationFormData, AllergyStatus } from '../types';

export const COLLECTIONS = {
  RESIDENTS: 'residents',
  MEDICAL_RECORDS: 'medicalRecords',
  MEDICATIONS: 'medications',
  DRUG_MASTER: 'drugMaster',
  REVISIONS: 'revisions'
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
    allergyStatus: (data.allergyStatus as AllergyStatus) || (data.allergies ? 'あり' : '未確認'),
    allergies: data.allergies ? String(data.allergies) : undefined,
    careLevel: data.careLevel as 1 | 2 | 3 | 4 | 5,
    createdBy: (data.createdBy as RecordAuthor) || undefined,
    updatedBy: (data.updatedBy as RecordAuthor) || undefined,
    deletedAt: data.deletedAt ? convertTimestampToDate(data.deletedAt) : undefined,
    deletedBy: (data.deletedBy as RecordAuthor) || undefined,
    createdAt: convertTimestampToDate(data.createdAt),
    updatedAt: convertTimestampToDate(data.updatedAt)
  };
};

const convertMedicalRecordData = (id: string, data: Record<string, unknown>): MedicalRecord => ({
  id,
  residentId: String(data.residentId || ''),
  date: convertTimestampToDate(data.date),
  record: String(data.record || ''),
  createdBy: (data.createdBy as RecordAuthor) || undefined,
  updatedBy: (data.updatedBy as RecordAuthor) || undefined,
  deletedAt: data.deletedAt ? convertTimestampToDate(data.deletedAt) : undefined,
  deletedBy: (data.deletedBy as RecordAuthor) || undefined,
  createdAt: convertTimestampToDate(data.createdAt),
  updatedAt: convertTimestampToDate(data.updatedAt)
});

const convertRevisionData = (id: string, data: Record<string, unknown>): MedicalRecordRevision => ({
  id,
  date: convertTimestampToDate(data.date),
  record: String(data.record || ''),
  editedBy: (data.editedBy as RecordAuthor) || undefined,
  editedAt: convertTimestampToDate(data.editedAt),
});

const convertMedicationData = (residentId: string, id: string, data: Record<string, unknown>): Medication => ({
  id,
  residentId,
  name: String(data.name || ''),
  dosage: String(data.dosage || ''),
  frequency: String(data.frequency || ''),
  route: (data.route as Medication['route']) || '経口',
  type: (data.type as Medication['type']) || '定期',
  startDate: convertTimestampToDate(data.startDate),
  endDate: data.endDate ? convertTimestampToDate(data.endDate) : undefined,
  notes: String(data.notes || ''),
  yjCode: data.yjCode ? String(data.yjCode) : undefined,
  hotCode: data.hotCode ? String(data.hotCode) : undefined,
  createdBy: (data.createdBy as RecordAuthor) || undefined,
  updatedBy: (data.updatedBy as RecordAuthor) || undefined,
  createdAt: convertTimestampToDate(data.createdAt),
  updatedAt: convertTimestampToDate(data.updatedAt)
});

const convertDrugMasterData = (id: string, data: Record<string, unknown>): DrugMasterItem => ({
  id,
  name: String(data.name || ''),
  kana: data.kana ? String(data.kana) : undefined,
  yjCode: data.yjCode ? String(data.yjCode) : undefined,
  hotCode: data.hotCode ? String(data.hotCode) : undefined,
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

      const residents = querySnapshot.docs
        .map(doc => convertResidentData(doc.id, doc.data()))
        .filter(r => !r.deletedAt); // 論理削除は除外

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

  async create(data: ResidentFormData, author: RecordAuthor): Promise<string> {
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
        allergyStatus: data.allergyStatus || '未確認',
        allergies: data.allergies || '',
        careLevel: data.careLevel,
        createdBy: author,
        updatedBy: author,
        deletedAt: null,
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

  async update(id: string, data: Partial<ResidentFormData>, author: RecordAuthor): Promise<void> {
    const updateData: Record<string, FieldValue | string | number | Date | null | RecordAuthor> = {
      updatedAt: Timestamp.now(),
      updatedBy: author
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
    if (data.allergyStatus !== undefined) updateData.allergyStatus = data.allergyStatus;
    if (data.allergies !== undefined) updateData.allergies = data.allergies;
    if (data.careLevel !== undefined) updateData.careLevel = data.careLevel;

    await updateDoc(doc(db, COLLECTIONS.RESIDENTS, id), updateData);
  },

  // 論理削除（物理削除しない。紐づく診療録・投薬を保持し真正性を守るため）
  async delete(id: string, author: RecordAuthor): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.RESIDENTS, id), {
      deletedAt: Timestamp.now(),
      deletedBy: author,
      updatedAt: Timestamp.now(),
      updatedBy: author
    });
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
      const records = querySnapshot.docs
        .map(doc => convertMedicalRecordData(doc.id, doc.data()))
        .filter(r => !r.deletedAt); // 論理削除は除外
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
        if (recordData.deletedAt) continue; // 論理削除は無視
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

  async create(residentId: string, data: MedicalRecordFormData, author: RecordAuthor): Promise<string> {

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
      createdBy: author,
      updatedBy: author,
      deletedAt: null,
      createdAt: now,
      updatedAt: now
    };
    const docRef = await addDoc(collection(db, COLLECTIONS.MEDICAL_RECORDS), docData);
    return docRef.id;
  },

  async update(id: string, data: Partial<MedicalRecordFormData>, author: RecordAuthor): Promise<void> {
    const ref = doc(db, COLLECTIONS.MEDICAL_RECORDS, id);

    // 編集前の内容を訂正履歴として追記（改ざん防止・真正性）
    const currentSnap = await getDoc(ref);
    if (currentSnap.exists()) {
      const current = currentSnap.data();
      await addDoc(collection(db, COLLECTIONS.MEDICAL_RECORDS, id, COLLECTIONS.REVISIONS), {
        date: current.date,
        record: current.record ?? '',
        editedBy: current.updatedBy ?? current.createdBy ?? null,
        editedAt: current.updatedAt ?? Timestamp.now()
      });
    }

    const updateData: Record<string, FieldValue | string | Date | RecordAuthor> = {
      updatedAt: Timestamp.now(),
      updatedBy: author
    };
    if (data.date !== undefined) updateData.date = Timestamp.fromDate(new Date(data.date));
    if (data.record !== undefined) updateData.record = data.record;

    await updateDoc(ref, updateData);
  },

  // 論理削除（物理削除しない。5年保存・真正性のため）
  async delete(id: string, author: RecordAuthor): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.MEDICAL_RECORDS, id), {
      deletedAt: Timestamp.now(),
      deletedBy: author,
      updatedAt: Timestamp.now(),
      updatedBy: author
    });
  },

  async getRevisions(id: string): Promise<MedicalRecordRevision[]> {
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.MEDICAL_RECORDS, id, COLLECTIONS.REVISIONS));
      return snap.docs
        .map(d => convertRevisionData(d.id, d.data()))
        .sort((a, b) => dayjs(b.editedAt).valueOf() - dayjs(a.editedAt).valueOf());
    } catch {
      return [];
    }
  }
};

// 投薬は入所者のサブコレクション residents/{residentId}/medications に保存
export const medicationService = {
  async getByResidentId(residentId: string): Promise<Medication[]> {
    try {
      const querySnapshot = await getDocs(
        collection(db, COLLECTIONS.RESIDENTS, residentId, COLLECTIONS.MEDICATIONS)
      );
      const medications = querySnapshot.docs.map(d =>
        convertMedicationData(residentId, d.id, d.data())
      );
      // 継続中（中止日なし）を上に、その中で開始日の新しい順
      return medications.sort((a, b) => {
        const aStopped = a.endDate ? 1 : 0;
        const bStopped = b.endDate ? 1 : 0;
        if (aStopped !== bStopped) return aStopped - bStopped;
        return dayjs(b.startDate).valueOf() - dayjs(a.startDate).valueOf();
      });
    } catch (error) {
      logger.firestoreError('Failed to fetch medications', error as Error, {
        action: 'get_medications',
        residentId
      });
      return [];
    }
  },

  // 服薬中の薬剤で入所者を検索（全入所者の medications サブコレクションを横断）
  async searchResidentsByDrug(drugName: string): Promise<Resident[]> {
    const term = drugName.trim();
    if (!term) return [];
    try {
      const snap = await getDocs(query(
        collectionGroup(db, COLLECTIONS.MEDICATIONS),
        where('name', '>=', term),
        where('name', '<=', term + String.fromCharCode(0xf8ff)),
        orderBy('name')
      ));
      const residentIds = [...new Set(
        snap.docs.map(d => d.ref.parent.parent?.id).filter((id): id is string => !!id)
      )];
      const residents = await Promise.all(residentIds.map(id => residentService.getById(id)));
      return residents
        .filter((r): r is Resident => r !== null)
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      logger.firestoreError('Search residents by drug failed', error as Error, { action: 'search_by_drug' });
      return [];
    }
  },

  async create(residentId: string, data: MedicationFormData, author: RecordAuthor): Promise<string> {
    const now = Timestamp.now();
    const docRef = await addDoc(
      collection(db, COLLECTIONS.RESIDENTS, residentId, COLLECTIONS.MEDICATIONS),
      {
        name: data.name,
        dosage: data.dosage,
        frequency: data.frequency,
        route: data.route,
        type: data.type,
        startDate: Timestamp.fromDate(new Date(data.startDate)),
        endDate: data.endDate ? Timestamp.fromDate(new Date(data.endDate)) : null,
        notes: data.notes || '',
        yjCode: data.yjCode || null,
        hotCode: data.hotCode || null,
        createdBy: author,
        updatedBy: author,
        createdAt: now,
        updatedAt: now
      }
    );
    return docRef.id;
  },

  async update(residentId: string, medicationId: string, data: Partial<MedicationFormData>, author: RecordAuthor): Promise<void> {
    const updateData: Record<string, FieldValue | string | Date | null | RecordAuthor> = {
      updatedAt: Timestamp.now(),
      updatedBy: author
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.dosage !== undefined) updateData.dosage = data.dosage;
    if (data.frequency !== undefined) updateData.frequency = data.frequency;
    if (data.route !== undefined) updateData.route = data.route;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.startDate !== undefined) updateData.startDate = Timestamp.fromDate(new Date(data.startDate));
    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate ? Timestamp.fromDate(new Date(data.endDate)) : null;
    }
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.yjCode !== undefined) updateData.yjCode = data.yjCode || null;
    if (data.hotCode !== undefined) updateData.hotCode = data.hotCode || null;

    await updateDoc(
      doc(db, COLLECTIONS.RESIDENTS, residentId, COLLECTIONS.MEDICATIONS, medicationId),
      updateData
    );
  },

  // 中止（削除せず中止日を記録して変遷を残す）
  async stop(residentId: string, medicationId: string, endDate: string, author: RecordAuthor): Promise<void> {
    await updateDoc(
      doc(db, COLLECTIONS.RESIDENTS, residentId, COLLECTIONS.MEDICATIONS, medicationId),
      {
        endDate: Timestamp.fromDate(new Date(endDate)),
        updatedBy: author,
        updatedAt: Timestamp.now()
      }
    );
  },

  // 入力誤りの削除用
  async delete(residentId: string, medicationId: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.RESIDENTS, residentId, COLLECTIONS.MEDICATIONS, medicationId));
  }
};

// 医薬品マスター（drugMaster コレクション）— 薬剤名のプレフィックス検索
export const drugMasterService = {
  async search(prefix: string, max = 10): Promise<DrugMasterItem[]> {
    const term = prefix.trim();
    if (!term) return [];
    try {
      const q = query(
        collection(db, COLLECTIONS.DRUG_MASTER),
        where('name', '>=', term),
        where('name', '<=', term + String.fromCharCode(0xf8ff)),
        orderBy('name'),
        limit(max)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => convertDrugMasterData(d.id, d.data()));
    } catch (error) {
      logger.firestoreError('Drug master search failed', error as Error, { action: 'drug_search' });
      return [];
    }
  }
};