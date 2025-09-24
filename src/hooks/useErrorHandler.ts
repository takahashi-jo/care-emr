/**
 * エラーハンドリングカスタムフック
 * 統一されたエラー処理とユーザー通知
 */

import { useCallback } from 'react';
import { logger } from '../services/logger';

export interface ErrorContext {
  component?: string;
  action?: string;
  residentId?: string;
  userId?: string;
  [key: string]: unknown;
}

export interface ErrorHandlerOptions {
  showToUser?: boolean;
  logLevel?: 'warn' | 'error';
  context?: ErrorContext;
}

export const useErrorHandler = () => {
  /**
   * Firebase認証エラーの処理
   */
  const handleAuthError = useCallback((error: unknown, context?: ErrorContext) => {
    const firebaseError = error as { code?: string; message?: string };
    let userMessage = '認証に失敗しました';

    // Firebase Auth エラーコードの日本語化
    switch (firebaseError.code) {
      case 'auth/popup-blocked':
        userMessage = 'ポップアップがブロックされました。ブラウザの設定でポップアップを許可してください。';
        break;
      case 'auth/popup-closed-by-user':
        userMessage = 'ログインがキャンセルされました';
        break;
      case 'auth/cancelled-popup-request':
        userMessage = 'ログイン処理がキャンセルされました';
        break;
      case 'auth/unauthorized-domain':
        userMessage = 'このドメインは認証が許可されていません';
        break;
      case 'auth/account-exists-with-different-credential':
        userMessage = 'このメールアドレスは既に別の認証方法で使用されています';
        break;
      case 'auth/admin-restricted-operation':
        userMessage = 'このアカウントはシステムへのアクセスが許可されていません。管理者にお問い合わせください。';
        break;
      default:
        userMessage = `認証エラー: ${firebaseError.message || 'Unknown error'}`;
    }

    logger.authError('Authentication failed', firebaseError.code, {
      ...context,
      errorMessage: firebaseError.message
    });

    return userMessage;
  }, []);

  /**
   * Firestore操作エラーの処理
   */
  const handleFirestoreError = useCallback((error: unknown, operation: string, context?: ErrorContext) => {
    const firestoreError = error as { code?: string; message?: string };
    let userMessage = '操作に失敗しました';

    // Firestore エラーコードの日本語化
    switch (firestoreError.code) {
      case 'permission-denied':
        userMessage = 'アクセス権限がありません';
        break;
      case 'not-found':
        userMessage = 'データが見つかりません';
        break;
      case 'already-exists':
        userMessage = 'データが既に存在します';
        break;
      case 'resource-exhausted':
        userMessage = 'システムが混雑しています。しばらく待ってから再試行してください';
        break;
      case 'deadline-exceeded':
        userMessage = 'タイムアウトしました。ネットワーク接続を確認してください';
        break;
      case 'unavailable':
        userMessage = 'サービスが一時的に利用できません';
        break;
      default:
        if (operation === 'create') userMessage = '登録に失敗しました';
        else if (operation === 'update') userMessage = '更新に失敗しました';
        else if (operation === 'delete') userMessage = '削除に失敗しました';
        else if (operation === 'read') userMessage = 'データの取得に失敗しました';
    }

    logger.firestoreError(`Firestore ${operation} failed`, firestoreError as Error, {
      ...context,
      operation,
      errorCode: firestoreError.code
    });

    return userMessage;
  }, []);

  /**
   * 一般的なエラーハンドリング
   */
  const handleError = useCallback((
    error: unknown,
    defaultMessage: string = '予期しないエラーが発生しました',
    options: ErrorHandlerOptions = {}
  ) => {
    const { showToUser = true, logLevel = 'error', context } = options;

    const errorInstance = error instanceof Error ? error : new Error(String(error));
    const userMessage = errorInstance.message || defaultMessage;

    if (logLevel === 'error') {
      logger.error(defaultMessage, errorInstance, context);
    } else {
      logger.warn(defaultMessage, context);
    }

    return showToUser ? userMessage : null;
  }, []);

  /**
   * 非同期操作のエラーハンドリングラッパー
   */
  const withErrorHandling = useCallback(<T>(
    asyncFn: () => Promise<T>,
    errorMessage: string,
    context?: ErrorContext
  ) => {
    return async (): Promise<T | null> => {
      try {
        return await asyncFn();
      } catch (error) {
        handleError(error, errorMessage, { context });
        return null;
      }
    };
  }, [handleError]);

  /**
   * パフォーマンス測定付きエラーハンドリング
   */
  const withPerformanceTracking = useCallback(<T>(
    asyncFn: () => Promise<T>,
    operationName: string,
    context?: ErrorContext
  ) => {
    return async (): Promise<T | null> => {
      const startTime = performance.now();
      try {
        const result = await asyncFn();
        const duration = performance.now() - startTime;
        logger.performance(operationName, duration, context);
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        logger.performance(`${operationName} (failed)`, duration, context);
        handleError(error, `${operationName} failed`, { context });
        return null;
      }
    };
  }, [handleError]);

  return {
    handleAuthError,
    handleFirestoreError,
    handleError,
    withErrorHandling,
    withPerformanceTracking
  };
};

export default useErrorHandler;