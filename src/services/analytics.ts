/**
 * Firebase Analytics 専用モジュール
 * 動的インポート用に分離
 */

import { getAnalytics, logEvent } from 'firebase/analytics';
import app from '../firebase';

// Analytics インスタンスをエクスポート
export const analytics = getAnalytics(app);

// Analytics ログ送信関数
export const sendAnalyticsEvent = (eventName: string, parameters: Record<string, unknown>) => {
  logEvent(analytics, eventName, parameters);
};