import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ja from './locales/ja.json';
import en from './locales/en.json';

// 文言は locales/*.json に集約し、t('app.title') 等のキーで参照する。
// 言語は localStorage に保存して次回も維持。既定は日本語。
const STORAGE_KEY = 'careemr.lang';
const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;

i18n.use(initReactI18next).init({
  resources: {
    ja: { translation: ja },
    en: { translation: en },
  },
  lng: saved || 'ja',
  fallbackLng: 'ja',
  interpolation: { escapeValue: false }, // React は既定でエスケープするため不要
});

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // localStorage 不可の環境は無視
  }
});

export default i18n;
