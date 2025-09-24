import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
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

// アプリインスタンスのデフォルトエクスポート
export default app;