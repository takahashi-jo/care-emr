import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { env } from './config/env';

// 環境変数から Firebase 設定を取得
const firebaseConfig = {
  apiKey: env.firebase.apiKey,
  authDomain: env.firebase.authDomain,
  projectId: env.firebase.projectId,
  storageBucket: env.firebase.storageBucket,
  messagingSenderId: env.firebase.messagingSenderId,
  appId: env.firebase.appId,
  measurementId: env.firebase.measurementId,
};

// Firebase アプリの初期化
const app = initializeApp(firebaseConfig);

// サービスのエクスポート
export const db = getFirestore(app);
export const auth = getAuth(app);

// ローカル開発時のみ Firebase Emulator に接続（本番データには一切触れない）
// .env.development で VITE_USE_EMULATOR=true のときだけ有効化される
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === 'true') {
  // アプリを開いたホスト名（localhost でも WSL の IP でも）に合わせて Emulator へ接続する。
  // WSL 上で開発し Windows のブラウザから WSL の IP でアクセスする場合に必要。
  const emulatorHost = window.location.hostname || 'localhost';
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 8080);
}

// アプリインスタンスのデフォルトエクスポート
export default app;