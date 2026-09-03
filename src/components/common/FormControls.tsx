import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const BASE = 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors';
const NORMAL = 'border-gray-300 focus:ring-blue-500 focus:border-blue-500';
const ERRORED = 'border-red-300 focus:ring-red-500 focus:border-red-500';

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & { error?: boolean };

/** 共通テキスト入力（date/text 等）。 */
export const TextInput = ({ error, className = '', ...rest }: TextInputProps) => (
  <input {...rest} className={`${BASE} ${error ? ERRORED : NORMAL} ${className}`} />
);

/** 共通セレクト。 */
export const Select = ({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...rest} className={`${BASE} ${NORMAL} bg-white ${className}`}>
    {children}
  </select>
);

/** 共通テキストエリア。 */
export const Textarea = ({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...rest} className={`${BASE} ${NORMAL} resize-vertical ${className}`} />
);
