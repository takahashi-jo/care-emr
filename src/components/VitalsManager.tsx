import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import dayjs from 'dayjs';
import { HeartIcon, PencilIcon, PencilSquareIcon, TrashIcon, PlusIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import ModalHeader from './common/ModalHeader';
import ConfirmDialog from './common/ConfirmDialog';
import Snackbar from './common/Snackbar';
import EmptyState from './common/EmptyState';
import { vitalSignService } from '../services/firestore';
import { useAuth } from '../hooks/useAuth';
import type { Resident, VitalSign, VitalSignFormData } from '../types';
import { isVitalAbnormal } from '../constants/vitalReference';

// recharts は重いので「推移」タブを開いたときだけ読み込む（遅延ロードでコード分割）
const VitalsTrend = lazy(() => import('./VitalsTrend'));

interface VitalsManagerProps {
  resident: Resident;
  open: boolean;
  onClose: () => void;
}

const PER_PAGE = 15;

const emptyForm = (): VitalSignFormData => ({
  measuredAt: dayjs().format('YYYY-MM-DDTHH:mm'),
  temperature: '',
  systolicBP: '',
  diastolicBP: '',
  pulse: '',
  spo2: '',
  weight: '',
  bloodGlucose: '',
  notes: '',
});

// 数値入力欄（単位付きラベル）
const NumField = ({ label, value, onChange, step, placeholder }: {
  label: string;
  value?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  step?: string;
  placeholder?: string;
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input
      type="number"
      inputMode="decimal"
      value={value ?? ''}
      onChange={onChange}
      step={step}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

const VitalsManager = ({ resident, open, onClose }: VitalsManagerProps) => {
  const [vitals, setVitals] = useState<VitalSign[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [view, setView] = useState<'list' | 'trend'>('list');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VitalSign | null>(null);
  const [form, setForm] = useState<VitalSignFormData>(emptyForm());
  const [formLoading, setFormLoading] = useState(false);

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; vital: VitalSign | null }>({ open: false, vital: null });

  const { user } = useAuth();
  const author = { uid: user?.uid ?? '', name: user?.displayName ?? user?.email ?? '不明' };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
    setTimeout(() => setSnackbar(prev => ({ ...prev, open: false })), 4000);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setVitals(await vitalSignService.getByResidentId(resident.id));
      setCurrentPage(1);
    } catch {
      showSnackbar('バイタルの読み込みに失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  }, [resident.id]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (v: VitalSign) => {
    setEditing(v);
    setForm({
      measuredAt: dayjs(v.measuredAt).format('YYYY-MM-DDTHH:mm'),
      temperature: v.temperature?.toString() ?? '',
      systolicBP: v.systolicBP?.toString() ?? '',
      diastolicBP: v.diastolicBP?.toString() ?? '',
      pulse: v.pulse?.toString() ?? '',
      spo2: v.spo2?.toString() ?? '',
      weight: v.weight?.toString() ?? '',
      bloodGlucose: v.bloodGlucose?.toString() ?? '',
      notes: v.notes ?? '',
    });
    setDialogOpen(true);
  };

  const setField = (field: keyof VitalSignFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const hasAnyMeasure = (f: VitalSignFormData) =>
    [f.temperature, f.systolicBP, f.diastolicBP, f.pulse, f.spo2, f.weight, f.bloodGlucose]
      .some(s => (s ?? '').trim() !== '');

  const canSubmit = form.measuredAt !== '' && hasAnyMeasure(form);

  const submit = async () => {
    if (!canSubmit) return;
    setFormLoading(true);
    try {
      if (editing) {
        await vitalSignService.update(resident.id, editing.id, form, author);
        showSnackbar('バイタルを更新しました', 'success');
      } else {
        await vitalSignService.create(resident.id, form, author);
        showSnackbar('バイタルを登録しました', 'success');
      }
      await load();
      setDialogOpen(false);
    } catch (error: unknown) {
      showSnackbar(error instanceof Error ? error.message : '保存に失敗しました', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.vital) return;
    try {
      await vitalSignService.delete(resident.id, deleteConfirm.vital.id, author);
      await load();
      showSnackbar('バイタルを削除しました（記録は保持されます）', 'success');
      setDeleteConfirm({ open: false, vital: null });
    } catch {
      showSnackbar('削除に失敗しました', 'error');
    }
  };

  const totalPages = Math.ceil(vitals.length / PER_PAGE);
  const pageItems = vitals.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const calculateAge = (birthDate: Date): number => dayjs().diff(dayjs(birthDate), 'year');

  // 測定値セル（未測定は「-」、異常値は赤）
  const cell = (value: number | undefined, unit: string, abn?: (v: number) => boolean) => {
    if (value === undefined) return <span className="text-gray-400">-</span>;
    const isAbn = abn ? abn(value) : false;
    return <span className={isAbn ? 'text-red-600 font-semibold' : 'text-gray-900'}>{value}{unit}</span>;
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <ModalHeader
              title={`${resident.name}さんのバイタル`}
              subtitle={`${resident.gender} • ${calculateAge(resident.birthDate)}歳 • 部屋${resident.roomNumber}`}
              icon={HeartIcon}
              onClose={onClose}
            />

            <div className="p-6 max-h-[calc(90vh-200px)] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                    <button
                      onClick={() => setView('list')}
                      className={`px-3 py-1.5 font-medium transition-colors ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                      一覧
                    </button>
                    <button
                      onClick={() => setView('trend')}
                      className={`px-3 py-1.5 font-medium transition-colors border-l border-gray-300 ${view === 'trend' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                      推移
                    </button>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">{vitals.length}件</span>
                </div>
                <button
                  onClick={openCreate}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
                >
                  <PlusIcon className="w-5 h-5" />
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
              ) : vitals.length === 0 ? (
                <EmptyState title="バイタル記録がありません" hint="「新規記録」から登録してください" />
              ) : view === 'list' ? (
                <div className="space-y-4">
                  <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto shadow-sm">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">測定日時</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">体温</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">血圧</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">脈拍</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">SpO₂</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">体重</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">血糖</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[160px]">備考</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 w-24">操作</th>
                        </tr>
                      </thead>
                      {pageItems.map((v) => (
                        <tbody key={v.id} className="border-b border-gray-200 last:border-0">
                          <tr className="hover:bg-gray-50 transition-colors duration-200">
                            <td className="px-4 pt-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-blue-600">{dayjs(v.measuredAt).format('YYYY/MM/DD')}</div>
                              <div className="text-xs text-gray-500">{dayjs(v.measuredAt).format('HH:mm')}</div>
                            </td>
                            <td className="px-4 pt-3 whitespace-nowrap text-sm">{cell(v.temperature, '℃', isVitalAbnormal.temperature)}</td>
                            <td className="px-4 pt-3 whitespace-nowrap text-sm">
                              {v.systolicBP === undefined && v.diastolicBP === undefined ? (
                                <span className="text-gray-400">-</span>
                              ) : (
                                <span className={
                                  (v.systolicBP !== undefined && isVitalAbnormal.systolicBP(v.systolicBP)) ||
                                  (v.diastolicBP !== undefined && isVitalAbnormal.diastolicBP(v.diastolicBP))
                                    ? 'text-red-600 font-semibold'
                                    : 'text-gray-900'
                                }>
                                  {v.systolicBP ?? '-'}/{v.diastolicBP ?? '-'}
                                </span>
                              )}
                            </td>
                            <td className="px-4 pt-3 whitespace-nowrap text-sm">{cell(v.pulse, '', isVitalAbnormal.pulse)}</td>
                            <td className="px-4 pt-3 whitespace-nowrap text-sm">{cell(v.spo2, '%', isVitalAbnormal.spo2)}</td>
                            <td className="px-4 pt-3 whitespace-nowrap text-sm">{cell(v.weight, 'kg')}</td>
                            <td className="px-4 pt-3 whitespace-nowrap text-sm">{cell(v.bloodGlucose, '')}</td>
                            <td className="px-4 pt-3">
                              <div className="text-sm text-gray-700 whitespace-pre-wrap max-w-xs line-clamp-2">
                                {v.notes ? v.notes : <span className="text-gray-400">-</span>}
                              </div>
                            </td>
                            <td className="px-4 pt-3">
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => openEdit(v)}
                                  className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full transition-colors duration-200"
                                  title="編集"
                                >
                                  <PencilSquareIcon className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm({ open: true, vital: v })}
                                  className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full transition-colors duration-200"
                                  title="削除"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={9} className="px-4 pb-3 pt-1 text-xs text-gray-400">
                              作成: {v.createdBy?.name ?? '-'} ({dayjs(v.createdAt).format('YYYY/MM/DD HH:mm')})
                              {v.updatedBy && <> / 更新: {v.updatedBy.name} ({dayjs(v.updatedAt).format('YYYY/MM/DD HH:mm')})</>}
                            </td>
                          </tr>
                        </tbody>
                      ))}
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex justify-center">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                          className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          最初
                        </button>
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          前へ
                        </button>
                        <span className="px-4 py-2 text-sm font-medium text-gray-700">{currentPage} / {totalPages}</span>
                        <button
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          次へ
                        </button>
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage === totalPages}
                          className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          最後
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Suspense fallback={
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                }>
                  <VitalsTrend vitals={vitals} />
                </Suspense>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 入力ダイアログ */}
      {dialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <PencilIcon className="w-5 h-5" />
                {editing ? 'バイタル編集' : '新規バイタル'}
              </h3>
            </div>

            <div className="p-6 space-y-4 max-h-[calc(90vh-140px)] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">測定日時</label>
                <input
                  type="datetime-local"
                  value={form.measuredAt}
                  onChange={setField('measuredAt')}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <NumField label="体温 (℃)" value={form.temperature} onChange={setField('temperature')} step="0.1" placeholder="36.5" />
                <NumField label="脈拍 (/分)" value={form.pulse} onChange={setField('pulse')} placeholder="72" />
                <NumField label="SpO₂ (%)" value={form.spo2} onChange={setField('spo2')} placeholder="98" />
                <NumField label="収縮期 (mmHg)" value={form.systolicBP} onChange={setField('systolicBP')} placeholder="120" />
                <NumField label="拡張期 (mmHg)" value={form.diastolicBP} onChange={setField('diastolicBP')} placeholder="80" />
                <NumField label="体重 (kg)" value={form.weight} onChange={setField('weight')} step="0.1" placeholder="55.0" />
                <NumField label="血糖 (mg/dL)" value={form.bloodGlucose} onChange={setField('bloodGlucose')} placeholder="任意" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                <textarea
                  value={form.notes}
                  onChange={setField('notes')}
                  rows={2}
                  placeholder="測定条件・特記事項など"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                />
              </div>

              {!hasAnyMeasure(form) && (
                <p className="text-sm text-amber-700">いずれか1項目以上を入力してください。</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setDialogOpen(false)}
                disabled={formLoading}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XMarkIcon className="w-4 h-4" />
                キャンセル
              </button>
              <button
                onClick={submit}
                disabled={formLoading || !canSubmit}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckIcon className="w-4 h-4" />
                {formLoading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 通知 */}
      <Snackbar open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} />

      {/* 削除確認 */}
      <ConfirmDialog
        isOpen={deleteConfirm.open && !!deleteConfirm.vital}
        title="バイタルの削除確認"
        message={deleteConfirm.vital ? `${dayjs(deleteConfirm.vital.measuredAt).format('YYYY年MM月DD日 HH:mm')}（${resident.name}さん）のバイタル記録を削除しますか？` : ''}
        note="真正性のため物理削除はしません。一覧からは非表示になりますが、記録は保持されます（誰が削除したかも記録されます）。"
        confirmButtonText="削除する"
        confirmButtonVariant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ open: false, vital: null })}
      />
    </>
  );
};

export default VitalsManager;
