import { useState } from 'react';
import dayjs from 'dayjs';
import { PencilIcon } from '@heroicons/react/24/outline';
import { residentService } from '../services/firestore';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { logger } from '../services/logger';
import type { Resident, ResidentFormData } from '../types';
import MedicationInput from './MedicationInput';

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
    medications: resident.medications,
    careLevel: resident.careLevel
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

  const handleInputChange = (field: keyof ResidentFormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { value: unknown } }
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleDateChange = (field: 'birthDate' | 'admissionDate' | 'dischargeDate') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const dateString = event.target.value;
    setFormData(prev => ({
      ...prev,
      [field]: dateString
    }));

    if (field === 'birthDate') setBirthDateValue(dateString);
    if (field === 'admissionDate') setAdmissionDateValue(dateString);
    if (field === 'dischargeDate') setDischargeDateValue(dateString);
  };

  const calculateAge = (birthDate: string): number => {
    if (!birthDate) return 0;
    const today = dayjs();
    const birth = dayjs(birthDate);
    return today.diff(birth, 'year');
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
        formData: {
          name: formData.name,
          roomNumber: formData.roomNumber,
          careLevel: formData.careLevel
        }
      });

      await measureAsyncOperation(
        () => residentService.update(resident.id, formData),
        'update_resident'
      );

      logger.userAction('resident_updated_success', {
        component: 'ResidentEditForm',
        residentId: resident.id,
        residentName: formData.name
      });

      setSnackbar({ open: true, message: '入所者情報が正常に更新されました', severity: 'success' });
      setTimeout(() => {
        setSnackbar(prev => ({ ...prev, open: false }));
      }, 4000);
      setTimeout(() => {
        onComplete();
      }, 1000);
    } catch (error: unknown) {
      const errorMessage = handleFirestoreError(error, 'update', {
        component: 'ResidentEditForm',
        residentId: resident.id,
        residentName: resident.name
      });

      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
      setTimeout(() => {
        setSnackbar(prev => ({ ...prev, open: false }));
      }, 4000);
    } finally {
      setLoading(false);
      endMeasurement();
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  return (
    <>
      {/* Main Dialog */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* Dialog Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <PencilIcon className="w-5 h-5" />
              {resident.name}さんの情報編集
            </h2>
          </div>

          {/* Dialog Content */}
          <div className="p-6 max-h-[calc(90vh-140px)] overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    名前 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={handleInputChange('name')}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    フリガナ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.furigana}
                    onChange={handleInputChange('furigana')}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    性別 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.gender}
                    onChange={handleInputChange('gender')}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">性別を選択</option>
                    <option value="男性">男性</option>
                    <option value="女性">女性</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    生年月日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={birthDateValue}
                    onChange={handleDateChange('birthDate')}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {formData.birthDate && (
                    <p className="text-sm text-gray-600 mt-1">
                      満年齢: {calculateAge(formData.birthDate)}歳
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    部屋番号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.roomNumber}
                    onChange={handleInputChange('roomNumber')}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    入所日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={admissionDateValue}
                    onChange={handleDateChange('admissionDate')}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    退所日
                  </label>
                  <input
                    type="date"
                    value={dischargeDateValue}
                    onChange={handleDateChange('dischargeDate')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    要介護度 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.careLevel || 1}
                    onChange={handleInputChange('careLevel')}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>要介護1</option>
                    <option value={2}>要介護2</option>
                    <option value={3}>要介護3</option>
                    <option value={4}>要介護4</option>
                    <option value={5}>要介護5</option>
                  </select>
                </div>
              </div>

              <MedicationInput
                medications={formData.medications}
                onChange={(medications) => setFormData(prev => ({ ...prev, medications }))}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  既往歴
                </label>
                <textarea
                  value={formData.medicalHistory}
                  onChange={handleInputChange('medicalHistory')}
                  placeholder="既往歴や医療情報を入力してください"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                />
              </div>

              {/* Dialog Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {loading ? '更新中...' : '更新'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Notification */}
      {snackbar.open && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[110]">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] ${
            snackbar.severity === 'success'
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            <div className="flex-shrink-0">
              {snackbar.severity === 'success' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <span className="flex-1 font-medium">{snackbar.message}</span>
            <button
              onClick={handleCloseSnackbar}
              className="flex-shrink-0 text-current hover:opacity-70 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ResidentEditForm;