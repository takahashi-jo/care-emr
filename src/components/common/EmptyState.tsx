interface EmptyStateProps {
  title: string;
  hint?: string;
}

// 「まだ登録がありません」系の空状態（各一覧で共通利用）
const EmptyState = ({ title, hint }: EmptyStateProps) => (
  <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center bg-gray-50">
    <p className="text-gray-600 font-medium">{title}</p>
    {hint && <p className="text-sm text-gray-500 mt-1">{hint}</p>}
  </div>
);

export default EmptyState;
