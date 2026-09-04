import { useTranslation } from 'react-i18next';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface SnackbarProps {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
  onClose: () => void;
}

// 画面上部中央に出す通知トースト（全モーダル・画面で共通利用）
const Snackbar = ({ open, message, severity, onClose }: SnackbarProps) => {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[110]">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] ${
        severity === 'success'
          ? 'bg-green-100 text-green-800 border border-green-200'
          : 'bg-red-100 text-red-800 border border-red-200'
      }`}>
        <div className="flex-shrink-0">
          {severity === 'success' ? <CheckIcon className="w-5 h-5" /> : <XMarkIcon className="w-5 h-5" />}
        </div>
        <span className="flex-1 font-medium">{message}</span>
        <button
          onClick={onClose}
          className="flex-shrink-0 text-current hover:opacity-70 transition-opacity"
          aria-label={t('common.close')}
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Snackbar;
