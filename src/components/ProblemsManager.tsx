import { useState, useEffect, useCallback } from 'react';
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
      showSnackbar('プロブレムの読み込みに失敗しました', 'error');
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
        showSnackbar('プロブレムを更新しました', 'success');
      } else {
        await problemService.create(resident.id, form, author);
        showSnackbar('プロブレムを追加しました', 'success');
      }
      await load();
      setFormOpen(false);
    } catch (error: unknown) {
      showSnackbar(error instanceof Error ? error.message : '保存に失敗しました', 'error');
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
        showSnackbar('プロブレムを消失にしました', 'success');
      } else {
        await problemService.delete(resident.id, problem.id, author);
        showSnackbar('プロブレムを削除しました（記録は保持されます）', 'success');
      }
      await load();
    } catch {
      showSnackbar(kind === 'resolve' ? '消失への変更に失敗しました' : '削除に失敗しました', 'error');
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
            title={`${resident.name}さんのプロブレムリスト`}
            subtitle={`${resident.gender} • ${calculateAge(resident.birthDate)}歳 • 部屋${resident.roomNumber}`}
            icon={ClipboardDocumentListIcon}
            onClose={onClose}
          />

          <div className="p-6 max-h-[calc(90vh-180px)] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold text-gray-800">プロブレム一覧</h3>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">現行 {activeCount} / 全 {problems.length}</span>
              </div>
              <button
                onClick={handleAdd}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
              >
                <PlusIcon className="w-5 h-5" />
                問題を追加
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : problems.length === 0 ? (
              <EmptyState title="プロブレムが登録されていません" hint="「問題を追加」から登録してください" />
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
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 text-gray-700">消失</span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">現行</span>
                            )}
                          </div>
                          {(p.onsetDate || p.resolvedDate) && (
                            <div className="text-xs text-gray-500 mt-1">
                              {p.onsetDate && `発症・認知 ${dayjs(p.onsetDate).format('YYYY/MM/DD')}`}
                              {p.resolvedDate && ` / 消失 ${dayjs(p.resolvedDate).format('YYYY/MM/DD')}`}
                            </div>
                          )}
                          {p.notes && <div className="text-xs text-gray-600 mt-1">備考: {p.notes}</div>}
                          <div className="text-xs text-gray-400 mt-1">
                            作成: {p.createdBy?.name ?? '-'} ({dayjs(p.createdAt).format('YYYY/MM/DD HH:mm')})
                            {p.updatedBy && <> / 更新: {p.updatedBy.name} ({dayjs(p.updatedAt).format('YYYY/MM/DD HH:mm')})</>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {!resolved && (
                            <button
                              onClick={() => setConfirm({ kind: 'resolve', problem: p })}
                              className="px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 border border-gray-300 rounded transition-colors"
                              title="消失にする"
                            >
                              消失にする
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(p)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="編集"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirm({ kind: 'delete', problem: p })}
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

      {/* 追加 / 編集ダイアログ */}
      {formOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <PencilIcon className="w-5 h-5" />
                {editing ? '問題の編集' : '問題の追加'}
              </h3>
            </div>

            <div className="p-6 space-y-4 max-h-[calc(90vh-140px)] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">問題番号</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.number}
                    onChange={(e) => setForm(prev => ({ ...prev, number: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">問題名（病名） <span className="text-red-500">*</span></label>
                  <DiseaseNameAutocomplete
                    value={form.title}
                    onChange={(title, item) => setForm(prev => ({ ...prev, title, icd10: item?.icd10 }))}
                    placeholder="例：高血圧（入力すると候補が出ます）"
                  />
                  {form.icd10 && (
                    <p className="text-xs text-gray-400 mt-1">ICD-10: {form.icd10}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">状態</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value as ProblemStatus }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="現行">現行</option>
                    <option value="消失">消失</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">発症・認知日</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">消失日</label>
                  <input
                    type="date"
                    value={form.resolvedDate}
                    onChange={(e) => setForm(prev => ({ ...prev, resolvedDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="経過・補足など"
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
                キャンセル
              </button>
              <button
                onClick={handleSubmit}
                disabled={formLoading || !form.title.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formLoading ? '保存中...' : '保存'}
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
        title={confirm.kind === 'resolve' ? '問題を消失にする' : '問題の削除'}
        message={
          confirm.kind === 'resolve'
            ? `「#${confirm.problem?.number} ${confirm.problem?.title}」を本日付で消失にしますか？（記録は残ります）`
            : `「#${confirm.problem?.number} ${confirm.problem?.title}」を削除しますか？入力誤りの取り消し用です。治癒・消失は「消失にする」を使ってください。`
        }
        note={confirm.kind === 'delete' ? '真正性のため物理削除はしません。一覧からは非表示になりますが、記録は保持されます（誰が削除したかも記録されます）。' : undefined}
        confirmButtonText={confirm.kind === 'resolve' ? '消失にする' : '削除する'}
        cancelButtonText="キャンセル"
        confirmButtonVariant={confirm.kind === 'resolve' ? 'primary' : 'danger'}
        onConfirm={confirmAction}
        onCancel={() => setConfirm({ kind: null, problem: null })}
      />
    </>
  );
};

export default ProblemsManager;
