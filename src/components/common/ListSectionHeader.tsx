import type { ReactNode } from 'react';

interface ListSectionHeaderProps {
  title: string;
  badge: string;
  children?: ReactNode; // 右側アクション（新規ボタン・表示切替など）
}

// 記録系一覧の共通ヘッダー。見出し＋件数バッジ（左）とアクション（右）を全タブで揃える。
const ListSectionHeader = ({ title, badge, children }: ListSectionHeaderProps) => (
  <div className="flex justify-between items-center gap-3 mb-6">
    <div className="flex items-center gap-3 min-w-0">
      <h3 className="text-xl font-semibold text-gray-800 whitespace-nowrap">{title}</h3>
      <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full whitespace-nowrap">{badge}</span>
    </div>
    {children && <div className="flex items-center gap-3 shrink-0">{children}</div>}
  </div>
);

export default ListSectionHeader;
