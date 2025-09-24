import { Fragment } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  confirmButtonVariant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmButtonText = '確認',
  cancelButtonText = 'キャンセル',
  confirmButtonVariant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  if (!isOpen) return null;

  const confirmButtonClass = confirmButtonVariant === 'danger'
    ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
    : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500';

  return (
    <Fragment>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 p-6 pb-4">
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              confirmButtonVariant === 'danger' ? 'bg-red-100' : 'bg-blue-100'
            }`}>
              <ExclamationTriangleIcon className={`w-6 h-6 ${
                confirmButtonVariant === 'danger' ? 'text-red-600' : 'text-blue-600'
              }`} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              {title}
            </h3>
          </div>

          {/* Content */}
          <div className="px-6 pb-6">
            <p className="text-gray-700 leading-relaxed">
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 px-6 pb-6 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              {cancelButtonText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${confirmButtonClass}`}
            >
              {confirmButtonText}
            </button>
          </div>
        </div>
      </div>
    </Fragment>
  );
};

export default ConfirmDialog;