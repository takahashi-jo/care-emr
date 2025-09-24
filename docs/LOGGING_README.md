# 🔍 Firebase ベストプラクティス ロギングシステム

介護施設電子カルテシステム「CareEMR」に実装された包括的なロギング・エラーハンドリングシステムの説明書です。

## 📋 **実装概要**

### **1. 統合ロギングサービス (`src/services/logger.ts`)**

Firebase Analytics + Console Logging + 将来のCrashlytics対応を統合した包括的なロギングシステム。

#### **主要機能**
- **レベル別ログ出力** (DEBUG, INFO, WARN, ERROR)
- **Firebase Analytics自動連携** (本番環境)
- **ユーザー行動追跡**
- **パフォーマンス監視**
- **開発環境でのコンソール出力**

#### **使用例**
```typescript
import { logger } from '../services/logger';

// 基本的なログ
logger.info('User logged in', {
  component: 'auth',
  action: 'login',
  userId: 'user123'
});

// エラーログ
logger.error('Database operation failed', error, {
  component: 'firestore',
  action: 'create_resident'
});

// ユーザー行動追跡
logger.userAction('resident_created', {
  component: 'resident-form',
  residentId: 'res123'
});

// パフォーマンス監視
logger.performance('database_query', 1250, {
  component: 'firestore',
  operation: 'search_residents'
});
```

### **2. エラーハンドリングフック (`src/hooks/useErrorHandler.ts`)**

Firebase特有のエラーコードを日本語化し、統一的なエラー処理を提供。

#### **主要機能**
- **Firebase Auth エラーの日本語化**
- **Firestore エラーの日本語化**
- **非同期操作のエラーラッピング**
- **パフォーマンス測定付きエラーハンドリング**

#### **使用例**
```typescript
import { useErrorHandler } from '../hooks/useErrorHandler';

const MyComponent = () => {
  const { handleAuthError, handleFirestoreError, withErrorHandling } = useErrorHandler();

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      const errorMessage = handleAuthError(error, {
        component: 'login',
        action: 'google_signin'
      });
      setError(errorMessage);
    }
  };

  // 非同期操作のラッピング
  const safeCreateResident = withErrorHandling(
    () => residentService.create(formData),
    '入所者の登録に失敗しました',
    { component: 'resident-form' }
  );
};
```

### **3. パフォーマンス監視フック (`src/hooks/usePerformanceMonitor.ts`)**

Web Performance API を活用したリアルタイムパフォーマンス監視。

#### **主要機能**
- **レンダー時間計測**
- **非同期操作の時間計測**
- **ユーザーインタラクション監視**
- **メモリ使用量チェック**
- **Web Vitals 監視**

#### **使用例**
```typescript
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';

const ResidentForm = () => {
  const {
    measureRenderTime,
    measureAsyncOperation,
    measureInteraction
  } = usePerformanceMonitor('ResidentForm', {
    threshold: 100,
    trackMemory: true
  });

  // レンダー完了時
  useEffect(() => {
    measureRenderTime();
  });

  // 非同期操作の監視
  const handleSubmit = async () => {
    await measureAsyncOperation(
      () => residentService.create(formData),
      'create_resident'
    );
  };

  // ユーザーインタラクション監視
  const handleButtonClick = () => {
    const measureEnd = measureInteraction('form_submit', performance.now());
    // ... フォーム処理
    measureEnd(); // 処理完了時に呼び出し
  };
};
```

## 🔧 **既存コードへの統合状況**

### **1. 認証システム (`src/contexts/AuthContext.tsx`)**
```typescript
// ✅ 実装済み
- ログイン/ログアウトの追跡
- 認証エラーの詳細ログ
- アクセス拒否の監視
- ユーザーIDの自動設定
```

### **2. Firestoreサービス (`src/services/firestore.ts`)**
```typescript
// ✅ 実装済み
- CRUD操作のログ記録
- 検索クエリの監視
- エラー発生時の詳細ログ
- 操作パフォーマンスの追跡
```

### **3. React フック (`src/hooks/useAuth.ts`)**
```typescript
// ✅ 実装済み
- 認証状態変更の追跡
- エラーハンドリングの統合
```

## 📊 **ログ出力例**

### **開発環境でのコンソール出力**
```
[2025-01-15T10:30:45.123Z] [INFO] User action: google_signin_completed
Context: {
  component: "auth",
  userId: "abc123",
  timestamp: 1642247445123
}

[2025-01-15T10:30:50.456Z] [ERROR] Failed to create resident
Context: {
  component: "firestore",
  action: "create_resident",
  residentName: "田中太郎",
  errorCode: "permission-denied"
}
Error: FirebaseError: Missing or insufficient permissions
```

### **Firebase Analytics イベント（本番環境）**
```json
{
  "event_name": "app_log",
  "parameters": {
    "log_level": "error",
    "log_message": "Failed to create resident",
    "component": "firestore",
    "action": "create_resident",
    "user_id": "abc123"
  }
}
```

## 🚀 **Firebase Console での監視**

### **1. Analytics Dashboard**
- **カスタムイベント**: `app_log` でアプリケーションログを確認
- **ユーザー行動**: 認証、CRUD操作、検索などの追跡
- **エラー率**: コンポーネント別、機能別のエラー発生状況

### **2. Crashlytics（将来実装）**
- **クラッシュレポート**: 自動的なエラー収集
- **非致命的エラー**: カスタムエラーの追跡
- **ユーザー影響分析**: エラーの影響範囲

## 🔐 **セキュリティとプライバシー**

### **データ保護**
- **個人情報の除外**: ログには個人を特定できる情報を含めない
- **ID化**: 入所者名などは操作ログでのみ記録
- **暗号化**: Firebase Analytics の自動暗号化

### **GDPR準拠**
- **ユーザー同意**: Analytics使用の透明性
- **データ保持期間**: Firebase Analytics の自動管理
- **削除権**: ユーザーデータ削除時のログ除外

## 🎯 **本番運用での利点**

### **1. 問題の早期発見**
- **パフォーマンス劣化の検出**
- **エラー発生パターンの分析**
- **ユーザー行動の異常検知**

### **2. 運用効率の向上**
- **詳細なエラーログによる迅速な問題解決**
- **ユーザー操作ログによる使用状況分析**
- **システム負荷の可視化**

### **3. 継続的改善**
- **データドリブンな機能改善**
- **ユーザビリティの最適化**
- **システム安定性の向上**

## 📝 **追加実装推奨項目**

### **短期目標**
1. **主要コンポーネントへのパフォーマンス監視追加**
2. **ユーザー行動分析の詳細化**
3. **エラーダッシュボードの構築**

### **中期目標**
1. **Firebase Crashlytics の正式導入**
2. **カスタムアラートの設定**
3. **A/Bテスト用ログの実装**

### **長期目標**
1. **機械学習によるエラー予測**
2. **自動修復機能の実装**
3. **リアルタイム監視ダッシュボード**

---

このロギングシステムにより、CareEMRは**enterprise-grade**の監視・エラーハンドリング機能を備え、安定した本番運用が可能になります。