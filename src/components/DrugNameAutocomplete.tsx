import { useState, useEffect, useRef } from 'react';
import { drugMasterService } from '../services/firestore';
import type { DrugMasterItem } from '../types';

interface DrugNameAutocompleteProps {
  value: string;
  // フリー入力時は item を渡さない。候補選択時は item を渡してコードも紐づける。
  onChange: (name: string, item?: DrugMasterItem) => void;
  placeholder?: string;
}

const DrugNameAutocomplete = ({ value, onChange, placeholder }: DrugNameAutocompleteProps) => {
  const [results, setResults] = useState<DrugMasterItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<number | null>(null);

  useEffect(() => {
    const q = value.trim();
    if (!focused || q.length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      const items = await drugMasterService.search(q, 10);
      setResults(items);
      setOpen(items.length > 0);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [value, focused]);

  useEffect(() => () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }, []);

  const handleSelect = (item: DrugMasterItem) => {
    onChange(item.name, item);
    setOpen(false);
    setResults([]);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => {
            setFocused(false);
            setOpen(false);
          }, 150);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
      {loading && (
        <div className="absolute right-3 top-2.5 text-xs text-gray-400">検索中…</div>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(item);
                }}
                className="w-full text-left px-3 py-2 hover:bg-teal-50 text-sm flex items-center justify-between gap-2"
              >
                <span className="text-gray-900">{item.name}</span>
                {item.yjCode && <span className="text-xs text-gray-400 shrink-0">YJ:{item.yjCode}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DrugNameAutocomplete;
