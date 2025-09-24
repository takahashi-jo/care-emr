/**
 * フォント読み込みユーティリティ
 * 外部フォントを環境変数から動的に読み込む
 */
import { env } from '../config/env';

/**
 * Google Fonts を動的に読み込む関数
 * パフォーマンス最適化のためpreloadとpreconnectを使用
 */
export const loadGoogleFonts = () => {
  const fontUrl = env.external.googleFontsUrl;

  // Google Fonts への事前接続（パフォーマンス最適化）
  const preconnectLink = document.createElement('link');
  preconnectLink.rel = 'preconnect';
  preconnectLink.href = 'https://fonts.googleapis.com';
  document.head.appendChild(preconnectLink);

  const preconnectLink2 = document.createElement('link');
  preconnectLink2.rel = 'preconnect';
  preconnectLink2.href = 'https://fonts.gstatic.com';
  preconnectLink2.crossOrigin = 'anonymous';
  document.head.appendChild(preconnectLink2);

  // フォントCSSの読み込み
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = fontUrl;
  fontLink.media = 'print';
  fontLink.onload = () => {
    fontLink.media = 'all';
  };

  // フォールバックとしてnoscriptタグも追加
  const noscript = document.createElement('noscript');
  const fallbackLink = document.createElement('link');
  fallbackLink.rel = 'stylesheet';
  fallbackLink.href = fontUrl;
  noscript.appendChild(fallbackLink);

  document.head.appendChild(fontLink);
  document.head.appendChild(noscript);
};

/**
 * フォント読み込み完了を待つPromise
 */
export const waitForFontsLoad = (): Promise<void> => {
  return new Promise((resolve) => {
    if ('fonts' in document) {
      document.fonts.ready.then(() => resolve());
    } else {
      // Font Loading API が利用できない場合は短時間待機
      setTimeout(() => resolve(), 100);
    }
  });
};