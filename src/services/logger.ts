/**
 * 統合ロギングサービス
 * Firebase Analytics + Console + 将来のCrashlytics対応
 */

interface LogLevel {
  DEBUG: 'debug';
  INFO: 'info';
  WARN: 'warn';
  ERROR: 'error';
}

const LOG_LEVELS: LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
} as const;

type LogLevelType = LogLevel[keyof LogLevel];

interface LogContext {
  userId?: string;
  action?: string;
  component?: string;
  residentId?: string;
  timestamp?: number;
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevelType;
  message: string;
  context?: LogContext;
  error?: Error;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;
  private userId: string | null = null;

  /**
   * ユーザーIDを設定（認証後に呼び出し）
   */
  setUserId(userId: string | null) {
    this.userId = userId;
  }

  /**
   * デバッグログ（開発環境のみ）
   */
  debug(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      this.log({
        level: LOG_LEVELS.DEBUG,
        message,
        context
      });
    }
  }

  /**
   * 情報ログ
   */
  info(message: string, context?: LogContext) {
    this.log({
      level: LOG_LEVELS.INFO,
      message,
      context
    });
  }

  /**
   * 警告ログ
   */
  warn(message: string, context?: LogContext) {
    this.log({
      level: LOG_LEVELS.WARN,
      message,
      context
    });
  }

  /**
   * エラーログ
   */
  error(message: string, error?: Error, context?: LogContext) {
    this.log({
      level: LOG_LEVELS.ERROR,
      message,
      error,
      context
    });
  }

  /**
   * 認証関連のエラー
   */
  authError(message: string, errorCode?: string, context?: LogContext) {
    this.error(message, undefined, {
      ...context,
      component: 'auth',
      errorCode
    });
  }

  /**
   * Firestore操作のエラー
   */
  firestoreError(message: string, error?: Error, context?: LogContext) {
    this.error(message, error, {
      ...context,
      component: 'firestore'
    });
  }

  /**
   * ユーザー操作のログ
   */
  userAction(action: string, context?: LogContext) {
    this.info(`User action: ${action}`, {
      ...context,
      action,
      component: 'user-interaction'
    });
  }

  /**
   * パフォーマンス計測
   */
  performance(operation: string, duration: number, context?: LogContext) {
    this.info(`Performance: ${operation}`, {
      ...context,
      operation,
      duration,
      component: 'performance'
    });
  }

  /**
   * メインログ処理
   */
  private log(entry: LogEntry) {
    const logContext: LogContext = {
      timestamp: Date.now(),
      userId: this.userId || undefined,
      ...entry.context
    };

    // コンソールログ（開発環境 + 重要なエラー）
    if (this.isDevelopment || entry.level === LOG_LEVELS.ERROR) {
      this.logToConsole(entry, logContext);
    }

    // Firebase Analytics イベント（本番環境）
    if (!this.isDevelopment && entry.level !== LOG_LEVELS.DEBUG) {
      this.logToAnalytics(entry, logContext);
    }

    // 将来のCrashlytics統合ポイント
    if (entry.level === LOG_LEVELS.ERROR && entry.error) {
      this.logToCrashlytics(entry, logContext);
    }
  }

  /**
   * 開発環境でのコンソール出力（本番では無効）
   */
  private logToConsole(entry: LogEntry, context: LogContext) {
    // 本番環境ではコンソール出力を完全に無効化
    if (!this.isDevelopment) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}]`;
    const message = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case LOG_LEVELS.DEBUG:
        console.debug(message, context, entry.error);
        break;
      case LOG_LEVELS.INFO:
        console.info(message, context);
        break;
      case LOG_LEVELS.WARN:
        console.warn(message, context);
        break;
      case LOG_LEVELS.ERROR:
        console.error(message, context, entry.error);
        break;
    }
  }

  /**
   * Firebase Analytics イベント送信
   */
  private async logToAnalytics(entry: LogEntry, context: LogContext) {
    try {
      // Firebase Analytics動的インポート（バンドルサイズ最適化）
      const { sendAnalyticsEvent } = await import('./analytics');

      // カスタムイベントとして送信
      sendAnalyticsEvent('app_log', {
        log_level: entry.level,
        log_message: entry.message.substring(0, 100), // Analytics制限対応
        component: context.component || 'unknown',
        action: context.action || 'unknown',
        user_id: context.userId || 'anonymous'
      });
    } catch (error) {
      // Analytics送信失敗は無視（アプリの動作に影響させない）
      if (this.isDevelopment) {
        console.warn('Failed to send analytics event:', error);
      }
    }
  }

  /**
   * Crashlytics連携（将来実装）
   */
  private logToCrashlytics(entry: LogEntry, context: LogContext) {
    // TODO: Firebase Crashlytics実装時にここに追加
    // 現在はコンソールログで代替
    if (this.isDevelopment && entry.error) {
      console.group('🔥 Crashlytics (Dev Mode)');
      console.error('Error:', entry.error);
      console.log('Context:', context);
      console.groupEnd();
    }
  }
}

// シングルトンインスタンス
export const logger = new Logger();

// 便利なエクスポート
export const { debug, info, warn, error, authError, firestoreError, userAction, performance } = logger;

export default logger;