import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { UserIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import ModalHeader from './common/ModalHeader';
import MedicalRecordsManager from './MedicalRecordsManager';
import ProblemsManager from './ProblemsManager';
import VitalsManager from './VitalsManager';
import LabResultsManager from './LabResultsManager';
import MedicationsManager from './MedicationsManager';
import ImmunizationsManager from './ImmunizationsManager';
import type { Resident } from '../types';

interface PatientChartProps {
  resident: Resident;
  open: boolean;
  onClose: () => void;
  onEdit: (r: Resident) => void;
  onDelete: (r: Resident) => void;
}

type Tab = 'overview' | 'records' | 'problems' | 'vitals' | 'labs' | 'meds' | 'immunizations';

// 概要タブ（入所者情報＋編集/削除）
const Overview = ({ resident, onEdit, onDelete }: { resident: Resident; onEdit: (r: Resident) => void; onDelete: (r: Resident) => void }) => {
  const { t } = useTranslation();
  const age = dayjs().diff(dayjs(resident.birthDate), 'year');
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-sm font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        {resident.dischargeDate ? (
          <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-gray-200 text-gray-700 rounded-full">{t('roster.dischargedFull')}</span>
        ) : (
          <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-green-100 text-green-800 rounded-full">{t('roster.statusActive')}</span>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(resident)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <PencilSquareIcon className="w-4 h-4" />
            {t('common.edit')}
          </button>
          <button
            onClick={() => onDelete(resident)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
            {t('common.delete')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Field label={t('resident.name')}><p className="text-lg font-medium text-gray-900">{resident.name}</p></Field>
        <Field label={t('resident.furigana')}><p className="text-lg font-medium text-gray-900">{resident.furigana}</p></Field>
        <Field label={t('resident.gender')}><p className="text-lg font-medium text-gray-900">{t(resident.gender === '男性' ? 'resident.male' : 'resident.female')}</p></Field>
        <Field label={t('resident.birthDate')}>
          <p className="text-lg font-medium text-gray-900">{t('roster.birthDateValue', { date: dayjs(resident.birthDate).format('YYYY/MM/DD'), age })}</p>
        </Field>
        <Field label={t('resident.room')}>
          <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-gray-100 text-gray-700 rounded-full">{resident.roomNumber}</span>
        </Field>
        <Field label={t('resident.careLevel')}>
          <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full">{t('resident.careLevelOption', { n: resident.careLevel })}</span>
        </Field>
        <Field label={t('resident.admissionDate')}>
          <p className="text-lg font-medium text-gray-900">{dayjs(resident.admissionDate).format('YYYY/MM/DD')}</p>
        </Field>
        <Field label={t('roster.dischargeDate')}>
          <p className="text-lg font-medium text-gray-900">{resident.dischargeDate ? dayjs(resident.dischargeDate).format('YYYY/MM/DD') : '-'}</p>
        </Field>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-500 mb-1">{t('resident.allergy')}</label>
        {resident.allergyStatus === 'あり' ? (
          <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-red-100 text-red-800 rounded-full">{resident.allergies || t('resident.allergyPresent')}</span>
        ) : resident.allergyStatus === 'なし' ? (
          <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-green-100 text-green-800 rounded-full">{t('roster.noAllergy')}</span>
        ) : (
          <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-amber-100 text-amber-800 rounded-full">{t('resident.allergyUnknown')}</span>
        )}
      </div>

      {resident.medicalHistory && (
        <div>
          <hr className="my-4 border-gray-200" />
          <label className="block text-sm font-medium text-gray-500 mb-2">{t('resident.medicalHistory')}</label>
          <p className="text-gray-700 whitespace-pre-wrap">{resident.medicalHistory}</p>
        </div>
      )}

      <div className="mt-6 pt-3 border-t border-gray-100 text-xs text-gray-400">
        {t('common.createdBy', { name: resident.createdBy?.name ?? '-', date: dayjs(resident.createdAt).format('YYYY/MM/DD HH:mm') })}
        {resident.updatedBy && <> / {t('common.updatedBy', { name: resident.updatedBy.name, date: dayjs(resident.updatedAt).format('YYYY/MM/DD HH:mm') })}</>}
      </div>
    </div>
  );
};

// 患者カルテ。回診一覧の行から開き、タブで各記録を切り替える。
const PatientChart = ({ resident, open, onClose, onEdit, onDelete }: PatientChartProps) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('overview');
  if (!open) return null;

  const age = dayjs().diff(dayjs(resident.birthDate), 'year');
  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: t('chart.tabOverview') },
    { key: 'records', label: t('chart.tabRecords') },
    { key: 'problems', label: t('chart.tabProblems') },
    { key: 'vitals', label: t('chart.tabVitals') },
    { key: 'labs', label: t('chart.tabLabs') },
    { key: 'meds', label: t('chart.tabMeds') },
    { key: 'immunizations', label: t('chart.tabImmunizations') },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        <ModalHeader
          title={resident.name}
          subtitle={t('resident.subtitle', { gender: t(resident.gender === '男性' ? 'resident.male' : 'resident.female'), age, room: resident.roomNumber })}
          icon={UserIcon}
          onClose={onClose}
        />

        <div className="border-b border-gray-200 px-2 overflow-x-auto shrink-0">
          <nav className="flex">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  tab === tb.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tb.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === 'overview' && <Overview resident={resident} onEdit={onEdit} onDelete={onDelete} />}
          {tab === 'records' && <MedicalRecordsManager resident={resident} open embedded onClose={() => {}} />}
          {tab === 'problems' && <ProblemsManager resident={resident} open embedded onClose={() => {}} />}
          {tab === 'vitals' && <VitalsManager resident={resident} open embedded onClose={() => {}} />}
          {tab === 'labs' && <LabResultsManager resident={resident} open embedded onClose={() => {}} />}
          {tab === 'meds' && <MedicationsManager resident={resident} open embedded onClose={() => {}} />}
          {tab === 'immunizations' && <ImmunizationsManager resident={resident} open embedded onClose={() => {}} />}
        </div>
      </div>
    </div>
  );
};

export default PatientChart;
