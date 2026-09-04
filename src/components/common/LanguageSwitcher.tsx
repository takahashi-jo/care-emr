import { useTranslation } from 'react-i18next';

// 言語切替（日本語 / English）。ヘッダーに配置。
const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('en') ? 'en' : 'ja';
  return (
    <select
      value={lang}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      aria-label="Language"
    >
      <option value="ja">日本語</option>
      <option value="en">English</option>
    </select>
  );
};

export default LanguageSwitcher;
