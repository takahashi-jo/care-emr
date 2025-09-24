# 環境変数設定ガイド

## 概要

CareEMRアプリケーションは環境変数を使用してFirebase設定やその他の外部サービス設定を管理しています。開発環境（local）と本番環境（production）の2つの環境での設定方法を説明します。

## 🔑 Firebase API Key について

Firebase API Keyは **Gitにコミット可能** です：
- クライアントサイドアプリでは必然的に公開される仕様
- API Keyは「識別子」であり「秘密鍵」ではない
- セキュリティはFirestore Security Rulesで制御

## 📋 必要な環境変数

### Firebase設定
```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### アプリケーション設定
```
VITE_APP_NAME=CareEMR
VITE_APP_VERSION=1.0.0
VITE_APP_ENV=development|production
VITE_DEBUG_ENABLED=true|false
```

### 外部サービス設定
```
VITE_GOOGLE_FONTS_URL=https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+JP:wght@300;400;500;600;700&display=swap
```

## 🚀 セットアップ手順

### 1. 開発環境

1. `.env.example` をコピーして `.env.development` を作成
2. Firebase Console からプロジェクト設定を取得
3. 必要な値を設定

```bash
cp .env.example .env.development
# .env.development を編集
```

### 2. 本番環境

1. `.env.production` を作成
2. 本番用Firebase プロジェクトの設定を入力
3. `VITE_DEBUG_ENABLED=false` に設定

## 🔒 セキュリティ

### 環境変数の取り扱い
- **開発環境**: `.env.development` はGitにコミット済み
- **本番環境**: `.env.production` もGitにコミット済み
- **Firebase API Key**: 公開されても安全なためコミット可能
- **CI/CD**: そのまま使用可能

### Firebase設定の取り扱い
- APIキーは公開されても問題なし（Firebaseの仕様）
- セキュリティはFirestore Security Rulesで制御
- 管理者認証はFirebase Admin SDKのカスタムクレームで制御

## 🛠 Firebase App Hosting での設定

`apphosting.yaml` で環境変数を設定：

```yaml
runConfig:
  env:
    - variable: VITE_FIREBASE_API_KEY
      value: ${{ vars.FIREBASE_API_KEY }}
    - variable: VITE_FIREBASE_PROJECT_ID
      value: ${{ vars.FIREBASE_PROJECT_ID }}
    # 他の環境変数...
```

## 🧪 テスト

環境変数が正しく設定されているかテスト：

```bash
# 開発サーバー起動時にコンソールで確認
npm run dev

# ビルド時に検証
npm run build
```

## ❌ トラブルシューティング

### よくあるエラー

1. **Environment variable XXX is required but not set**
   - 必要な環境変数が設定されていません
   - `.env.development` を確認してください

2. **Firebase configuration error**
   - Firebase設定値が間違っています
   - Firebase Console で正しい値を確認してください

3. **Font loading error**
   - Google Fonts URLが無効です
   - `VITE_GOOGLE_FONTS_URL` を確認してください

### デバッグ方法

1. 開発環境で `VITE_DEBUG_ENABLED=true` に設定
2. ブラウザのコンソールでログを確認
3. ネットワークタブでリクエストを確認

## 📚 関連ファイル

- `src/config/env.ts` - 環境変数管理
- `src/utils/fonts.ts` - フォント読み込み
- `src/firebase.ts` - Firebase初期化
- `.env.example` - 設定例
- `.env.development` - 開発環境設定
- `.env.production` - 本番環境設定