# CareEMR

介護老人保健施設（老健）の常勤医師向けに設計した電子カルテです。回診を軸に、入所者の状態把握・診療録・投薬・バイタル・問題管理を最短の操作で回せることを目的としています。医療記録を扱うため、真正性（改ざん防止・監査）とセキュリティを重視しています。

[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%7C%20Auth%20%7C%20App%20Hosting-orange.svg)](https://firebase.google.com/)
[![Vite](https://img.shields.io/badge/Vite-7-purple.svg)](https://vite.dev/)

## 特長

- 回診ビュー: 全入所者を部屋順で一覧し、氏名の読み・性別・年齢・要介護度・継続中の薬剤を一目で把握。氏名／部屋番号／要介護度／継続薬で絞り込み。
- 入所者管理: 基本情報・要介護度・アレルギー（あり／なし／未確認）・既往歴。作成者・更新者と日時を記録し、削除は一覧から隠す論理削除。
- 診療録: 日次の経過記録。編集時は編集前の内容を訂正履歴として保持し、物理削除は不可（監査対応）。
- 投薬: 用法・用量・経路・種別を構造化。医薬品マスター（約1.8万剤、YJ／HOTコード）からの入力補完。継続・中止で処方の変遷を保持。
- バイタル: 体温・血圧・脈拍・SpO₂・体重・血糖を時系列で記録。項目別の推移グラフに参考基準の閾値線と異常値の強調を表示。
- プロブレムリスト（POMR）: 問題を番号付きで管理。ICD-10 対応の標準病名マスターから病名を選択し、現行・消失で経過を保持。
- 認証: Google サインイン＋管理者カスタムクレーム。登録制で、管理者がアカウントを発行する。
- 多言語: 日本語／英語（画面右上で切替）。
- タブレット対応: 回診時の iPad 等での利用を想定したレスポンシブ設計。

## 技術スタック

- フロントエンド: React 19 / TypeScript / Vite / Tailwind CSS
- グラフ: Recharts
- 多言語: react-i18next
- 日付処理: Day.js（日本語ロケール）
- バックエンド: Firebase（Cloud Firestore / Authentication / App Hosting）

## データモデル（Firestore）

- `residents` — 入所者。サブコレクションに `medications`（投薬）・`vitals`（バイタル）・`problems`（プロブレム）。
- `medicalRecords` — 診療録（`residentId` で入所者に紐付け）。編集前スナップショットは `revisions` サブコレクションに追記。
- `drugMaster` / `diseaseMaster` — 医薬品・病名マスター（入力補完用）。
- 真正性: 記録は論理削除（`deletedAt` / `deletedBy`）。作成メタデータはセキュリティルールで不変とし、診療録は物理削除を禁止。作成者・更新者・削除者を各記録に保持する。

## セットアップ（ローカル開発）

前提: Node.js 22、Firebase CLI。

```bash
# 依存関係のインストール
npm install

# Auth / Firestore エミュレータを起動（データは .emulator-data に保存）
npm run emulators

# 別ターミナルでサンプルデータ（入所者・診療録・投薬・バイタル・プロブレム）を投入
npm run seed:emulator

# 開発サーバー
npm run dev
```

エミュレータ接続やアクセス方法の詳細は [docs/LOCAL_DEV.md](docs/LOCAL_DEV.md) を参照。
マスターデータの取り込みは [docs/DRUG_MASTER.md](docs/DRUG_MASTER.md)（医薬品）・[docs/DISEASE_MASTER.md](docs/DISEASE_MASTER.md)（病名）を参照。

## 主なコマンド

```bash
npm run dev            # 開発サーバー
npm run build          # 型チェック＋本番ビルド
npm run lint           # ESLint
npm run emulators      # Firebase エミュレータ（Auth / Firestore）
npm run seed:emulator  # エミュレータへサンプルデータ投入
```

管理者ユーザーの発行は [scripts/admin/README.md](scripts/admin/README.md) を参照。

## プロジェクト構成

```
src/
  components/        画面・モーダル（common/ に共通部品）
  services/          Firestore アクセス層
  i18n/              多言語リソース（locales/{ja,en}.json）
  hooks/  contexts/  認証・アプリ状態
  constants/         バイタル参考基準など
scripts/             エミュレータ用シード・マスター取り込み・管理者スクリプト
docs/                開発・データ・要件のドキュメント
firestore.rules      Firestore セキュリティルール
```

## セキュリティと真正性

- Google サインイン必須。管理者カスタムクレーム（`admin: true`）を持つユーザーのみアクセスできる。新規登録は無効で、管理者がアカウントを発行する。
- Firestore セキュリティルールで全アクセスを検証。診療録は物理削除を禁止し、作成メタデータは不変。記録は論理削除で保持し、削除者と日時を残す。

## ドキュメント

- [docs/LOCAL_DEV.md](docs/LOCAL_DEV.md) — ローカル開発環境
- [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) — 要件とロードマップ
- [docs/DRUG_MASTER.md](docs/DRUG_MASTER.md) / [docs/DISEASE_MASTER.md](docs/DISEASE_MASTER.md) — マスターデータの取り込み
- [docs/LOGGING_README.md](docs/LOGGING_README.md) — ログ設計

## ライセンス

© 2026 Jo Takahashi. 無断転載・再配布を禁じます。
