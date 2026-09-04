import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { ShieldCheckIcon, PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { immunizationService } from '../services/firestore';
import { useAuth } from '../hooks/useAuth';
import { VACCINE_PRESETS } from '../constants/vaccinePresets';
import ConfirmDialog from './common/ConfirmDialog';
import ListSectionHeader from './common/ListSectionHeader';
import ModalHeader from './common/ModalHeader';
import Snackbar from './common/Snackbar';
import EmptyState from './common/EmptyState';
import type { Resident, Immunization, ImmunizationFormData } from '../types';

interface ImmunizationsManagerProps {
  resident: Resident;
  open: boolean;
  onClose: () => void;
  embedded?: boolean;
}

const emptyForm = (): ImmunizationFormData => ({
  vaccine: '',
  vaccinatedAt: dayjs().format('YYYY-MM-DD'),
  doseNumber: '',
  manufacturer: '',
  lot: '',
  physician: '',
  facility: '',
  notes: '',
});

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

const ImmunizationsManager = ({ resident, open, onClose, embedded = false }: ImmunizationsManagerProps) => {
  const { t } = useTranslation();
  const [records, setRecords] = useState<Immunization[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Immunization | null>(null);
  const [form, setForm] = useState<ImmunizationFormData>(emptyForm());
  const [formLoading, setFormLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [confirm, setConfirm] = useState<Immunization | null>(null);

  const { user } = useAuth();
  const author = { uid: user?.uid ?? '', name: user?.displayName ?? user?.email ?? '不明' };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
    setTimeout(() => setSnackbar(prev => ({ ...prev, open: false })), 4000);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setRecords(await immunizationService.getByResidentId(resident.id));
    } catch {
      showSnackbar(t('immunization.loadError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [resident.id, t]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const setField = (key: keyof ImmunizationFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const handleEdit = (r: Immunization) => {
    setEditing(r);
    setForm({
      vaccine: r.vaccine,
      vaccinatedAt: dayjs(r.vaccinatedAt).format('YYYY-MM-DD'),
      doseNumber: r.doseNumber || '',
      manufacturer: r.manufacturer || '',
      lot: r.lot || '',
      physician: r.physician || '',
      facility: r.facility || '',
      notes: r.notes || '',
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.vaccine.trim() || !form.vaccinatedAt) return;
    setFormLoading(true);
    try {
      if (editing) {
        await immunizationService.update(resident.id, editing.id, form, author);
        showSnackbar(t('immunization.updatedOk'), 'success');
      } else {
        await immunizationService.create(resident.id, form, author);
        showSnackbar(t('immunization.addedOk'), 'success');
      }
      await load();
      setFormOpen(false);
    } catch (error: unknown) {
      showSnackbar(error instanceof Error ? error.message : t('immunization.saveError'), 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!confirm) return;
    try {
      await immunizationService.delete(resident.id, confirm.id, author);
      showSnackbar(t('immunization.deletedOk'), 'success');
      await load();
    } catch {
      showSnackbar(t('immunization.deleteError'), 'error');
    } finally {
      setConfirm(null);
    }
  };

  if (!open) return null;

  const calculateAge = (birthDate: Date): number => dayjs().diff(dayjs(birthDate), 'year');

  const content = (
    <>
      <ListSectionHeader title={t('immunization.listTitle')} badge={t('immunization.count', { count: records.length })}>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
        >
          <PlusIcon className="w-5 h-5" />
          {t('immunization.add')}
        </button>
      </ListSectionHeader>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      ) : records.length === 0 ? (
        <EmptyState title={t('immunization.empty')} hint={t('immunization.emptyHint')} />
      ) : (
        <div className="space-y-3">
          {records.map((r) => {
            const meta = [
              r.manufacturer,
              r.lot ? t('immunization.lotInline', { lot: r.lot }) : '',
              r.physician ? t('immunization.physicianInline', { name: r.physician }) : '',
              r.facility,
            ].filter(Boolean);
            return (
              <div key={r.id} className="border border-emerald-200 bg-white rounded-lg p-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{dayjs(r.vaccinatedAt).format('YYYY/MM/DD')}</span>
                      <span className="font-semibold text-gray-900">{r.vaccine}</span>
                      {r.doseNumber && <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800">{r.doseNumber}</span>}
                    </div>
                    {meta.length > 0 && <div className="text-xs text-gray-500 mt-1">{meta.join(' / ')}</div>}
                    {r.notes && <div className="text-xs text-gray-600 mt-1">{t('immunization.notesInline', { text: r.notes })}</div>}
                    <div className="text-xs text-gray-400 mt-1">
                      {t('common.createdBy', { name: r.createdBy?.name ?? '-', date: dayjs(r.createdAt).format('YYYY/MM/DD HH:mm') })}
                      {r.updatedBy && <> / {t('common.updatedBy', { name: r.updatedBy.name, date: dayjs(r.updatedAt).format('YYYY/MM/DD HH:mm') })}</>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleEdit(r)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title={t('common.edit')}
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirm(r)}
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
    </>
  );

  return (
    <>
      {embedded ? (
        <div className="p-6">{content}</div>
      ) : (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <ModalHeader
              title={t('immunization.title', { name: resident.name })}
              subtitle={t('resident.subtitle', { gender: t(resident.gender === '男性' ? 'resident.male' : 'resident.female'), age: calculateAge(resident.birthDate), room: resident.roomNumber })}
              icon={ShieldCheckIcon}
              onClose={onClose}
            />
            <div className="p-6 max-h-[calc(90vh-180px)] overflow-y-auto">{content}</div>
          </div>
        </div>
      )}

      {/* 追加 / 編集ダイアログ */}
      {formOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <PencilIcon className="w-5 h-5" />
                {editing ? t('immunization.editTitle') : t('immunization.addTitle')}
              </h3>
            </div>

            <div className="p-6 space-y-4 max-h-[calc(90vh-140px)] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('immunization.vaccine')} <span className="text-red-500">*</span></label>
                  <input
                    list="vaccine-presets"
                    value={form.vaccine}
                    onChange={setField('vaccine')}
                    placeholder={t('immunization.vaccinePh')}
                    className={inputClass}
                  />
                  <datalist id="vaccine-presets">
                    {VACCINE_PRESETS.map((v) => <option key={v} value={v} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('immunization.vaccinatedAt')} <span className="text-red-500">*</span></label>
                  <input type="date" value={form.vaccinatedAt} onChange={setField('vaccinatedAt')} required className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('immunization.doseNumber')}</label>
                  <input value={form.doseNumber} onChange={setField('doseNumber')} placeholder={t('immunization.doseNumberPh')} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('immunization.manufacturer')}</label>
                  <input value={form.manufacturer} onChange={setField('manufacturer')} placeholder={t('immunization.manufacturerPh')} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('immunization.lot')}</label>
                  <input value={form.lot} onChange={setField('lot')} placeholder={t('immunization.lotPh')} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('immunization.physician')}</label>
                  <input value={form.physician} onChange={setField('physician')} placeholder={t('immunization.physicianPh')} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('immunization.facility')}</label>
                  <input value={form.facility} onChange={setField('facility')} placeholder={t('immunization.facilityPh')} className={inputClass} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('immunization.notesLabel')}</label>
                <textarea
                  value={form.notes}
                  onChange={setField('notes')}
                  placeholder={t('immunization.notesPh')}
                  rows={2}
                  className={`${inputClass} resize-vertical`}
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
                disabled={formLoading || !form.vaccine.trim() || !form.vaccinatedAt}
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

      {/* 削除の確認 */}
      <ConfirmDialog
        isOpen={confirm !== null}
        title={t('immunization.deleteConfirmTitle')}
        message={confirm ? t('immunization.deleteConfirmMsg', { vaccine: confirm.vaccine, date: dayjs(confirm.vaccinatedAt).format('YYYY/MM/DD') }) : ''}
        note={t('common.deleteNote')}
        confirmButtonText={t('common.delete')}
        cancelButtonText={t('common.cancel')}
        confirmButtonVariant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
};

export default ImmunizationsManager;
