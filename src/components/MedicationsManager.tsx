import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { BeakerIcon, PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { medicationService } from '../services/firestore';
import { useAuth } from '../hooks/useAuth';
import ConfirmDialog from './common/ConfirmDialog';
import ModalHeader from './common/ModalHeader';
import DrugNameAutocomplete from './DrugNameAutocomplete';
import type { Resident, Medication, MedicationFormData, MedicationRoute, MedicationType } from '../types';

interface MedicationsManagerProps {
  resident: Resident;
  open: boolean;
  onClose: () => void;
}

// 用法プリセット（日本病院薬剤師会・日本薬剤師会「標準用法用語集」に準拠した代表例）
const FREQUENCY_PRESETS = [
  // 内服・定期
  '1日1回 起床時',
  '1日1回 朝食前',
  '1日1回 朝食後',
  '1日1回 昼食後',
  '1日1回 夕食前',
  '1日1回 夕食後',
  '1日1回 就寝前',
  '1日2回 朝夕食前',
  '1日2回 朝夕食後',
  '1日2回 朝・就寝前',
  '1日3回 毎食前',
  '1日3回 毎食後',
  '1日3回 毎食間',
  '1日4回 毎食後・就寝前',
  '隔日 朝食後',
  '週1回 起床時',
  '週2回',
  '週3回',
  // 頓用
  '疼痛時',
  '発熱時',
  '不眠時',
  '便秘時',
  '不安時',
  '嘔気時',
  '血圧高値時',
  '血糖高値時',
  '発作時',
  // 外用・貼付・点眼
  '1日1回 貼付',
  '1日2回 患部に塗布',
  '1日1回 両眼点眼',
];

const ROUTES: MedicationRoute[] = ['経口', '外用', '貼付', '注射', 'その他'];

const emptyForm = (): MedicationFormData => ({
  name: '',
  dosage: '',
  frequency: '',
  route: '経口',
  type: '定期',
  startDate: dayjs().format('YYYY-MM-DD'),
  endDate: '',
  notes: '',
});

const MedicationsManager = ({ resident, open, onClose }: MedicationsManagerProps) => {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [form, setForm] = useState<MedicationFormData>(emptyForm());
  const [formLoading, setFormLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [confirm, setConfirm] = useState<{ kind: 'stop' | 'delete' | null; medication: Medication | null }>({
    kind: null,
    medication: null,
  });
  const { user } = useAuth();
  const author = { uid: user?.uid ?? '', name: user?.displayName ?? user?.email ?? '不明' };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
    setTimeout(() => setSnackbar(prev => ({ ...prev, open: false })), 4000);
  };

  const loadMedications = useCallback(async () => {
    try {
      setLoading(true);
      setMedications(await medicationService.getByResidentId(resident.id));
    } catch {
      showSnackbar('投薬情報の読み込みに失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  }, [resident.id]);

  useEffect(() => {
    if (open) loadMedications();
  }, [open, loadMedications]);

  const handleAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const handleEdit = (medication: Medication) => {
    setEditing(medication);
    setForm({
      name: medication.name,
      dosage: medication.dosage,
      frequency: medication.frequency,
      route: medication.route,
      type: medication.type,
      startDate: dayjs(medication.startDate).format('YYYY-MM-DD'),
      endDate: medication.endDate ? dayjs(medication.endDate).format('YYYY-MM-DD') : '',
      notes: medication.notes || '',
      yjCode: medication.yjCode,
      hotCode: medication.hotCode,
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setFormLoading(true);
    try {
      if (editing) {
        await medicationService.update(resident.id, editing.id, form, author);
        showSnackbar('投薬を更新しました', 'success');
      } else {
        await medicationService.create(resident.id, form, author);
        showSnackbar('投薬を追加しました', 'success');
      }
      await loadMedications();
      setFormOpen(false);
    } catch (error: unknown) {
      showSnackbar(error instanceof Error ? error.message : '保存に失敗しました', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const confirmAction = async () => {
    const { kind, medication } = confirm;
    if (!kind || !medication) return;
    try {
      if (kind === 'stop') {
        await medicationService.stop(resident.id, medication.id, dayjs().format('YYYY-MM-DD'), author);
        showSnackbar('投薬を中止にしました', 'success');
      } else {
        await medicationService.delete(resident.id, medication.id);
        showSnackbar('投薬を削除しました', 'success');
      }
      await loadMedications();
    } catch {
      showSnackbar(kind === 'stop' ? '中止に失敗しました' : '削除に失敗しました', 'error');
    } finally {
      setConfirm({ kind: null, medication: null });
    }
  };

  if (!open) return null;

  const activeCount = medications.filter(m => !m.endDate).length;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <ModalHeader
            title={`${resident.name}さんの投薬`}
            subtitle={`${resident.gender} • ${dayjs().diff(dayjs(resident.birthDate), 'year')}歳 • 部屋${resident.roomNumber}`}
            icon={BeakerIcon}
            onClose={onClose}
          />

          {/* Content */}
          <div className="p-6 max-h-[calc(90vh-180px)] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold text-gray-800">投薬一覧</h3>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">継続中 {activeCount} / 全 {medications.length}</span>
              </div>
              <button
                onClick={handleAdd}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
              >
                <PlusIcon className="w-5 h-5" />
                投薬を追加
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600"></div>
              </div>
            ) : medications.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center bg-gray-50">
                <p className="text-gray-600 font-medium">投薬が登録されていません</p>
                <p className="text-sm text-gray-500 mt-1">「投薬を追加」から登録してください</p>
              </div>
            ) : (
              <div className="space-y-3">
                {medications.map((med) => {
                  const stopped = !!med.endDate;
                  return (
                    <div
                      key={med.id}
                      className={`border rounded-lg p-4 ${stopped ? 'bg-gray-50 border-gray-200 opacity-80' : 'bg-white border-teal-200'}`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900">{med.name}</span>
                            {med.dosage && <span className="text-sm text-gray-600">{med.dosage}</span>}
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${med.type === '頓用' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                              {med.type}
                            </span>
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                              {med.route}
                            </span>
                            {stopped ? (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 text-gray-700">中止</span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">継続中</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-700 mt-1">{med.frequency}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            開始 {dayjs(med.startDate).format('YYYY/MM/DD')}
                            {med.endDate && ` 〜 中止 ${dayjs(med.endDate).format('YYYY/MM/DD')}`}
                          </div>
                          {med.notes && <div className="text-xs text-gray-600 mt-1">備考: {med.notes}</div>}
                          <div className="text-xs text-gray-400 mt-1">
                            作成: {med.createdBy?.name ?? '-'} ({dayjs(med.createdAt).format('YYYY/MM/DD HH:mm')})
                            {med.updatedBy && <> / 更新: {med.updatedBy.name} ({dayjs(med.updatedAt).format('YYYY/MM/DD HH:mm')})</>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {!stopped && (
                            <button
                              onClick={() => setConfirm({ kind: 'stop', medication: med })}
                              className="px-2 py-1 text-xs text-amber-700 hover:bg-amber-50 border border-amber-300 rounded transition-colors"
                              title="中止"
                            >
                              中止
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(med)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="編集"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirm({ kind: 'delete', medication: med })}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="削除"
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

      {/* Add / Edit form dialog */}
      {formOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <PencilIcon className="w-5 h-5" />
                {editing ? '投薬の編集' : '投薬の追加'}
              </h3>
            </div>

            <div className="p-6 space-y-4 max-h-[calc(90vh-140px)] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">薬剤名 <span className="text-red-500">*</span></label>
                <DrugNameAutocomplete
                  value={form.name}
                  onChange={(name, item) => setForm(prev => ({ ...prev, name, yjCode: item?.yjCode, hotCode: item?.hotCode }))}
                  placeholder="例：アムロジピン（入力すると候補が出ます）"
                />
                {form.yjCode && (
                  <p className="text-xs text-gray-400 mt-1">YJコード: {form.yjCode}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">1回量</label>
                  <input
                    type="text"
                    value={form.dosage}
                    onChange={(e) => setForm(prev => ({ ...prev, dosage: e.target.value }))}
                    placeholder="例：1錠 / 5mg"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">用法</label>
                  <input
                    type="text"
                    list="frequency-presets"
                    value={form.frequency}
                    onChange={(e) => setForm(prev => ({ ...prev, frequency: e.target.value }))}
                    placeholder="例：1日2回 朝夕食後"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <datalist id="frequency-presets">
                    {FREQUENCY_PRESETS.map(p => <option key={p} value={p} />)}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">経路</label>
                  <select
                    value={form.route}
                    onChange={(e) => setForm(prev => ({ ...prev, route: e.target.value as MedicationRoute }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  >
                    {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">種別</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm(prev => ({ ...prev, type: e.target.value as MedicationType }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  >
                    <option value="定期">定期</option>
                    <option value="頓用">頓用</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">開始日 <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">中止日（継続中は空欄）</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="頓用の条件など（例：38.5℃以上で使用）"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-vertical"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setFormOpen(false)}
                disabled={formLoading}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmit}
                disabled={formLoading || !form.name.trim()}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formLoading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snackbar */}
      {snackbar.open && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[110]">
          <div className={`px-4 py-3 rounded-lg shadow-lg font-medium ${snackbar.severity === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
            {snackbar.message}
          </div>
        </div>
      )}

      {/* Confirm dialog for stop / delete */}
      <ConfirmDialog
        isOpen={confirm.kind !== null}
        title={confirm.kind === 'stop' ? '投薬の中止' : '投薬の削除'}
        message={
          confirm.kind === 'stop'
            ? `「${confirm.medication?.name}」を本日付で中止にしますか？（記録は残ります）`
            : `「${confirm.medication?.name}」を削除しますか？入力誤りの取り消し用です。処方の中止は「中止」を使ってください。`
        }
        confirmButtonText={confirm.kind === 'stop' ? '中止する' : '削除する'}
        cancelButtonText="キャンセル"
        confirmButtonVariant="danger"
        onConfirm={confirmAction}
        onCancel={() => setConfirm({ kind: null, medication: null })}
      />
    </>
  );
};

export default MedicationsManager;
