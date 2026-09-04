import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { ClipboardDocumentListIcon, PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { problemService } from '../services/firestore';
import { useAuth } from '../hooks/useAuth';
import ConfirmDialog from './common/ConfirmDialog';
import ModalHeader from './common/ModalHeader';
import Snackbar from './common/Snackbar';
import EmptyState from './common/EmptyState';
import DiseaseNameAutocomplete from './DiseaseNameAutocomplete';
import type { Resident, Problem, ProblemFormData, ProblemStatus } from '../types';

interface ProblemsManagerProps {
  resident: Resident;
  open: boolean;
  onClose: () => void;
}

const emptyForm = (nextNumber: number): ProblemFormData => ({
  number: String(nextNumber),
  title: '',
  icd10: undefined,
  status: '現行',
  onsetDate: '',
  resolvedDate: '',
  notes: '',
});

const ProblemsManager = ({ resident, open, onClose }: ProblemsManagerProps) => {
  const { t } = useTranslation();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Problem | null>(null);
  const [form, setForm] = useState<ProblemFormData>(emptyForm(1));
  const [formLoading, setFormLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [confirm, setConfirm] = useState<{ kind: 'resolve' | 'delete' | null; problem: Problem | null }>({ kind: null, problem: null });

  const { user } = useAuth();
  const author = { uid: user?.uid ?? '', name: user?.displayName ?? user?.email ?? '不明' };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
    setTimeout(() => setSnackbar(prev => ({ ...prev, open: false })), 4000);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setProblems(await problemService.getByResidentId(resident.id));
    } catch {
      showSnackbar(t('problem.loadError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [resident.id]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const nextNumber = () => problems.reduce((m, p) => Math.max(m, p.number), 0) + 1;

  const handleAdd = () => {
    setEditing(null);
    setForm(emptyForm(nextNumber()));
    setFormOpen(true);
  };

  const handleEdit = (p: Problem) => {
    setEditing(p);
    setForm({
      number: String(p.number),
      title: p.title,
      icd10: p.icd10,
      status: p.status,
      onsetDate: p.onsetDate ? dayjs(p.onsetDate).format('YYYY-MM-DD') : '',
      resolvedDate: p.resolvedDate ? dayjs(p.resolvedDate).format('YYYY-MM-DD') : '',
      notes: p.notes || '',
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setFormLoading(true);
    try {
      if (editing) {
        await problemService.update(resident.id, editing.id, form, author);
        showSnackbar(t('problem.updatedOk'), 'success');
      } else {
        await problemService.create(resident.id, form, author);
        showSnackbar(t('problem.addedOk'), 'success');
      }
      await load();
      setFormOpen(false);
    } catch (error: unknown) {
      showSnackbar(error instanceof Error ? error.message : t('problem.saveError'), 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const confirmAction = async () => {
    const { kind, problem } = confirm;
    if (!kind || !problem) return;
    try {
      if (kind === 'resolve') {
        await problemService.resolve(resident.id, problem.id, dayjs().format('YYYY-MM-DD'), author);
        showSnackbar(t('problem.resolvedOk'), 'success');
      } else {
        await problemService.delete(resident.id, problem.id, author);
        showSnackbar(t('problem.deletedOk'), 'success');
      }
      await load();
    } catch {
      showSnackbar(kind === 'resolve' ? t('problem.resolveError') : t('problem.deleteError'), 'error');
    } finally {
      setConfirm({ kind: null, problem: null });
    }
  };

  if (!open) return null;

  const activeCount = problems.filter(p => p.status === '現行').length;
  const calculateAge = (birthDate: Date): number => dayjs().diff(dayjs(birthDate), 'year');

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <ModalHeader
            title={t('problem.title', { name: resident.name })}
            subtitle={t('resident.subtitle', { gender: t(resident.gender === '男性' ? 'resident.male' : 'resident.female'), age: calculateAge(resident.birthDate), room: resident.roomNumber })}
            icon={ClipboardDocumentListIcon}
            onClose={onClose}
          />

          <div className="p-6 max-h-[calc(90vh-180px)] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold text-gray-800">{t('problem.listTitle')}</h3>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">{t('problem.count', { active: activeCount, total: problems.length })}</span>
              </div>
              <button
                onClick={handleAdd}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
              >
                <PlusIcon className="w-5 h-5" />
                {t('problem.add')}
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : problems.length === 0 ? (
              <EmptyState title={t('problem.empty')} hint={t('problem.emptyHint')} />
            ) : (
              <div className="space-y-3">
                {problems.map((p) => {
                  const resolved = p.status === '消失';
                  return (
                    <div
                      key={p.id}
                      className={`border rounded-lg p-4 ${resolved ? 'bg-gray-50 border-gray-200 opacity-80' : 'bg-white border-indigo-200'}`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-gray-100 text-gray-700">#{p.number}</span>
                            <span className="font-semibold text-gray-900">{p.title}</span>
                            {p.icd10 && <span className="text-xs text-gray-400">ICD-10: {p.icd10}</span>}
                            {resolved ? (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 text-gray-700">{t('problem.statusResolved')}</span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">{t('problem.statusActive')}</span>
                            )}
                          </div>
                          {(p.onsetDate || p.resolvedDate) && (
                            <div className="text-xs text-gray-500 mt-1">
                              {p.onsetDate && t('problem.onsetLabel', { date: dayjs(p.onsetDate).format('YYYY/MM/DD') })}
                              {p.resolvedDate && <> / {t('problem.resolvedLabel', { date: dayjs(p.resolvedDate).format('YYYY/MM/DD') })}</>}
                            </div>
                          )}
                          {p.notes && <div className="text-xs text-gray-600 mt-1">{t('problem.notesInline', { text: p.notes })}</div>}
                          <div className="text-xs text-gray-400 mt-1">
                            {t('common.createdBy', { name: p.createdBy?.name ?? '-', date: dayjs(p.createdAt).format('YYYY/MM/DD HH:mm') })}
                            {p.updatedBy && <> / {t('common.updatedBy', { name: p.updatedBy.name, date: dayjs(p.updatedAt).format('YYYY/MM/DD HH:mm') })}</>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {!resolved && (
                            <button
                              onClick={() => setConfirm({ kind: 'resolve', problem: p })}
                              className="px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 border border-gray-300 rounded transition-colors"
                              title={t('problem.resolve')}
                            >
                              {t('problem.resolve')}
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(p)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title={t('common.edit')}
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirm({ kind: 'delete', problem: p })}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title={t('common.delete')}
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 追加 / 編集ダイアログ */}
      {formOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <PencilIcon className="w-5 h-5" />
                {editing ? t('problem.editTitle') : t('problem.addTitle')}
              </h3>
            </div>

            <div className="p-6 space-y-4 max-h-[calc(90vh-140px)] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('problem.number')}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.number}
                    onChange={(e) => setForm(prev => ({ ...prev, number: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('problem.name')} <span className="text-red-500">*</span></label>
                  <DiseaseNameAutocomplete
                    value={form.title}
                    onChange={(title, item) => setForm(prev => ({ ...prev, title, icd10: item?.icd10 }))}
                    placeholder={t('problem.namePh')}
                  />
                  {form.icd10 && (
                    <p className="text-xs text-gray-400 mt-1">ICD-10: {form.icd10}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('problem.state')}</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value as ProblemStatus }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="現行">{t('problem.statusActive')}</option>
                    <option value="消失">{t('problem.statusResolved')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('problem.onset')}</label>
                  <input
                    type="date"
                    value={form.onsetDate}
                    onChange={(e) => setForm(prev => ({ ...prev, onsetDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {form.status === '消失' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('problem.resolvedDate')}</label>
                  <input
                    type="date"
                    value={form.resolvedDate}
                    onChange={(e) => setForm(prev => ({ ...prev, resolvedDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('problem.notesLabel')}</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder={t('problem.notesPh')}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setFormOpen(false)}
                disabled={formLoading}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={formLoading || !form.title.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formLoading ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 通知 */}
      <Snackbar open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} />

      {/* 消失 / 削除の確認 */}
      <ConfirmDialog
        isOpen={confirm.kind !== null}
        title={confirm.kind === 'resolve' ? t('problem.resolveConfirmTitle') : t('problem.deleteConfirmTitle')}
        message={
          confirm.kind === 'resolve'
            ? t('problem.resolveConfirmMsg', { number: confirm.problem?.number, title: confirm.problem?.title })
            : t('problem.deleteConfirmMsg', { number: confirm.problem?.number, title: confirm.problem?.title })
        }
        note={confirm.kind === 'delete' ? t('common.deleteNote') : undefined}
        confirmButtonText={confirm.kind === 'resolve' ? t('problem.resolve') : t('common.delete')}
        cancelButtonText={t('common.cancel')}
        confirmButtonVariant={confirm.kind === 'resolve' ? 'primary' : 'danger'}
        onConfirm={confirmAction}
        onCancel={() => setConfirm({ kind: null, problem: null })}
      />
    </>
  );
};

export default ProblemsManager;
