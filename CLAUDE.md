# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 重要
- 回答・コーディングの際は、必ず、ベストプラクティスな設計・実装をしてください。公式ドキュメントや、よくある実装方法で。
- 設計しなおす・コードを書き直すたびに毎回、それがアプリケーションのベストプラクティスに沿っているか、アンチパターンでないかを考えてください。べスプラでない、アンチパターンであるときは設計やコードを修正してください。
- Firebase Hosting ではなく、Firebase App Hosting を使用している。

## リポジトリ概要

介護施設電子カルテシステム「CareEMR」です。2つの主要コンポーネントで構成されています：

1. **emr-app** - 介護スタッフが入所者記録を管理するReactウェブアプリケーション
2. **admin-setup** - Firebase管理タスクとユーザー管理用のNode.jsスクリプト

## アーキテクチャ

### フロントエンド (emr-app/)
- **フレームワーク**: React 19 + TypeScript + Vite
- **UIライブラリ**: Tailwind CSS
- **認証**: Firebase Auth（GoogleサインインでポップアップフローをiPad対応）
- **データベース**: Cloud Firestore
- **日付処理**: Day.js（日本語ロケール）
- **フォーム**: React Hook Form + Yup バリデーション

### バックエンドサービス
- **認証**: Firebase Auth（カスタムクレーム使用、管理者のみアクセス）
- **データベース**: Cloud Firestore（主要コレクション2つ）
  - `residents` - 入所者情報とケアデータ
  - `medicalRecords` - 入所者にリンクされた日次診療録
- **管理者管理**: Firebase Admin SDK（ユーザープロビジョニング）

### 主要データモデル
- **Resident**: 個人情報、部屋割り当て、介護度（1-5）、服薬、病歴
- **MedicalRecord**: residentIdで入所者にリンクされた日次記録

### セキュリティモデル
- Googleサインイン（管理者カスタムクレーム必須）
- ユーザー登録無効化 - 管理者がアカウントプロビジョニング必須
- Firestoreセキュリティルールで管理者クレーム検証

## よく使う開発コマンド

### フロントエンド開発 (emr-app/)
```bash
cd emr-app
npm run dev          # 開発サーバー起動（Vite）
npm run build        # 本番用ビルド（TypeScript + Vite）
npm run start        # 静的ファイル配信（serve）
npm run lint         # ESLintチェック
npm run preview      # 本番ビルドプレビュー
npm run create-test-data  # Firestoreにテストデータ生成
```

### 管理者管理 (scripts/admin/)
```bash
cd scripts/admin
npm run create-user <email> <displayName>  # 管理者クレーム付き新規ユーザー作成
npm run set-admin <email>                  # 既存ユーザーに管理者クレーム追加
```

## 開発ワークフロー

### 認証開発
- `signInWithPopup`を使用したGoogleサインイン（ポップアップブロック対応のエラーハンドリング付き）
- iPad対応で`prompt: 'select_account'`パラメータ設定
- `AuthContext`で`getIdTokenResult()`経由でカスタムクレームをチェック
- 管理者クレーム必須: `tokenResult.claims.admin === true`

### データベース開発
- 全Firestore操作は`src/services/firestore.ts`に
- 日付処理用のTimestamp変換ユーティリティ
- 日本語名のひらがな/カタカナ検索機能サポート
- 入所者検索範囲: 氏名、姓/名、ふりがな、部屋番号、介護度、服薬

### UI開発
- Tailwind CSSでモダンなレスポンシブデザイン
- 日本語ロケールサポート付きUI
- タブベースナビゲーション: 入所者検索、新規登録
- 日本語エラーメッセージ付きフォームバリデーション

## 重要ファイル

### 設定
- `emr-app/src/firebase.ts` - Firebaseクライアント設定
- `scripts/admin/serviceAccountKey.json` - Firebase Admin SDKキー（git無視）

### コアコンポーネント
- `src/contexts/AuthContext.tsx` - 認証状態管理
- `src/services/firestore.ts` - データベース操作と検索ロジック
- `src/components/SearchPanel.tsx` - メイン入所者検索インターフェース
- `src/components/ResidentForm.tsx` - 新規入所者登録
- `src/components/ResidentDetail.tsx` - 入所者プロフィールと診療録

### 型定義
- `src/types/index.ts` - Resident、MedicalRecord、フォームデータのTypeScriptインターフェース

## Firebaseプロジェクト
- プロジェクトID: `emr-system-dc60d`
- Auth ドメイン: `emr-system-dc60d.firebaseapp.com`
- アクセスには管理者クレーム必須 - 登録無効化済み

## 日本語対応
- 全UI日本語表示
- 入所者名のふりがなサポート
- firestoreサービス内にひらがな/カタカナ変換ユーティリティ
- Day.js日本語ロケール（'ja'）設定
- 介護度1-5

## セキュリティ注意事項
- サービスアカウントキーは`scripts/admin/serviceAccountKey.json`に配置必須
- Firebase設定には公開APIキー含有（クライアントサイドアプリの正常動作）
- ユーザー作成は管理者スクリプトのみ制限
- 全データアクセスには有効な管理者クレーム必須