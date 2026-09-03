import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ElementType } from 'react';

interface ModalHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ElementType;
  onClose?: () => void;
}

/**
 * 全モーダル共通のヘッダー（青系グラデ）。
 * デザインを変えるときはこのファイルだけ直せば全モーダルに反映される。
 */
const ModalHeader = ({ title, subtitle, icon: Icon, onClose }: ModalHeaderProps) => (
  <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between gap-3">
    <div className="flex items-center gap-3 min-w-0">
      {Icon && <Icon className="w-6 h-6 shrink-0" />}
      <div className="min-w-0">
        <h2 className="text-lg font-bold truncate">{title}</h2>
        {subtitle && <p className="text-blue-100 text-sm truncate">{subtitle}</p>}
      </div>
    </div>
    {onClose && (
      <button
        onClick={onClose}
        aria-label="閉じる"
        className="text-white/80 hover:text-white shrink-0 transition-colors"
      >
        <XMarkIcon className="w-6 h-6" />
      </button>
    )}
  </div>
);

export default ModalHeader;
