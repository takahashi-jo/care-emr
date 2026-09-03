import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  help?: string;
  children: ReactNode;
}

/** ラベル＋必須マーク＋入力＋補助/エラーテキストを揃える共通フィールド。 */
const FormField = ({ label, htmlFor, required, error, help, children }: FormFieldProps) => (
  <div>
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {(error || help) && (
      <p className={`text-xs mt-1 ${error ? 'text-red-600' : 'text-gray-500'}`}>{error || help}</p>
    )}
  </div>
);

export default FormField;
