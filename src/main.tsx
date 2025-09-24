import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { loadGoogleFonts } from './utils/fonts'
import { env } from './config/env'
import { logger } from './services/logger'
import './index.css'
import App from './App.tsx'

// アプリケーション初期化
const initializeApp = async () => {
  // アプリケーション開始ログ
  logger.info('application_starting', {
    appName: env.app.name,
    version: env.app.version,
    environment: env.app.environment,
    component: 'main'
  });

  // Google Fonts の動的読み込み
  loadGoogleFonts();

  // アプリケーションのレンダリング
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  logger.info('application_initialized', {
    component: 'main'
  });
};

// アプリケーション開始
initializeApp().catch((error) => {
  logger.error('application_initialization_failed', error, {
    component: 'main'
  });
});
