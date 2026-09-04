import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { PencilIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { residentService } from '../services/firestore';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { logger } from '../services/logger';
import { useAuth } from '../hooks/useAuth';
import type { Resident, ResidentFormData, AllergyStatus } from '../types';
import ModalShell from './common/ModalShell';
import ModalHeader from './common/ModalHeader';
import Snackbar from './common/Snackbar';
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
  const { t } = useTranslation();
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

      setSnackbar({ open: true, message: t('resident.updatedOk'), severity: 'success' });
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

  // アレルギー「あり」ならアレルゲン必須（新規登録フォームと同じ基準）
  const isFormValid = () =>
    formData.name.trim() !== '' &&
    formData.furigana.trim() !== '' &&
    formData.birthDate !== '' &&
    formData.roomNumber.trim() !== '' &&
    formData.admissionDate !== '' &&
    (formData.allergyStatus !== 'あり' || (formData.allergies || '').trim() !== '');

  return (
    <>
      <ModalShell maxWidth="max-w-4xl">
        <ModalHeader title={t('resident.editTitle', { name: resident.name })} icon={PencilIcon} onClose={onCancel} />

        <div className="p-6 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label={t('resident.name')} required>
                <TextInput value={formData.name} required onChange={handleInputChange('name')} />
              </FormField>
              <FormField label={t('resident.furigana')} required>
                <TextInput value={formData.furigana} required onChange={handleInputChange('furigana')} />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label={t('resident.gender')} required>
                <Select value={formData.gender} required onChange={handleInputChange('gender')}>
                  <option value="男性">{t('resident.male')}</option>
                  <option value="女性">{t('resident.female')}</option>
                </Select>
              </FormField>
              <FormField label={t('resident.birthDate')} required help={formData.birthDate ? t('resident.ageLabel', { age: calculateAge(formData.birthDate) }) : undefined}>
                <TextInput type="date" value={birthDateValue} required onChange={handleDateChange('birthDate')} />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label={t('resident.room')} required>
                <TextInput value={formData.roomNumber} required onChange={handleInputChange('roomNumber')} />
              </FormField>
              <FormField label={t('resident.careLevel')} required>
                <Select value={formData.careLevel || 1} required onChange={handleInputChange('careLevel')}>
                  <option value={1}>{t('resident.careLevelOption', { n: 1 })}</option>
                  <option value={2}>{t('resident.careLevelOption', { n: 2 })}</option>
                  <option value={3}>{t('resident.careLevelOption', { n: 3 })}</option>
                  <option value={4}>{t('resident.careLevelOption', { n: 4 })}</option>
                  <option value={5}>{t('resident.careLevelOption', { n: 5 })}</option>
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label={t('resident.admissionDate')} required>
                <TextInput type="date" value={admissionDateValue} required onChange={handleDateChange('admissionDate')} />
              </FormField>
              <FormField label={t('resident.dischargeDate')}>
                <TextInput type="date" value={dischargeDateValue} onChange={handleDateChange('dischargeDate')} />
              </FormField>
            </div>

            <FormField label={t('resident.allergy')} required>
              <Select
                value={formData.allergyStatus || '未確認'}
                onChange={(e) => setFormData(prev => ({ ...prev, allergyStatus: e.target.value as AllergyStatus, allergies: e.target.value === 'あり' ? prev.allergies : '' }))}
              >
                <option value="未確認">{t('resident.allergyUnknown')}</option>
                <option value="なし">{t('resident.allergyNone')}</option>
                <option value="あり">{t('resident.allergyPresent')}</option>
              </Select>
            </FormField>
            {formData.allergyStatus === 'あり' && (
              <FormField label={t('resident.allergen')} required error={(formData.allergies || '').trim() === '' ? t('resident.allergenRequired') : undefined}>
                <TextInput value={formData.allergies || ''} required error={(formData.allergies || '').trim() === ''} placeholder={t('resident.phAllergen')} onChange={handleInputChange('allergies')} />
              </FormField>
            )}

            <FormField label={t('resident.medicalHistory')}>
              <Textarea value={formData.medicalHistory} rows={4} placeholder={t('resident.phHistory')} onChange={handleInputChange('medicalHistory')} />
            </FormField>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button type="button" variant="secondary" icon={XMarkIcon} onClick={onCancel} disabled={loading}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" icon={CheckIcon} disabled={loading || !isFormValid()}>
                {loading ? t('common.updating') : t('common.update')}
              </Button>
            </div>
          </form>
        </div>
      </ModalShell>

      <Snackbar open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={handleCloseSnackbar} />
    </>
  );
};

export default ResidentEditForm;
