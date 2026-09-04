import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DocumentTextIcon, ClipboardDocumentListIcon, HeartIcon, ChartBarIcon, BeakerIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import type { Resident } from '../types';

interface RecordsMenuProps {
  resident: Resident;
  onRecords: (r: Resident) => void;
  onProblems: (r: Resident) => void;
  onVitals: (r: Resident) => void;
  onLabs: (r: Resident) => void;
  onMeds: (r: Resident) => void;
}

// 回診一覧の操作を集約するメニュー。臨床データ系（診療録/問題/バイタル/検査/投薬）を1つにまとめ、
// 行の操作アイコンの過密を避ける。詳細/編集/削除は行に直接置いたまま。
const RecordsMenu = ({ resident, onRecords, onProblems, onVitals, onLabs, onMeds }: RecordsMenuProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const items = [
    { key: 'records', icon: DocumentTextIcon, label: t('roster.actionRecords'), color: 'text-green-600', on: onRecords },
    { key: 'problems', icon: ClipboardDocumentListIcon, label: t('roster.actionProblems'), color: 'text-indigo-600', on: onProblems },
    { key: 'vitals', icon: HeartIcon, label: t('roster.actionVitals'), color: 'text-rose-600', on: onVitals },
    { key: 'labs', icon: ChartBarIcon, label: t('roster.actionLabs'), color: 'text-cyan-600', on: onLabs },
    { key: 'meds', icon: BeakerIcon, label: t('roster.actionMeds'), color: 'text-teal-600', on: onMeds },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 px-2 py-1 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        {t('roster.records')}
        <ChevronDownIcon className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {items.map((it) => (
            <button
              key={it.key}
              onClick={() => { it.on(resident); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left transition-colors"
            >
              <it.icon className={`w-4 h-4 shrink-0 ${it.color}`} />
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecordsMenu;
