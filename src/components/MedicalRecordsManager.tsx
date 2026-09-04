import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { PencilIcon, PencilSquareIcon, ClockIcon, XMarkIcon, DocumentTextIcon, PlusIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline';
import ModalHeader from './common/ModalHeader';
import ListSectionHeader from './common/ListSectionHeader';
import ConfirmDialog from './common/ConfirmDialog';
import Snackbar from './common/Snackbar';
import EmptyState from './common/EmptyState';
import { medicalRecordService } from '../services/firestore';
import { useAuth } from '../hooks/useAuth';
import type { Resident, MedicalRecord, MedicalRecordFormData, MedicalRecordRevision } from '../types';

interface MedicalRecordsManagerProps {
  resident: Resident;
  open: boolean;
  onClose: () => void;
  embedded?: boolean;
}

const RECORDS_PER_PAGE = 10;

const MedicalRecordsManager = ({ resident, open, onClose, embedded = false }: MedicalRecordsManagerProps) => {
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

  // 訂正履歴ビュー
  const [revisionView, setRevisionView] = useState<{ open: boolean; record: MedicalRecord | null; revisions: MedicalRecordRevision[] }>({
    open: false,
    record: null,
    revisions: []
  });

  const { user } = useAuth();
  const { t } = useTranslation();
  const author = { uid: user?.uid ?? '', name: user?.displayName ?? user?.email ?? '不明' };

  const loadMedicalRecords = useCallback(async () => {
    try {
      setLoading(true);
      const records = await medicalRecordService.getByResidentId(resident.id);
      setMedicalRecords(records);
      setCurrentPage(1);
    } catch {
      showSnackbar(t('medicalRecord.loadError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [resident.id, t]);

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
      await medicalRecordService.delete(deleteConfirmDialog.recordId, author);
      await loadMedicalRecords();
      showSnackbar(t('medicalRecord.deletedOk'), 'success');
      setDeleteConfirmDialog({ open: false, recordId: '', recordDate: '' });
    } catch {
      showSnackbar(t('medicalRecord.deleteError'), 'error');
    }
  };

  const handleViewRevisions = async (record: MedicalRecord) => {
    const revisions = await medicalRecordService.getRevisions(record.id);
    setRevisionView({ open: true, record, revisions });
  };

  const handleRecordSubmit = async () => {
    if (!recordForm.record.trim()) return;

    setFormLoading(true);
    try {
      if (editingRecord) {
        await medicalRecordService.update(editingRecord.id, recordForm, author);
        showSnackbar(t('medicalRecord.updatedOk'), 'success');
      } else {
        await medicalRecordService.create(resident.id, recordForm, author);
        showSnackbar(t('medicalRecord.createdOk'), 'success');
      }
      await loadMedicalRecords();
      setRecordDialogOpen(false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('medicalRecord.saveError');
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

  const content = (
    <>
      <ListSectionHeader title={t('medicalRecord.listTitle')} badge={t('medicalRecord.count', { count: medicalRecords.length })}>
        <button
          onClick={handleAddRecord}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
        >
          <PlusIcon className="w-5 h-5" />
          {t('medicalRecord.add')}
        </button>
      </ListSectionHeader>

              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="text-gray-600">{t('app.loading')}</span>
                  </div>
                </div>
              ) : medicalRecords.length === 0 ? (
                <EmptyState title={t('medicalRecord.empty')} hint={t('medicalRecord.emptyHint')} />
              ) : (
                <div className="space-y-4">
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">{t('medicalRecord.colDate')}</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">{t('medicalRecord.colRecord')}</th>
                          <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 w-32">{t('medicalRecord.colActions')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {currentRecords.map((record) => (
                          <tr key={record.id} className="hover:bg-gray-50 transition-colors duration-200">
                            <td className="px-6 py-4 w-40">
                              <div className="text-sm font-medium text-blue-600 whitespace-nowrap">
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
                              <div className="text-xs text-gray-400 mt-1">
                                {t('common.createdBy', { name: record.createdBy?.name ?? '-', date: dayjs(record.createdAt).format('YYYY/MM/DD HH:mm') })}
                                {record.updatedBy && (
                                  <> / {t('common.updatedBy', { name: record.updatedBy.name, date: dayjs(record.updatedAt).format('YYYY/MM/DD HH:mm') })}</>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => handleViewRevisions(record)}
                                  className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors duration-200"
                                  title={t('medicalRecord.revisionsTip')}
                                >
                                  <ClockIcon className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleEditRecord(record)}
                                  className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full transition-colors duration-200"
                                  title={t('common.edit')}
                                >
                                  <PencilSquareIcon className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRecord(record)}
                                  className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full transition-colors duration-200"
                                  title={t('medicalRecord.deleteTip')}
                                >
                                  <TrashIcon className="w-4 h-4" />
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
                          {t('common.first')}
                        </button>
                        <button
                          onClick={() => handlePageChange(null, currentPage - 1)}
                          disabled={currentPage === 1}
                          className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {t('common.prev')}
                        </button>
                        <span className="px-4 py-2 text-sm font-medium text-gray-700">
                          {currentPage} / {totalPages}
                        </span>
                        <button
                          onClick={() => handlePageChange(null, currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {t('common.next')}
                        </button>
                        <button
                          onClick={() => handlePageChange(null, totalPages)}
                          disabled={currentPage === totalPages}
                          className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {t('common.last')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
    </>
  );

  return (
    <>
      {open && (embedded ? (
        <div className="p-6">{content}</div>
      ) : (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <ModalHeader
              title={t('medicalRecord.title', { name: resident.name })}
              subtitle={t('resident.subtitle', { gender: t(resident.gender === '男性' ? 'resident.male' : 'resident.female'), age: calculateAge(resident.birthDate), room: resident.roomNumber })}
              icon={DocumentTextIcon}
              onClose={onClose}
            />
            <div className="p-6 max-h-[calc(90vh-200px)] overflow-y-auto">
              {content}
            </div>
          </div>
        </div>
      ))}

      {/* Record Edit Dialog */}
      {recordDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Dialog Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <PencilIcon className="w-5 h-5" />
                {editingRecord ? t('medicalRecord.editTitle') : t('medicalRecord.addTitle')}
              </h3>
            </div>

            {/* Dialog Content */}
            <div className="p-6 space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('medicalRecord.dateLabel')}
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
                  {t('medicalRecord.recordLabel')}
                </label>
                <textarea
                  value={recordForm.record}
                  onChange={(e) => setRecordForm(prev => ({ ...prev, record: e.target.value }))}
                  placeholder={t('medicalRecord.recordPh')}
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
                <XMarkIcon className="w-4 h-4" />
                {t('common.cancel')}
              </button>
              <button
                onClick={handleRecordSubmit}
                disabled={formLoading || !recordForm.record.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckIcon className="w-4 h-4" />
                {formLoading ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      <Snackbar open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={handleCloseSnackbar} />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmDialog.open}
        title={t('medicalRecord.deleteConfirmTitle')}
        message={t('medicalRecord.deleteConfirmMsg', { date: deleteConfirmDialog.recordDate, name: resident.name })}
        note={t('medicalRecord.deleteNote')}
        confirmButtonText={t('common.delete')}
        confirmButtonVariant="danger"
        onConfirm={confirmDeleteRecord}
        onCancel={() => setDeleteConfirmDialog({ open: false, recordId: '', recordDate: '' })}
      />

      {/* 訂正履歴ビュー */}
      {revisionView.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[120] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{t('medicalRecord.revisionsTitle')}</h3>
              <button onClick={() => setRevisionView({ open: false, record: null, revisions: [] })} className="text-gray-400 hover:text-gray-600" aria-label={t('common.close')}>
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)] space-y-4">
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
                <div className="text-xs font-medium text-blue-700 mb-1">{t('medicalRecord.current')}</div>
                <div className="text-sm text-gray-900 whitespace-pre-wrap">{revisionView.record?.record}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {t('common.updatedBy', { name: revisionView.record?.updatedBy?.name ?? '-', date: revisionView.record ? dayjs(revisionView.record.updatedAt).format('YYYY/MM/DD HH:mm') : '' })}
                </div>
              </div>
              {revisionView.revisions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">{t('medicalRecord.noRevisions')}</p>
              ) : (
                revisionView.revisions.map((rev, i) => (
                  <div key={rev.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="text-xs font-medium text-gray-500 mb-1">{t('medicalRecord.beforeEdit', { n: revisionView.revisions.length - i })}</div>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">{rev.record}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {t('medicalRecord.recordedBy', { name: rev.editedBy?.name ?? '-', date: dayjs(rev.editedAt).format('YYYY/MM/DD HH:mm') })}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button onClick={() => setRevisionView({ open: false, record: null, revisions: [] })} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MedicalRecordsManager;