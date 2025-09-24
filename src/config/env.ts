/**
 * 型安全な環境変数管理
 * Vite の import.meta.env を使用してWebアプリのベストプラクティスに従う
 */

interface EnvironmentConfig {
  // Firebase設定
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId: string;
  };

  // アプリケーション設定
  app: {
    name: string;
    version: string;
    environment: 'development' | 'production';
    debugEnabled: boolean;
  };

  // 外部サービス設定
  external: {
    googleFontsUrl: string;
  };
}

// 環境変数の型安全な取得関数
const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = import.meta.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
};

// 環境変数の検証とパース
const createEnvironmentConfig = (): EnvironmentConfig => {
  // Firebase設定の検証
  const firebase = {
    apiKey: getEnvVar('VITE_FIREBASE_API_KEY'),
    authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnvVar('VITE_FIREBASE_APP_ID'),
    measurementId: getEnvVar('VITE_FIREBASE_MEASUREMENT_ID'),
  };

  // アプリケーション設定
  const app = {
    name: getEnvVar('VITE_APP_NAME', 'CareEMR'),
    version: getEnvVar('VITE_APP_VERSION', '1.0.0'),
    environment: (getEnvVar('VITE_APP_ENV', 'development') as 'development' | 'production'),
    debugEnabled: import.meta.env.DEV || getEnvVar('VITE_DEBUG_ENABLED', 'false') === 'true',
  };

  // 外部サービス設定
  const external = {
    googleFontsUrl: getEnvVar(
      'VITE_GOOGLE_FONTS_URL',
      'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+JP:wght@300;400;500;600;700&display=swap'
    ),
  };

  return { firebase, app, external };
};

// 設定の初期化と検証
let config: EnvironmentConfig;

try {
  config = createEnvironmentConfig();
} catch (error) {
  // 設定エラーは致命的なので最小限のエラー表示
  throw new Error(`Environment configuration failed: ${error}`);
}

// エクスポート
export const env = config;
export default env;

// 便利な型エクスポート
export type { EnvironmentConfig };

// 環境チェック用ヘルパー
export const isDevelopment = () => config.app.environment === 'development';
export const isProduction = () => config.app.environment === 'production';