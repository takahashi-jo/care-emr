import { useState } from 'react';
import dayjs from 'dayjs';
import { UserIcon, ArrowPathIcon, CheckIcon } from '@heroicons/react/24/outline';
import { residentService } from '../services/firestore';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { logger } from '../services/logger';
import type { ResidentFormData } from '../types';
import MedicationInput from './MedicationInput';

const ResidentForm = () => {
  const [formData, setFormData] = useState<ResidentFormData>({
    name: '',
    furigana: '',
    gender: '男性',
    birthDate: '',
    roomNumber: '',
    admissionDate: '',
    dischargeDate: '',
    medicalHistory: '',
    medications: [],
    careLevel: 1
  });

  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [roomNumberError, setRoomNumberError] = useState('');

  // 統合エラーハンドリングとパフォーマンス監視
  const { handleFirestoreError } = useErrorHandler();
  const { measureAsyncOperation, measureInteraction } = usePerformanceMonitor('ResidentForm');

  // 半角スペースを全角スペースに変換
  const convertSpacesToFullWidth = (text: string): string => {
    return text.replace(/ /g, '　');
  };

  // 部屋番号の半角数字バリデーション
  const validateRoomNumber = (roomNumber: string): string => {
    if (!roomNumber) return '';
    if (!/^[0-9]+$/.test(roomNumber)) {
      return '部屋番号は半角数字のみで入力してください';
    }
    return '';
  };

  const handleInputChange = (field: keyof ResidentFormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const value = event.target.value;
    setFormData(prev => ({
      ...prev,
      [field]: field === 'careLevel' ? Number(value) : value
    }));
  };

  const calculateAge = (birthDate: string): number => {
    if (!birthDate) return 0;
    const today = dayjs();
    const birth = dayjs(birthDate);
    return today.diff(birth, 'year');
  };

  const resetForm = () => {
    setFormData({
      name: '',
      furigana: '',
      gender: '男性',
      birthDate: '',
      roomNumber: '',
      admissionDate: '',
      dischargeDate: '',
      medicalHistory: '',
      medications: [],
      careLevel: 1
    });
    setRoomNumberError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const endMeasurement = measureInteraction('form_submit', performance.now());
    setLoading(true);

    try {
      logger.userAction('resident_form_submit_started', {
        component: 'ResidentForm',
        formData: {
          name: formData.name,
          roomNumber: formData.roomNumber,
          careLevel: formData.careLevel
        }
      });

      await measureAsyncOperation(
        () => residentService.create(formData),
        'create_resident'
      );

      setAlert({
        show: true,
        message: '入所者情報を正常に登録しました',
        type: 'success'
      });

      logger.userAction('resident_created_success', {
        component: 'ResidentForm',
        residentName: formData.name,
        roomNumber: formData.roomNumber
      });

      resetForm();
    } catch (error: unknown) {
      const errorMessage = handleFirestoreError(error, 'create', {
        component: 'ResidentForm',
        residentName: formData.name,
        roomNumber: formData.roomNumber
      });

      setAlert({
        show: true,
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setLoading(false);
      endMeasurement();
    }

    // Auto-hide alert after 4 seconds
    setTimeout(() => {
      setAlert(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const isFormValid = () => {
    return formData.name.trim() !== '' &&
           formData.furigana.trim() !== '' &&
           formData.birthDate !== '' &&
           formData.roomNumber.trim() !== '' &&
           formData.admissionDate !== '' &&
           !roomNumberError;
  };

  const hideAlert = () => {
    setAlert(prev => ({ ...prev, show: false }));
  };

  return (
    <div className="space-y-6 relative">
      {/* Alert notification */}
      {alert.show && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md mx-auto px-4">
          <div className={`
            flex items-center justify-between p-4 rounded-lg shadow-lg border
            ${alert.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
            }
          `}>
            <span className="font-medium">{alert.message}</span>
            <button
              onClick={hideAlert}
              className={`
                ml-3 text-lg font-semibold hover:opacity-70 transition-opacity
                ${alert.type === 'success' ? 'text-green-600' : 'text-red-600'}
              `}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <UserIcon className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">新規入所者登録</h2>
          </div>

          <div className="max-w-4xl">
            <form onSubmit={handleSubmit}>
            {/* Name and Furigana */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  氏名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: convertSpacesToFullWidth(e.target.value) }))}
                  required
                  placeholder="例: 山田　太郎"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                />
                <p className="text-xs text-gray-500 mt-1">※スペースは自動的に全角に変換されます</p>
              </div>
              <div>
                <label htmlFor="furigana" className="block text-sm font-medium text-gray-700 mb-2">
                  フリガナ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="furigana"
                  value={formData.furigana}
                  onChange={(e) => setFormData(prev => ({ ...prev, furigana: convertSpacesToFullWidth(e.target.value) }))}
                  required
                  placeholder="例: ヤマダ　タロウ"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                />
                <p className="text-xs text-gray-500 mt-1">※スペースは自動的に全角に変換されます</p>
              </div>
            </div>

            {/* Gender and Birth Date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-2">
                  性別 <span className="text-red-500">*</span>
                </label>
                <select
                  id="gender"
                  value={formData.gender}
                  onChange={handleInputChange('gender')}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                >
                  <option value="男性">男性</option>
                  <option value="女性">女性</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="birthDate" className="block text-sm font-medium text-gray-700 mb-2">
                  生年月日 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="birthDate"
                  value={formData.birthDate}
                  onChange={handleInputChange('birthDate')}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                />
                {formData.birthDate && (
                  <p className="text-xs text-gray-600 mt-1">年齢: {calculateAge(formData.birthDate)}歳</p>
                )}
              </div>
            </div>

            {/* Room Number and Care Level */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div>
                <label htmlFor="roomNumber" className="block text-sm font-medium text-gray-700 mb-2">
                  部屋番号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="roomNumber"
                  value={formData.roomNumber}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData(prev => ({ ...prev, roomNumber: value }));
                    setRoomNumberError(validateRoomNumber(value));
                  }}
                  required
                  placeholder="例: 101"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 transition-colors duration-200 ${
                    roomNumberError
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                <p className={`text-xs mt-1 ${roomNumberError ? 'text-red-500' : 'text-gray-500'}`}>
                  {roomNumberError || '※半角数字のみで入力してください'}
                </p>
              </div>
              <div>
                <label htmlFor="careLevel" className="block text-sm font-medium text-gray-700 mb-2">
                  要介護度 <span className="text-red-500">*</span>
                </label>
                <select
                  id="careLevel"
                  value={formData.careLevel}
                  onChange={handleInputChange('careLevel')}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                >
                  <option value={1}>要介護1</option>
                  <option value={2}>要介護2</option>
                  <option value={3}>要介護3</option>
                  <option value={4}>要介護4</option>
                  <option value={5}>要介護5</option>
                </select>
              </div>
            </div>

            {/* Admission and Discharge Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div>
                <label htmlFor="admissionDate" className="block text-sm font-medium text-gray-700 mb-2">
                  入所日 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="admissionDate"
                  value={formData.admissionDate}
                  onChange={handleInputChange('admissionDate')}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                />
              </div>
              <div>
                <label htmlFor="dischargeDate" className="block text-sm font-medium text-gray-700 mb-2">
                  退所日（任意）
                </label>
                <input
                  type="date"
                  id="dischargeDate"
                  value={formData.dischargeDate || ''}
                  onChange={handleInputChange('dischargeDate')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                />
              </div>
            </div>

            {/* Medical History */}
            <div className="mb-6">
              <label htmlFor="medicalHistory" className="block text-sm font-medium text-gray-700 mb-2">
                既往歴・医療情報
              </label>
              <textarea
                id="medicalHistory"
                value={formData.medicalHistory}
                onChange={handleInputChange('medicalHistory')}
                rows={3}
                placeholder="既往歴、アレルギー、注意事項など"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 resize-vertical"
              />
            </div>

            {/* Medications */}
            <div className="mb-8">
              <MedicationInput
                medications={formData.medications}
                onChange={(medications) => setFormData(prev => ({ ...prev, medications }))}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={resetForm}
                disabled={loading}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2"
              >
                <ArrowPathIcon className="w-4 h-4" />
                リセット
              </button>

              <button
                type="submit"
                disabled={loading || !isFormValid()}
                className="px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-2"
              >
                <CheckIcon className="w-4 h-4" />
                {loading ? '登録中...' : '登録'}
              </button>
            </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResidentForm;