import { useState } from 'react';
import dayjs from 'dayjs';
import { PencilIcon, XMarkIcon, CheckIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { residentService } from '../services/firestore';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { logger } from '../services/logger';
import { useAuth } from '../hooks/useAuth';
import type { Resident, ResidentFormData, AllergyStatus } from '../types';
import ModalShell from './common/ModalShell';
import ModalHeader from './common/ModalHeader';
import Button from './common/Button';
import FormField from './common/FormField';
import { TextInput, Select, Textarea } from './common/FormControls';

interface ResidentEditFormProps {
  resident: Resident;
  onComplete: () => void;
  onCancel: () => void;
}

const ResidentEditForm = ({ resident, onComplete, onCancel }: ResidentEditFormProps) => {
  const [formData, setFormData] = useState<ResidentFormData>({
    name: resident.name,
    furigana: resident.furigana,
    gender: resident.gender,
    birthDate: dayjs(resident.birthDate).format('YYYY-MM-DD'),
    roomNumber: resident.roomNumber,
    admissionDate: dayjs(resident.admissionDate).format('YYYY-MM-DD'),
    dischargeDate: resident.dischargeDate ? dayjs(resident.dischargeDate).format('YYYY-MM-DD') : '',
    medicalHistory: resident.medicalHistory,
    allergyStatus: resident.allergyStatus,
    allergies: resident.allergies || '',
    careLevel: resident.careLevel,
  });

  const [birthDateValue, setBirthDateValue] = useState<string>(dayjs(resident.birthDate).format('YYYY-MM-DD'));
  const [admissionDateValue, setAdmissionDateValue] = useState<string>(dayjs(resident.admissionDate).format('YYYY-MM-DD'));
  const [dischargeDateValue, setDischargeDateValue] = useState<string>(
    resident.dischargeDate ? dayjs(resident.dischargeDate).format('YYYY-MM-DD') : ''
  );
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const { handleFirestoreError } = useErrorHandler();
  const { measureAsyncOperation, measureInteraction } = usePerformanceMonitor('ResidentEditForm');
  const { user } = useAuth();
  const author = { uid: user?.uid ?? '', name: user?.displayName ?? user?.email ?? '不明' };

  const handleInputChange = (field: keyof ResidentFormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [field]: field === 'careLevel' ? Number(value) : value }));
  };

  const handleDateChange = (field: 'birthDate' | 'admissionDate' | 'dischargeDate') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const dateString = event.target.value;
    setFormData(prev => ({ ...prev, [field]: dateString }));
    if (field === 'birthDate') setBirthDateValue(dateString);
    if (field === 'admissionDate') setAdmissionDateValue(dateString);
    if (field === 'dischargeDate') setDischargeDateValue(dateString);
  };

  const calculateAge = (birthDate: string): number => {
    if (!birthDate) return 0;
    return dayjs().diff(dayjs(birthDate), 'year');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const endMeasurement = measureInteraction('update_resident', performance.now());
    setLoading(true);

    try {
      logger.userAction('resident_edit_submit_started', {
        component: 'ResidentEditForm',
        residentId: resident.id,
        residentName: resident.name,
        formData: { name: formData.name, roomNumber: formData.roomNumber, careLevel: formData.careLevel },
      });

      await measureAsyncOperation(() => residentService.update(resident.id, formData, author), 'update_resident');

      logger.userAction('resident_updated_success', {
        component: 'ResidentEditForm',
        residentId: resident.id,
        residentName: formData.name,
      });

      setSnackbar({ open: true, message: '入所者情報が正常に更新されました', severity: 'success' });
      setTimeout(() => setSnackbar(prev => ({ ...prev, open: false })), 4000);
      setTimeout(() => onComplete(), 1000);
    } catch (error: unknown) {
      const errorMessage = handleFirestoreError(error, 'update', {
        component: 'ResidentEditForm',
        residentId: resident.id,
        residentName: resident.name,
      });
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
      setTimeout(() => setSnackbar(prev => ({ ...prev, open: false })), 4000);
    } finally {
      setLoading(false);
      endMeasurement();
    }
  };

  const handleCloseSnackbar = () => setSnackbar(prev => ({ ...prev, open: false }));

  return (
    <>
      <ModalShell maxWidth="max-w-4xl">
        <ModalHeader title={`${resident.name}さんの情報編集`} icon={PencilIcon} onClose={onCancel} />

        <div className="p-6 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="名前" required>
                <TextInput value={formData.name} required onChange={handleInputChange('name')} />
              </FormField>
              <FormField label="フリガナ" required>
                <TextInput value={formData.furigana} required onChange={handleInputChange('furigana')} />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="性別" required>
                <Select value={formData.gender} required onChange={handleInputChange('gender')}>
                  <option value="">性別を選択</option>
                  <option value="男性">男性</option>
                  <option value="女性">女性</option>
                </Select>
              </FormField>
              <FormField label="生年月日" required help={formData.birthDate ? `満年齢: ${calculateAge(formData.birthDate)}歳` : undefined}>
                <TextInput type="date" value={birthDateValue} required onChange={handleDateChange('birthDate')} />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="部屋番号" required>
                <TextInput value={formData.roomNumber} required onChange={handleInputChange('roomNumber')} />
              </FormField>
              <FormField label="入所日" required>
                <TextInput type="date" value={admissionDateValue} required onChange={handleDateChange('admissionDate')} />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="退所日">
                <TextInput type="date" value={dischargeDateValue} onChange={handleDateChange('dischargeDate')} />
              </FormField>
              <FormField label="要介護度" required>
                <Select value={formData.careLevel || 1} required onChange={handleInputChange('careLevel')}>
                  <option value={1}>要介護1</option>
                  <option value={2}>要介護2</option>
                  <option value={3}>要介護3</option>
                  <option value={4}>要介護4</option>
                  <option value={5}>要介護5</option>
                </Select>
              </FormField>
            </div>

            <FormField label="アレルギー" required>
              <Select
                value={formData.allergyStatus || '未確認'}
                onChange={(e) => setFormData(prev => ({ ...prev, allergyStatus: e.target.value as AllergyStatus, allergies: e.target.value === 'あり' ? prev.allergies : '' }))}
              >
                <option value="未確認">未確認</option>
                <option value="なし">なし</option>
                <option value="あり">あり</option>
              </Select>
            </FormField>
            {formData.allergyStatus === 'あり' && (
              <FormField label="アレルゲン" required>
                <TextInput value={formData.allergies || ''} placeholder="例: ペニシリン、そば" onChange={handleInputChange('allergies')} />
              </FormField>
            )}

            <FormField label="既往歴">
              <Textarea value={formData.medicalHistory} rows={4} placeholder="既往歴や医療情報を入力してください" onChange={handleInputChange('medicalHistory')} />
            </FormField>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button type="button" variant="secondary" icon={XMarkIcon} onClick={onCancel} disabled={loading}>
                キャンセル
              </Button>
              <Button type="submit" icon={CheckIcon} disabled={loading}>
                {loading ? '更新中...' : '更新'}
              </Button>
            </div>
          </form>
        </div>
      </ModalShell>

      {snackbar.open && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[110]">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] ${snackbar.severity === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
            {snackbar.severity === 'success' ? <CheckCircleIcon className="w-5 h-5 shrink-0" /> : <XCircleIcon className="w-5 h-5 shrink-0" />}
            <span className="flex-1 font-medium">{snackbar.message}</span>
            <button onClick={handleCloseSnackbar} className="shrink-0 text-current hover:opacity-70 transition-opacity" aria-label="閉じる">
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ResidentEditForm;
