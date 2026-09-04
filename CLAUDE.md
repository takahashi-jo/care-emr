# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 重要
- 回答・コーディングは必ずベストプラクティスで（公式ドキュメント・一般的な実装に沿う）。設計や実装を変えるたびに、べスプラか・アンチパターンでないかを点検し、必要なら直す。
- ホスティングは Firebase Hosting ではなく **Firebase App Hosting**。
- アイコンは自作SVGを使わず **@heroicons/react** のコンポーネントを使う。
- UIの重複を避け、`src/components/common/` の共通部品（ModalHeader / ModalShell / Button / FormField / FormControls / ConfirmDialog / Snackbar / EmptyState / LanguageSwitcher）を使う。同種のUIは既存に揃える。
- 表示文言はハードコードせず、`src/i18n/locales/{ja,en}.json` にキーで追加し `t()` で参照する（ja/en 両方）。

## 概要

介護老人保健施設（老健）の常勤医師向け電子カルテ「CareEMR」。回診を軸に、入所者管理・診療録・投薬・バイタル・プロブレムを扱う。医療記録の真正性（改ざん防止・監査）とセキュリティを重視。リポジトリ直下に `src/` を置く単一の React アプリ＋Firebase 構成。

## アーキテクチャ

- フロントエンド: React 19 + TypeScript + Vite + Tailwind CSS
- グラフ: Recharts（バイタル推移。lazy 読み込みでコード分割）
- 多言語: react-i18next（ja / en）
- 認証: Firebase Auth（Google サインイン、管理者カスタムクレーム）
- データベース: Cloud Firestore
- ホスティング: Firebase App Hosting

### データモデル（Firestore）
- `residents` — 入所者。サブコレクション `medications`（投薬）/ `vitals`（バイタル）/ `problems`（プロブレム）。
- `medicalRecords` — 診療録（`residentId` で紐付け）。編集前スナップショットは `revisions` サブコレクションに追記。
- `drugMaster` / `diseaseMaster` — 医薬品・病名（ICD-10）マスター（入力補完用）。
- 真正性: 記録は論理削除（`deletedAt` / `deletedBy`）。作成メタデータはルールで不変、診療録は物理削除禁止。各記録に作成者・更新者・削除者を保持。

### セキュリティ
- Google サインイン必須。管理者クレーム（`admin: true`）を持つユーザーのみアクセス可。新規登録は無効で、管理者がアカウントを発行。
- Firestore セキュリティルール（`firestore.rules`）で全アクセスを検証。投薬の collectionGroup 検索用に `match /{path=**}/medications/{id}` を許可。

## 開発コマンド（Node.js 22 / mise 推奨）

```bash
npm run dev            # 開発サーバー（Vite）
npm run build          # 型チェック＋本番ビルド
npm run lint           # ESLint
npm run emulators      # Firebase エミュレータ（Auth / Firestore、.emulator-data に永続化）
npm run seed:emulator  # エミュレータへサンプルデータ投入
```

管理者ユーザーの発行は `scripts/admin/`（`serviceAccountKey.json` が必要、git 管理外）。

## 重要ファイル
- `src/services/firestore.ts` — Firestore アクセス・検索・各サービス
- `src/components/SearchPanel.tsx` — 回診一覧（入口）と各モーダルの起動
- `src/components/*Manager.tsx` — 診療録 / 投薬 / バイタル / プロブレムの各モーダル
- `src/types/index.ts` — 型定義
- `src/i18n/` — 多言語リソースと設定
- `src/firebase.ts` — Firebase クライアント設定（エミュレータ接続を含む）
- `firestore.rules` — セキュリティルール

## Firebase プロジェクト
- プロジェクトID: `emr-system-dc60d`（本番）。ローカルはエミュレータで開発する。

## ドキュメント
- `docs/LOCAL_DEV.md` — ローカル開発環境
- `docs/REQUIREMENTS.md` — 要件とロードマップ
- `docs/DRUG_MASTER.md` / `docs/DISEASE_MASTER.md` — マスターデータの取り込み
- `docs/LOGGING_README.md` — ログ設計
