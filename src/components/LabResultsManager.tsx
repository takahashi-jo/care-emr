import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { ChartBarIcon, PlusIcon, PencilIcon, PencilSquareIcon, TrashIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import ModalHeader from './common/ModalHeader';
import ListSectionHeader from './common/ListSectionHeader';
import ConfirmDialog from './common/ConfirmDialog';
import Snackbar from './common/Snackbar';
import EmptyState from './common/EmptyState';
import { labResultService } from '../services/firestore';
import { useAuth } from '../hooks/useAuth';
import { LAB_ANALYTES, isLabAbnormal } from '../constants/labReference';
import type { Resident, LabResult, LabResultFormData } from '../types';

// recharts は重いので「推移」タブを開いたときだけ読み込む（遅延ロードでコード分割）
const LabTrend = lazy(() => import('./LabTrend'));

interface LabResultsManagerProps {
  resident: Resident;
  open: boolean;
  onClose: () => void;
  embedded?: boolean;
}

// 全項目を並べたパネル形式のフォーム。値を入れた項目だけ保存される。
const emptyForm = (): LabResultFormData => ({
  collectedAt: dayjs().format('YYYY-MM-DDTHH:mm'),
  items: LAB_ANALYTES.map((a) => ({
    code: a.code,
    name: a.name,
    value: '',
    unit: a.unit,
    refLow: a.refLow != null ? String(a.refLow) : '',
    refHigh: a.refHigh != null ? String(a.refHigh) : '',
  })),
  notes: '',
});

const LabResultsManager = ({ resident, open, onClose, embedded = false }: LabResultsManagerProps) => {
  const { t } = useTranslation();
  const [labs, setLabs] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'list' | 'trend'>('list');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LabResult | null>(null);
  const [form, setForm] = useState<LabResultFormData>(emptyForm());
  const [formLoading, setFormLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; lab: LabResult | null }>({ open: false, lab: null });

  const { user } = useAuth();
  const author = { uid: user?.uid ?? '', name: user?.displayName ?? user?.email ?? '不明' };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
    setTimeout(() => setSnackbar(prev => ({ ...prev, open: false })), 4000);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLabs(await labResultService.getByResidentId(resident.id));
    } catch {
      showSnackbar(t('labResult.loadError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [resident.id, t]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (lab: LabResult) => {
    setEditing(lab);
    setForm({
      collectedAt: dayjs(lab.collectedAt).format('YYYY-MM-DDTHH:mm'),
      items: LAB_ANALYTES.map((a) => {
        const found = lab.items.find((it) => it.code === a.code);
        return {
          code: a.code,
          name: a.name,
          value: found ? String(found.value) : '',
          unit: a.unit,
          refLow: (found?.refLow ?? a.refLow) != null ? String(found?.refLow ?? a.refLow) : '',
          refHigh: (found?.refHigh ?? a.refHigh) != null ? String(found?.refHigh ?? a.refHigh) : '',
        };
      }),
      notes: lab.notes ?? '',
    });
    setDialogOpen(true);
  };

  const setItemValue = (code: string, value: string) =>
    setForm(prev => ({ ...prev, items: prev.items.map(it => it.code === code ? { ...it, value } : it) }));

  const hasAnyValue = (f: LabResultFormData) => f.items.some(it => it.value.trim() !== '');
  const canSubmit = form.collectedAt !== '' && hasAnyValue(form);

  const submit = async () => {
    if (!canSubmit) return;
    setFormLoading(true);
    try {
      if (editing) {
        await labResultService.update(resident.id, editing.id, form, author);
        showSnackbar(t('labResult.updatedOk'), 'success');
      } else {
        await labResultService.create(resident.id, form, author);
        showSnackbar(t('labResult.addedOk'), 'success');
      }
      await load();
      setDialogOpen(false);
    } catch (error: unknown) {
      showSnackbar(error instanceof Error ? error.message : t('labResult.saveError'), 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.lab) return;
    try {
      await labResultService.delete(resident.id, deleteConfirm.lab.id, author);
      await load();
      showSnackbar(t('labResult.deletedOk'), 'success');
      setDeleteConfirm({ open: false, lab: null });
    } catch {
      showSnackbar(t('labResult.deleteError'), 'error');
    }
  };

  if (!open) return null;

  const calculateAge = (birthDate: Date): number => dayjs().diff(dayjs(birthDate), 'year');
  // 検査項目名は code から i18n 解決（保存済みの日本語名をフォールバックに）
  const labName = (code: string, fallback: string) => t(`lab.${code}`, { defaultValue: fallback });

  const content = (
    <>
      <ListSectionHeader title={t('labResult.listTitle')} badge={t('labResult.count', { count: labs.length })}>
        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 font-medium transition-colors ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            {t('labResult.tabList')}
          </button>
          <button
            onClick={() => setView('trend')}
            className={`px-3 py-1.5 font-medium transition-colors border-l border-gray-300 ${view === 'trend' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            {t('labResult.tabTrend')}
          </button>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
        >
          <PlusIcon className="w-5 h-5" />
          {t('labResult.add')}
        </button>
      </ListSectionHeader>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : labs.length === 0 ? (
              <EmptyState title={t('labResult.empty')} hint={t('labResult.emptyHint')} />
            ) : view === 'list' ? (
              <div className="space-y-3">
                {labs.map((lab) => (
                  <div key={lab.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-blue-600">{dayjs(lab.collectedAt).format('YYYY/MM/DD HH:mm')}</div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-1 mt-2">
                          {lab.items.map((it) => {
                            const abn = isLabAbnormal(it.value, it.refLow, it.refHigh);
                            return (
                              <div key={it.code} className="flex items-baseline justify-between gap-2 border-b border-gray-100 py-0.5">
                                <span className="text-xs text-gray-500 truncate">{labName(it.code, it.name)}</span>
                                <span className={`text-sm whitespace-nowrap ${abn ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                                  {it.value}{it.unit ? ` ${it.unit}` : ''}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {lab.notes && <div className="text-xs text-gray-600 mt-2">{lab.notes}</div>}
                        <div className="text-xs text-gray-400 mt-2">
                          {t('common.createdBy', { name: lab.createdBy?.name ?? '-', date: dayjs(lab.createdAt).format('YYYY/MM/DD HH:mm') })}
                          {lab.updatedBy && <> / {t('common.updatedBy', { name: lab.updatedBy.name, date: dayjs(lab.updatedAt).format('YYYY/MM/DD HH:mm') })}</>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => openEdit(lab)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title={t('common.edit')}
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ open: true, lab })}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title={t('common.delete')}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Suspense fallback={
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              }>
                <LabTrend labs={labs} />
              </Suspense>
            )}
    </>
  );

  return (
    <>
      {embedded ? (
        <div className="p-6">{content}</div>
      ) : (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <ModalHeader
              title={t('labResult.title', { name: resident.name })}
              subtitle={t('resident.subtitle', { gender: t(resident.gender === '男性' ? 'resident.male' : 'resident.female'), age: calculateAge(resident.birthDate), room: resident.roomNumber })}
              icon={ChartBarIcon}
              onClose={onClose}
            />
            <div className="p-6 max-h-[calc(90vh-200px)] overflow-y-auto">{content}</div>
          </div>
        </div>
      )}

      {/* 入力ダイアログ（全項目パネル。値を入れた項目だけ保存） */}
      {dialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <PencilIcon className="w-5 h-5" />
                {editing ? t('labResult.editTitle') : t('labResult.addTitle')}
              </h3>
            </div>

            <div className="p-6 space-y-4 max-h-[calc(90vh-140px)] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('labResult.collectedAt')}</label>
                <input
                  type="datetime-local"
                  value={form.collectedAt}
                  onChange={(e) => setForm(prev => ({ ...prev, collectedAt: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                      <th className="px-3 py-2 font-medium">{t('labResult.item')}</th>
                      <th className="px-3 py-2 font-medium w-28">{t('labResult.value')}</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">{t('labResult.reference')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {form.items.map((it) => (
                      <tr key={it.code}>
                        <td className="px-3 py-1.5 text-gray-800">{labName(it.code, it.name)}</td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              inputMode="decimal"
                              value={it.value}
                              onChange={(e) => setItemValue(it.code, e.target.value)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {it.unit && <span className="text-xs text-gray-400">{it.unit}</span>}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-xs text-gray-400 whitespace-nowrap">
                          {it.refLow || it.refHigh ? `${it.refLow || ''}${it.refLow && it.refHigh ? ' - ' : ''}${it.refHigh || ''}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('labResult.notesLabel')}</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  placeholder={t('labResult.notesPh')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                />
              </div>

              {!hasAnyValue(form) && (
                <p className="text-sm text-amber-700">{t('labResult.atLeastOne')}</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setDialogOpen(false)}
                disabled={formLoading}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XMarkIcon className="w-4 h-4" />
                {t('common.cancel')}
              </button>
              <button
                onClick={submit}
                disabled={formLoading || !canSubmit}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckIcon className="w-4 h-4" />
                {formLoading ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      <Snackbar open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} />

      <ConfirmDialog
        isOpen={deleteConfirm.open && !!deleteConfirm.lab}
        title={t('labResult.deleteConfirmTitle')}
        message={deleteConfirm.lab ? t('labResult.deleteConfirmMsg', { date: dayjs(deleteConfirm.lab.collectedAt).format('YYYY/MM/DD HH:mm'), name: resident.name }) : ''}
        note={t('common.deleteNote')}
        confirmButtonText={t('common.delete')}
        confirmButtonVariant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ open: false, lab: null })}
      />
    </>
  );
};

export default LabResultsManager;
