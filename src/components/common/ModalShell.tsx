import type { ReactNode } from 'react';

interface ModalShellProps {
  maxWidth?: string; // 例: 'max-w-2xl'
  z?: string;        // 例: 'z-50'（入れ子モーダル用に上げられる）
  children: ReactNode;
}

/**
 * 全モーダル共通の外枠（オーバーレイ＋白カード）。
 * 中に <ModalHeader/> と本文・フッターを入れて使う。
 */
const ModalShell = ({ maxWidth = 'max-w-2xl', z = 'z-50', children }: ModalShellProps) => (
  <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 ${z}`}>
    <div className={`bg-white rounded-lg shadow-xl w-full ${maxWidth} max-h-[90vh] overflow-hidden flex flex-col`}>
      {children}
    </div>
  </div>
);

export default ModalShell;
