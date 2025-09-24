import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { PencilIcon } from '@heroicons/react/24/outline';
import { medicalRecordService } from '../services/firestore';
import type { Resident, MedicalRecord, MedicalRecordFormData } from '../types';

interface MedicalRecordsManagerProps {
  resident: Resident;
  open: boolean;
  onClose: () => void;
}

const RECORDS_PER_PAGE = 10;

const MedicalRecordsManager = ({ resident, open, onClose }: MedicalRecordsManagerProps) => {
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // フォーム関連
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);
  const [recordForm, setRecordForm] = useState<MedicalRecordFormData>({
    date: dayjs().format('YYYY-MM-DD'),
    record: ''
  });
  const [recordDateValue, setRecordDateValue] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [formLoading, setFormLoading] = useState(false);

  // 通知
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });

  // 削除確認ダイアログ
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({
    open: false,
    recordId: '',
    recordDate: ''
  });

  const loadMedicalRecords = useCallback(async () => {
    try {
      setLoading(true);
      const records = await medicalRecordService.getByResidentId(resident.id);
      setMedicalRecords(records);
      setCurrentPage(1);
    } catch {
      showSnackbar('診療録の読み込みに失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  }, [resident.id]);

  useEffect(() => {
    if (open) {
      loadMedicalRecords();
    }
  }, [open, loadMedicalRecords]);

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
    setTimeout(() => {
      setSnackbar(prev => ({ ...prev, open: false }));
    }, 4000);
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
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

  const handleDeleteRecord = (record: MedicalRecord) => {
    setDeleteConfirmDialog({
      open: true,
      recordId: record.id,
      recordDate: dayjs(record.date).format('YYYY年MM月DD日')
    });
  };

  const confirmDeleteRecord = async () => {
    try {
      await medicalRecordService.delete(deleteConfirmDialog.recordId);
      await loadMedicalRecords();
      showSnackbar('診療録を削除しました', 'success');
      setDeleteConfirmDialog({ open: false, recordId: '', recordDate: '' });
    } catch {
      showSnackbar('削除に失敗しました', 'error');
    }
  };

  const handleRecordSubmit = async () => {
    if (!recordForm.record.trim()) return;

    setFormLoading(true);
    try {
      if (editingRecord) {
        await medicalRecordService.update(editingRecord.id, recordForm);
        showSnackbar('診療録を更新しました', 'success');
      } else {
        await medicalRecordService.create(resident.id, recordForm);
        showSnackbar('診療録を登録しました', 'success');
      }
      await loadMedicalRecords();
      setRecordDialogOpen(false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '保存に失敗しました';
      showSnackbar(errorMessage, 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleRecordDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const dateString = event.target.value;
    setRecordForm(prev => ({ ...prev, date: dateString }));
    setRecordDateValue(dateString);
  };

  const handlePageChange = (_event: React.ChangeEvent<unknown> | null, page: number) => {
    setCurrentPage(page);
  };

  // ペジネーション計算
  const totalPages = Math.ceil(medicalRecords.length / RECORDS_PER_PAGE);
  const startIndex = (currentPage - 1) * RECORDS_PER_PAGE;
  const endIndex = startIndex + RECORDS_PER_PAGE;
  const currentRecords = medicalRecords.slice(startIndex, endIndex);

  const calculateAge = (birthDate: Date): number => {
    return dayjs().diff(dayjs(birthDate), 'year');
  };

  return (
    <>
      {/* Main Records Manager Modal */}
      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 relative">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    {resident.name}さんの診療録
                  </h2>
                  <p className="text-blue-100 mt-1">
                    {resident.gender} • {calculateAge(resident.birthDate)}歳 • 部屋{resident.roomNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[calc(90vh-200px)] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold text-gray-800">
                    診療記録一覧
                  </h3>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                    {medicalRecords.length}件
                  </span>
                </div>
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

              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="text-gray-600">読み込み中...</span>
                  </div>
                </div>
              ) : medicalRecords.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center bg-gray-50">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h4 className="text-lg font-semibold text-gray-600 mb-2">
                    診療録がありません
                  </h4>
                  <p className="text-sm text-gray-500 mb-6">
                    「新規記録」ボタンから最初の診療録を作成してください
                  </p>
                  <button
                    onClick={handleAddRecord}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium mx-auto"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    診療録を作成
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">日付</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">記録</th>
                          <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 w-32">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {currentRecords.map((record) => (
                          <tr key={record.id} className="hover:bg-gray-50 transition-colors duration-200">
                            <td className="px-6 py-4 w-40">
                              <div className="text-sm font-medium text-blue-600">
                                {dayjs(record.date).format('YYYY年MM月DD日')}
                              </div>
                              <div className="text-xs text-gray-500">
                                {dayjs(record.date).format('(ddd)')}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 whitespace-pre-wrap max-w-md line-clamp-3">
                                {record.record}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => handleEditRecord(record)}
                                  className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full transition-colors duration-200"
                                  title="編集"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteRecord(record)}
                                  className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full transition-colors duration-200"
                                  title="削除"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex justify-center">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePageChange(null, 1)}
                          disabled={currentPage === 1}
                          className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          最初
                        </button>
                        <button
                          onClick={() => handlePageChange(null, currentPage - 1)}
                          disabled={currentPage === 1}
                          className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          前へ
                        </button>
                        <span className="px-4 py-2 text-sm font-medium text-gray-700">
                          {currentPage} / {totalPages}
                        </span>
                        <button
                          onClick={() => handlePageChange(null, currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          次へ
                        </button>
                        <button
                          onClick={() => handlePageChange(null, totalPages)}
                          disabled={currentPage === totalPages}
                          className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          最後
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Record Edit Dialog */}
      {recordDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Dialog Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <PencilIcon className="w-5 h-5" />
                {editingRecord ? '診療録編集' : '新規診療録'}
              </h3>
            </div>

            {/* Dialog Content */}
            <div className="p-6 space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  診療日
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
                  placeholder="診療記録を詳しく入力してください..."
                  required
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                />
              </div>
            </div>

            {/* Dialog Actions */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setRecordDialogOpen(false)}
                disabled={formLoading}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                キャンセル
              </button>
              <button
                onClick={handleRecordSubmit}
                disabled={formLoading || !recordForm.record.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {formLoading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Delete Confirmation Dialog */}
      {deleteConfirmDialog.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[120] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            {/* Dialog Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
              <h3 className="text-lg font-semibold text-red-800 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.99-.833-2.46 0L4.354 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                診療録の削除確認
              </h3>
            </div>

            {/* Dialog Content */}
            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-700 mb-2">
                  以下の診療録を削除しますか？
                </p>
                <div className="bg-gray-50 p-3 rounded-lg border">
                  <div className="text-sm font-medium text-gray-900">
                    {deleteConfirmDialog.recordDate}の診療録
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {resident.name}さん
                  </div>
                </div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">
                  ⚠️ この操作は取り消すことができません。
                </p>
              </div>
            </div>

            {/* Dialog Actions */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => setDeleteConfirmDialog({ open: false, recordId: '', recordDate: '' })}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                キャンセル
              </button>
              <button
                onClick={confirmDeleteRecord}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MedicalRecordsManager;