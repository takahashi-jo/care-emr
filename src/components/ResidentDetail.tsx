import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { medicalRecordService } from '../services/firestore';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { logger } from '../services/logger';
import ConfirmDialog from './common/ConfirmDialog';
import type { Resident, MedicalRecord, MedicalRecordFormData } from '../types';

interface ResidentDetailProps {
  resident: Resident;
  onUpdate: () => void;
}

const ResidentDetail = ({ resident }: ResidentDetailProps) => {
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);
  const [recordForm, setRecordForm] = useState<MedicalRecordFormData>({
    date: dayjs().format('YYYY-MM-DD'),
    record: ''
  });
  const [recordDateValue, setRecordDateValue] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; recordId: string | null }>({
    isOpen: false,
    recordId: null
  });

  const { handleFirestoreError } = useErrorHandler();
  const { measureAsyncOperation, measureInteraction } = usePerformanceMonitor('ResidentDetail');


  const loadMedicalRecords = useCallback(async () => {
    try {
      logger.userAction('medical_records_load_started', {
        component: 'ResidentDetail',
        residentId: resident.id,
        residentName: resident.name
      });

      const records = await measureAsyncOperation(
        () => medicalRecordService.getByResidentId(resident.id),
        'load_medical_records'
      );

      setMedicalRecords(records);

      logger.userAction('medical_records_loaded_success', {
        component: 'ResidentDetail',
        residentId: resident.id,
        recordsCount: records.length
      });
    } catch (error: unknown) {
      const errorMessage = handleFirestoreError(error, 'load', {
        component: 'ResidentDetail',
        residentId: resident.id,
        residentName: resident.name
      });

      setAlert({
        show: true,
        message: errorMessage,
        type: 'error'
      });
    }
  }, [resident.id, resident.name, measureAsyncOperation, handleFirestoreError]);

  useEffect(() => {
    loadMedicalRecords();
  }, [loadMedicalRecords]);

  const calculateAge = (birthDate: Date): number => {
    return dayjs().diff(dayjs(birthDate), 'year');
  };

  const handleAddRecord = () => {
    setEditingRecord(null);
    setRecordForm({
      date: dayjs().format('YYYY-MM-DD'),
      record: ''
    });
    setRecordDateValue(dayjs().format('YYYY-MM-DD'));
    setRecordDialogOpen(true);
  };

  const handleEditRecord = (record: MedicalRecord) => {
    setEditingRecord(record);
    setRecordForm({
      date: dayjs(record.date).format('YYYY-MM-DD'),
      record: record.record
    });
    setRecordDateValue(dayjs(record.date).format('YYYY-MM-DD'));
    setRecordDialogOpen(true);
  };

  const handleDeleteRecord = (recordId: string) => {
    setDeleteConfirm({ isOpen: true, recordId });
  };

  const confirmDeleteRecord = async () => {
    const recordId = deleteConfirm.recordId;
    if (!recordId) return;

    const endMeasurement = measureInteraction('delete_medical_record', performance.now());

    try {
      logger.userAction('medical_record_delete_started', {
        component: 'ResidentDetail',
        recordId,
        residentId: resident.id,
        residentName: resident.name
      });

      await measureAsyncOperation(
        () => medicalRecordService.delete(recordId),
        'delete_medical_record'
      );

      await loadMedicalRecords();

      logger.userAction('medical_record_deleted_success', {
        component: 'ResidentDetail',
        recordId,
        residentId: resident.id
      });

      setAlert({
        show: true,
        message: '診療録を削除しました',
        type: 'success'
      });
    } catch (error: unknown) {
      const errorMessage = handleFirestoreError(error, 'delete', {
        component: 'ResidentDetail',
        recordId,
        residentId: resident.id,
        residentName: resident.name
      });

      setAlert({
        show: true,
        message: errorMessage,
        type: 'error'
      });
    } finally {
      endMeasurement();
      setDeleteConfirm({ isOpen: false, recordId: null });
    }
  };

  const cancelDeleteRecord = () => {
    setDeleteConfirm({ isOpen: false, recordId: null });
  };

  const handleRecordSubmit = async () => {
    if (!recordForm.record.trim()) return;

    const endMeasurement = measureInteraction('save_medical_record', performance.now());
    setLoading(true);

    try {
      const operation = editingRecord ? 'update' : 'create';

      logger.userAction(`medical_record_${operation}_started`, {
        component: 'ResidentDetail',
        recordId: editingRecord?.id,
        residentId: resident.id,
        residentName: resident.name,
        recordDate: recordForm.date
      });

      if (editingRecord) {
        await measureAsyncOperation(
          () => medicalRecordService.update(editingRecord.id, recordForm),
          'update_medical_record'
        );
      } else {
        await measureAsyncOperation(
          () => medicalRecordService.create(resident.id, recordForm),
          'create_medical_record'
        );
      }

      await loadMedicalRecords();
      setRecordDialogOpen(false);

      logger.userAction(`medical_record_${operation}_success`, {
        component: 'ResidentDetail',
        recordId: editingRecord?.id,
        residentId: resident.id
      });

      setAlert({
        show: true,
        message: editingRecord ? '診療録を更新しました' : '診療録を追加しました',
        type: 'success'
      });
    } catch (error: unknown) {
      const operation = editingRecord ? 'update' : 'create';
      const errorMessage = handleFirestoreError(error, operation, {
        component: 'ResidentDetail',
        recordId: editingRecord?.id,
        residentId: resident.id,
        residentName: resident.name
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
  };

  const handleRecordDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const dateString = event.target.value;
    setRecordForm(prev => ({ ...prev, date: dateString }));
    setRecordDateValue(dateString);
  };

  const hideAlert = () => {
    setAlert(prev => ({ ...prev, show: false }));
  };

  useEffect(() => {
    if (alert.show) {
      const timer = setTimeout(() => {
        hideAlert();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [alert.show]);

  return (
    <div className="relative">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information Card */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">基本情報</h3>
            <div className="space-y-3">
              <div className="flex">
                <span className="font-medium text-gray-700 w-20">名前:</span>
                <span className="text-gray-900">{resident.name}</span>
              </div>
              <div className="flex">
                <span className="font-medium text-gray-700 w-20">性別:</span>
                <span className="text-gray-900">{resident.gender}</span>
              </div>
              <div className="flex">
                <span className="font-medium text-gray-700 w-20">生年月日:</span>
                <span className="text-gray-900">
                  {dayjs(resident.birthDate).format('YYYY年MM月DD日')}
                  （{calculateAge(resident.birthDate)}歳）
                </span>
              </div>
              <div className="flex">
                <span className="font-medium text-gray-700 w-20">部屋番号:</span>
                <span className="text-gray-900">{resident.roomNumber}</span>
              </div>
              <div className="flex">
                <span className="font-medium text-gray-700 w-20">入所日:</span>
                <span className="text-gray-900">{dayjs(resident.admissionDate).format('YYYY年MM月DD日')}</span>
              </div>
              {resident.dischargeDate && (
                <div className="flex">
                  <span className="font-medium text-gray-700 w-20">退所日:</span>
                  <span className="text-gray-900">{dayjs(resident.dischargeDate).format('YYYY年MM月DD日')}</span>
                </div>
              )}
              <div className="flex gap-2 mt-4">
                {resident.careLevel ? (
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
                    要介護{resident.careLevel}
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-gray-100 text-gray-800 text-sm font-medium rounded-full">
                    要介護度なし
                  </span>
                )}
                {resident.dischargeDate ? (
                  <span className="px-3 py-1 bg-gray-100 text-gray-800 text-sm font-medium rounded-full">
                    退所済み
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                    入所中
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Medical Information Card */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">医療情報</h3>

            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">処方薬:</h4>
              {resident.medications.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {resident.medications.map((medication, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full"
                    >
                      {medication}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">処方薬なし</p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">既往歴:</h4>
              <p className={`text-sm ${resident.medicalHistory ? 'text-gray-900' : 'text-gray-500'}`}>
                {resident.medicalHistory || '記載なし'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Medical Records Section */}
      <div className="mt-6">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                診療録 ({medicalRecords.length}件)
              </h3>
              <button
                onClick={handleAddRecord}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                新規記録
              </button>
            </div>

            {medicalRecords.length === 0 ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-blue-800 text-sm font-medium">
                    診療録がありません。「新規記録」ボタンから記録を追加してください。
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {medicalRecords.map((record) => (
                  <div key={record.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-sm font-medium text-blue-600">
                        {dayjs(record.date).format('YYYY年MM月DD日')}
                      </h4>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditRecord(record)}
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                          title="編集"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(record.id)}
                          className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors"
                          title="削除"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">
                      {record.record}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Record Edit Dialog */}
      {recordDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Dialog Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingRecord ? '診療録編集' : '新規診療録'}
              </h3>
            </div>

            {/* Dialog Content */}
            <div className="p-6 space-y-4 max-h-[calc(90vh-140px)] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  日付
                </label>
                <input
                  type="date"
                  value={recordDateValue}
                  onChange={handleRecordDateChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  診療記録
                </label>
                <textarea
                  value={recordForm.record}
                  onChange={(e) => setRecordForm(prev => ({ ...prev, record: e.target.value }))}
                  placeholder="診療記録を入力してください"
                  required
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                />
              </div>
            </div>

            {/* Dialog Actions */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setRecordDialogOpen(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleRecordSubmit}
                disabled={loading || !recordForm.record.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="診療録の削除"
        message="この診療録を削除しますか？削除した診療録は復元できません。"
        confirmButtonText="削除"
        cancelButtonText="キャンセル"
        confirmButtonVariant="danger"
        onConfirm={confirmDeleteRecord}
        onCancel={cancelDeleteRecord}
      />
    </div>
  );
};

export default ResidentDetail;