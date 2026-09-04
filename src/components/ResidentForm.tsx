import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { UserIcon, ArrowPathIcon, CheckIcon } from '@heroicons/react/24/outline';
import { residentService } from '../services/firestore';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { logger } from '../services/logger';
import { useAuth } from '../hooks/useAuth';
import type { ResidentFormData } from '../types';
import Button from './common/Button';
import FormField from './common/FormField';
import { TextInput, Select, Textarea } from './common/FormControls';
import { PHYSICAL_INDEPENDENCE_RANKS, DEMENTIA_INDEPENDENCE_RANKS } from '../constants/independenceLevels';

const EMPTY: ResidentFormData = {
  name: '',
  furigana: '',
  gender: '男性',
  birthDate: '',
  roomNumber: '',
  admissionDate: '',
  dischargeDate: '',
  medicalHistory: '',
  allergies: '',
  careLevel: 1,
  physicalIndependence: '',
  dementiaIndependence: '',
  insuredNumber: '',
  insurer: '',
  certValidFrom: '',
  certValidTo: '',
};

const ResidentForm = () => {
  const [formData, setFormData] = useState<ResidentFormData>({ ...EMPTY });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [roomNumberError, setRoomNumberError] = useState('');

  const { handleFirestoreError } = useErrorHandler();
  const { measureAsyncOperation, measureInteraction } = usePerformanceMonitor('ResidentForm');
  const { user } = useAuth();
  const { t } = useTranslation();
  const author = { uid: user?.uid ?? '', name: user?.displayName ?? user?.email ?? '不明' };

  const convertSpacesToFullWidth = (text: string): string => text.replace(/ /g, '　');

  const validateRoomNumber = (roomNumber: string): string => {
    if (!roomNumber) return '';
    if (!/^[0-9]+$/.test(roomNumber)) return t('resident.roomError');
    return '';
  };

  const handleInputChange = (field: keyof ResidentFormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [field]: field === 'careLevel' ? Number(value) : value }));
  };

  const calculateAge = (birthDate: string): number => {
    if (!birthDate) return 0;
    return dayjs().diff(dayjs(birthDate), 'year');
  };

  const resetForm = () => {
    setFormData({ ...EMPTY });
    setRoomNumberError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const endMeasurement = measureInteraction('form_submit', performance.now());
    setLoading(true);

    try {
      logger.userAction('resident_form_submit_started', {
        component: 'ResidentForm',
        formData: { name: formData.name, roomNumber: formData.roomNumber, careLevel: formData.careLevel },
      });

      await measureAsyncOperation(() => residentService.create(formData, author), 'create_resident');

      setAlert({ show: true, message: t('resident.createdOk'), type: 'success' });
      logger.userAction('resident_created_success', {
        component: 'ResidentForm',
        residentName: formData.name,
        roomNumber: formData.roomNumber,
      });
      resetForm();
    } catch (error: unknown) {
      const errorMessage = handleFirestoreError(error, 'create', {
        component: 'ResidentForm',
        residentName: formData.name,
        roomNumber: formData.roomNumber,
      });
      setAlert({ show: true, message: errorMessage, type: 'error' });
    } finally {
      setLoading(false);
      endMeasurement();
    }

    setTimeout(() => setAlert(prev => ({ ...prev, show: false })), 4000);
  };

  const isFormValid = () =>
    formData.name.trim() !== '' &&
    formData.furigana.trim() !== '' &&
    formData.birthDate !== '' &&
    formData.roomNumber.trim() !== '' &&
    formData.admissionDate !== '' &&
    !roomNumberError &&
    (formData.allergyStatus === 'なし' || (formData.allergyStatus === 'あり' && (formData.allergies || '').trim() !== ''));

  const hideAlert = () => setAlert(prev => ({ ...prev, show: false }));

  return (
    <div className="space-y-6 relative">
      {alert.show && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md mx-auto px-4">
          <div className={`flex items-center justify-between p-4 rounded-lg shadow-lg border ${alert.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <span className="font-medium">{alert.message}</span>
            <button onClick={hideAlert} className={`ml-3 text-lg font-semibold hover:opacity-70 transition-opacity ${alert.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>×</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <UserIcon className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">{t('resident.newTitle')}</h2>
          </div>

          <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
            <h3 className="text-sm font-semibold text-gray-500 pb-1 border-b border-gray-200">{t('resident.sectionBasic')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormField label={t('resident.name')} htmlFor="name" required help={t('resident.spaceNote')}>
                <TextInput
                  id="name"
                  value={formData.name}
                  required
                  placeholder={t('resident.phName')}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: convertSpacesToFullWidth(e.target.value) }))}
                />
              </FormField>
              <FormField label={t('resident.furigana')} htmlFor="furigana" required help={t('resident.spaceNote')}>
                <TextInput
                  id="furigana"
                  value={formData.furigana}
                  required
                  placeholder={t('resident.phFurigana')}
                  onChange={(e) => setFormData(prev => ({ ...prev, furigana: convertSpacesToFullWidth(e.target.value) }))}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormField label={t('resident.gender')} htmlFor="gender" required>
                <Select id="gender" value={formData.gender} required onChange={handleInputChange('gender')}>
                  <option value="男性">{t('resident.male')}</option>
                  <option value="女性">{t('resident.female')}</option>
                </Select>
              </FormField>
              <FormField label={t('resident.birthDate')} htmlFor="birthDate" required help={formData.birthDate ? t('resident.ageLabel', { age: calculateAge(formData.birthDate) }) : undefined}>
                <TextInput type="date" id="birthDate" value={formData.birthDate} required onChange={handleInputChange('birthDate')} />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormField label={t('resident.room')} htmlFor="roomNumber" required error={roomNumberError} help={t('resident.roomNote')}>
                <TextInput
                  id="roomNumber"
                  value={formData.roomNumber}
                  required
                  placeholder={t('resident.phRoom')}
                  error={!!roomNumberError}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData(prev => ({ ...prev, roomNumber: value }));
                    setRoomNumberError(validateRoomNumber(value));
                  }}
                />
              </FormField>
              <FormField label={t('resident.careLevel')} htmlFor="careLevel" required>
                <Select id="careLevel" value={formData.careLevel} required onChange={handleInputChange('careLevel')}>
                  <option value={1}>{t('resident.careLevelOption', { n: 1 })}</option>
                  <option value={2}>{t('resident.careLevelOption', { n: 2 })}</option>
                  <option value={3}>{t('resident.careLevelOption', { n: 3 })}</option>
                  <option value={4}>{t('resident.careLevelOption', { n: 4 })}</option>
                  <option value={5}>{t('resident.careLevelOption', { n: 5 })}</option>
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormField label={t('resident.admissionDate')} htmlFor="admissionDate" required>
                <TextInput type="date" id="admissionDate" value={formData.admissionDate} required onChange={handleInputChange('admissionDate')} />
              </FormField>
              <FormField label={t('resident.dischargeDate')} htmlFor="dischargeDate">
                <TextInput type="date" id="dischargeDate" value={formData.dischargeDate || ''} onChange={handleInputChange('dischargeDate')} />
              </FormField>
            </div>

            <h3 className="text-sm font-semibold text-gray-500 pb-1 border-b border-gray-200">{t('resident.sectionCareInsurance')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormField label={t('resident.physicalIndependence')} htmlFor="physicalIndependence">
                <Select id="physicalIndependence" value={formData.physicalIndependence || ''} onChange={handleInputChange('physicalIndependence')}>
                  <option value="">{t('resident.independenceUnrated')}</option>
                  {PHYSICAL_INDEPENDENCE_RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </FormField>
              <FormField label={t('resident.dementiaIndependence')} htmlFor="dementiaIndependence">
                <Select id="dementiaIndependence" value={formData.dementiaIndependence || ''} onChange={handleInputChange('dementiaIndependence')}>
                  <option value="">{t('resident.independenceUnrated')}</option>
                  {DEMENTIA_INDEPENDENCE_RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormField label={t('resident.insuredNumber')} htmlFor="insuredNumber">
                <TextInput id="insuredNumber" value={formData.insuredNumber || ''} onChange={handleInputChange('insuredNumber')} />
              </FormField>
              <FormField label={t('resident.insurer')} htmlFor="insurer">
                <TextInput id="insurer" value={formData.insurer || ''} onChange={handleInputChange('insurer')} />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormField label={t('resident.certValidFrom')} htmlFor="certValidFrom">
                <TextInput type="date" id="certValidFrom" value={formData.certValidFrom || ''} onChange={handleInputChange('certValidFrom')} />
              </FormField>
              <FormField label={t('resident.certValidTo')} htmlFor="certValidTo">
                <TextInput type="date" id="certValidTo" value={formData.certValidTo || ''} onChange={handleInputChange('certValidTo')} />
              </FormField>
            </div>

            <h3 className="text-sm font-semibold text-gray-500 pb-1 border-b border-gray-200">{t('resident.allergy')}</h3>
            <div className="flex items-center gap-6 py-1">
              <label className="flex items-center gap-1.5 text-sm text-gray-800">
                <input type="radio" name="allergyStatus" checked={formData.allergyStatus === 'なし'} onChange={() => setFormData(prev => ({ ...prev, allergyStatus: 'なし', allergies: '' }))} />
                {t('resident.allergyNone')}
              </label>
              <label className="flex items-center gap-1.5 text-sm text-gray-800">
                <input type="radio" name="allergyStatus" checked={formData.allergyStatus === 'あり'} onChange={() => setFormData(prev => ({ ...prev, allergyStatus: 'あり' }))} />
                {t('resident.allergyPresent')}
              </label>
            </div>
            {formData.allergyStatus === 'あり' && (
              <FormField label={t('resident.allergen')} required>
                <TextInput value={formData.allergies || ''} placeholder={t('resident.phAllergen')} onChange={handleInputChange('allergies')} />
              </FormField>
            )}

            <h3 className="text-sm font-semibold text-gray-500 pb-1 border-b border-gray-200">{t('resident.medicalHistory')}</h3>
            <Textarea id="medicalHistory" value={formData.medicalHistory} rows={3} placeholder={t('resident.phHistory')} onChange={handleInputChange('medicalHistory')} />

            <div className="flex flex-wrap gap-3 justify-end">
              <Button type="button" variant="secondary" icon={ArrowPathIcon} onClick={resetForm} disabled={loading}>
                {t('common.reset')}
              </Button>
              <Button type="submit" icon={CheckIcon} disabled={loading || !isFormValid()}>
                {loading ? t('common.registering') : t('common.register')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResidentForm;
