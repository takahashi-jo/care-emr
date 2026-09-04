import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { BeakerIcon, PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { medicationService } from '../services/firestore';
import { useAuth } from '../hooks/useAuth';
import ConfirmDialog from './common/ConfirmDialog';
import ModalHeader from './common/ModalHeader';
import Snackbar from './common/Snackbar';
import EmptyState from './common/EmptyState';
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

// 経路・種別の表示用 i18n キー（値は日本語のまま保存し、表示だけ翻訳）
const ROUTE_KEY: Record<string, string> = {
  '経口': 'medication.routeOral',
  '外用': 'medication.routeTopical',
  '貼付': 'medication.routePatch',
  '注射': 'medication.routeInjection',
  'その他': 'medication.routeOther',
};
const TYPE_KEY = (ty: string) => (ty === '頓用' ? 'medication.typeAsNeeded' : 'medication.typeRegular');

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
  const { t } = useTranslation();
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
      showSnackbar(t('medication.loadError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [resident.id, t]);

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
        showSnackbar(t('medication.updatedOk'), 'success');
      } else {
        await medicationService.create(resident.id, form, author);
        showSnackbar(t('medication.addedOk'), 'success');
      }
      await loadMedications();
      setFormOpen(false);
    } catch (error: unknown) {
      showSnackbar(error instanceof Error ? error.message : t('medication.saveError'), 'error');
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
        showSnackbar(t('medication.stoppedOk'), 'success');
      } else {
        await medicationService.delete(resident.id, medication.id);
        showSnackbar(t('medication.deletedOk'), 'success');
      }
      await loadMedications();
    } catch {
      showSnackbar(kind === 'stop' ? t('medication.stopError') : t('medication.deleteError'), 'error');
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
            title={t('medication.title', { name: resident.name })}
            subtitle={t('resident.subtitle', { gender: t(resident.gender === '男性' ? 'resident.male' : 'resident.female'), age: dayjs().diff(dayjs(resident.birthDate), 'year'), room: resident.roomNumber })}
            icon={BeakerIcon}
            onClose={onClose}
          />

          {/* Content */}
          <div className="p-6 max-h-[calc(90vh-180px)] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold text-gray-800">{t('medication.listTitle')}</h3>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">{t('medication.count', { active: activeCount, total: medications.length })}</span>
              </div>
              <button
                onClick={handleAdd}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
              >
                <PlusIcon className="w-5 h-5" />
                {t('medication.add')}
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600"></div>
              </div>
            ) : medications.length === 0 ? (
              <EmptyState title={t('medication.empty')} hint={t('medication.emptyHint')} />
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
                              {t(TYPE_KEY(med.type))}
                            </span>
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                              {t(ROUTE_KEY[med.route] ?? 'medication.routeOther')}
                            </span>
                            {stopped ? (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 text-gray-700">{t('medication.stopped')}</span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">{t('medication.active')}</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-700 mt-1">{med.frequency}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {t('medication.startLabel', { date: dayjs(med.startDate).format('YYYY/MM/DD') })}
                            {med.endDate && ` / ${t('medication.stopLabel', { date: dayjs(med.endDate).format('YYYY/MM/DD') })}`}
                          </div>
                          {med.notes && <div className="text-xs text-gray-600 mt-1">{t('medication.notesInline', { text: med.notes })}</div>}
                          <div className="text-xs text-gray-400 mt-1">
                            {t('common.createdBy', { name: med.createdBy?.name ?? '-', date: dayjs(med.createdAt).format('YYYY/MM/DD HH:mm') })}
                            {med.updatedBy && <> / {t('common.updatedBy', { name: med.updatedBy.name, date: dayjs(med.updatedAt).format('YYYY/MM/DD HH:mm') })}</>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {!stopped && (
                            <button
                              onClick={() => setConfirm({ kind: 'stop', medication: med })}
                              className="px-2 py-1 text-xs text-amber-700 hover:bg-amber-50 border border-amber-300 rounded transition-colors"
                              title={t('medication.stopAction')}
                            >
                              {t('medication.stopAction')}
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(med)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title={t('common.edit')}
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirm({ kind: 'delete', medication: med })}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title={t('medication.deleteAction')}
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
                {editing ? t('medication.editTitle') : t('medication.addTitle')}
              </h3>
            </div>

            <div className="p-6 space-y-4 max-h-[calc(90vh-140px)] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('medication.drugName')} <span className="text-red-500">*</span></label>
                <DrugNameAutocomplete
                  value={form.name}
                  onChange={(name, item) => setForm(prev => ({ ...prev, name, yjCode: item?.yjCode, hotCode: item?.hotCode }))}
                  placeholder={t('medication.drugPh')}
                />
                {form.yjCode && (
                  <p className="text-xs text-gray-400 mt-1">{t('medication.yjCode', { code: form.yjCode })}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('medication.dosage')}</label>
                  <input
                    type="text"
                    value={form.dosage}
                    onChange={(e) => setForm(prev => ({ ...prev, dosage: e.target.value }))}
                    placeholder={t('medication.dosagePh')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('medication.frequency')}</label>
                  <input
                    type="text"
                    list="frequency-presets"
                    value={form.frequency}
                    onChange={(e) => setForm(prev => ({ ...prev, frequency: e.target.value }))}
                    placeholder={t('medication.frequencyPh')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <datalist id="frequency-presets">
                    {FREQUENCY_PRESETS.map(p => <option key={p} value={p} />)}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('medication.route')}</label>
                  <select
                    value={form.route}
                    onChange={(e) => setForm(prev => ({ ...prev, route: e.target.value as MedicationRoute }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  >
                    {ROUTES.map(r => <option key={r} value={r}>{t(ROUTE_KEY[r] ?? 'medication.routeOther')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('medication.type')}</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm(prev => ({ ...prev, type: e.target.value as MedicationType }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  >
                    <option value="定期">{t('medication.typeRegular')}</option>
                    <option value="頓用">{t('medication.typeAsNeeded')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('medication.startDate')} <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('medication.endDate')}</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('medication.notes')}</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder={t('medication.notesPh')}
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
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={formLoading || !form.name.trim()}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formLoading ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snackbar */}
      <Snackbar open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} />

      {/* Confirm dialog for stop / delete */}
      <ConfirmDialog
        isOpen={confirm.kind !== null}
        title={confirm.kind === 'stop' ? t('medication.stopConfirmTitle') : t('medication.deleteConfirmTitle')}
        message={
          confirm.kind === 'stop'
            ? t('medication.stopConfirmMsg', { name: confirm.medication?.name })
            : t('medication.deleteConfirmMsg', { name: confirm.medication?.name })
        }
        confirmButtonText={confirm.kind === 'stop' ? t('medication.stopConfirm') : t('common.delete')}
        cancelButtonText={t('common.cancel')}
        confirmButtonVariant="danger"
        onConfirm={confirmAction}
        onCancel={() => setConfirm({ kind: null, medication: null })}
      />
    </>
  );
};

export default MedicationsManager;
