import { useState } from 'react';
import dayjs from 'dayjs';
import { UserIcon, ArrowPathIcon, CheckIcon } from '@heroicons/react/24/outline';
import { residentService } from '../services/firestore';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { logger } from '../services/logger';
import type { ResidentFormData } from '../types';
import Button from './common/Button';
import FormField from './common/FormField';
import { TextInput, Select, Textarea } from './common/FormControls';

const EMPTY: ResidentFormData = {
  name: '',
  furigana: '',
  gender: '男性',
  birthDate: '',
  roomNumber: '',
  admissionDate: '',
  dischargeDate: '',
  medicalHistory: '',
  careLevel: 1,
};

const ResidentForm = () => {
  const [formData, setFormData] = useState<ResidentFormData>({ ...EMPTY });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [roomNumberError, setRoomNumberError] = useState('');

  const { handleFirestoreError } = useErrorHandler();
  const { measureAsyncOperation, measureInteraction } = usePerformanceMonitor('ResidentForm');

  const convertSpacesToFullWidth = (text: string): string => text.replace(/ /g, '　');

  const validateRoomNumber = (roomNumber: string): string => {
    if (!roomNumber) return '';
    if (!/^[0-9]+$/.test(roomNumber)) return '部屋番号は半角数字のみで入力してください';
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

      await measureAsyncOperation(() => residentService.create(formData), 'create_resident');

      setAlert({ show: true, message: '入所者情報を正常に登録しました', type: 'success' });
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
    !roomNumberError;

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
            <h2 className="text-xl font-semibold text-gray-900">新規入所者登録</h2>
          </div>

          <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormField label="氏名" htmlFor="name" required help="※スペースは自動的に全角に変換されます">
                <TextInput
                  id="name"
                  value={formData.name}
                  required
                  placeholder="例: 山田　太郎"
                  onChange={(e) => setFormData(prev => ({ ...prev, name: convertSpacesToFullWidth(e.target.value) }))}
                />
              </FormField>
              <FormField label="フリガナ" htmlFor="furigana" required help="※スペースは自動的に全角に変換されます">
                <TextInput
                  id="furigana"
                  value={formData.furigana}
                  required
                  placeholder="例: ヤマダ　タロウ"
                  onChange={(e) => setFormData(prev => ({ ...prev, furigana: convertSpacesToFullWidth(e.target.value) }))}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <FormField label="性別" htmlFor="gender" required>
                <Select id="gender" value={formData.gender} required onChange={handleInputChange('gender')}>
                  <option value="男性">男性</option>
                  <option value="女性">女性</option>
                </Select>
              </FormField>
              <div className="sm:col-span-2">
                <FormField label="生年月日" htmlFor="birthDate" required help={formData.birthDate ? `年齢: ${calculateAge(formData.birthDate)}歳` : undefined}>
                  <TextInput type="date" id="birthDate" value={formData.birthDate} required onChange={handleInputChange('birthDate')} />
                </FormField>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormField label="部屋番号" htmlFor="roomNumber" required error={roomNumberError} help="※半角数字のみで入力してください">
                <TextInput
                  id="roomNumber"
                  value={formData.roomNumber}
                  required
                  placeholder="例: 101"
                  error={!!roomNumberError}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData(prev => ({ ...prev, roomNumber: value }));
                    setRoomNumberError(validateRoomNumber(value));
                  }}
                />
              </FormField>
              <FormField label="要介護度" htmlFor="careLevel" required>
                <Select id="careLevel" value={formData.careLevel} required onChange={handleInputChange('careLevel')}>
                  <option value={1}>要介護1</option>
                  <option value={2}>要介護2</option>
                  <option value={3}>要介護3</option>
                  <option value={4}>要介護4</option>
                  <option value={5}>要介護5</option>
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormField label="入所日" htmlFor="admissionDate" required>
                <TextInput type="date" id="admissionDate" value={formData.admissionDate} required onChange={handleInputChange('admissionDate')} />
              </FormField>
              <FormField label="退所日（任意）" htmlFor="dischargeDate">
                <TextInput type="date" id="dischargeDate" value={formData.dischargeDate || ''} onChange={handleInputChange('dischargeDate')} />
              </FormField>
            </div>

            <FormField label="既往歴・医療情報" htmlFor="medicalHistory">
              <Textarea id="medicalHistory" value={formData.medicalHistory} rows={3} placeholder="既往歴、アレルギー、注意事項など" onChange={handleInputChange('medicalHistory')} />
            </FormField>

            <div className="flex flex-wrap gap-3 justify-end">
              <Button type="button" variant="secondary" icon={ArrowPathIcon} onClick={resetForm} disabled={loading}>
                リセット
              </Button>
              <Button type="submit" icon={CheckIcon} disabled={loading || !isFormValid()}>
                {loading ? '登録中...' : '登録'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResidentForm;
