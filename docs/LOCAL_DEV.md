# ローカル開発ガイド

本番の Firestore に触れずに、ローカルの Firebase Emulator 上で開発するための手順。

## 前提ツール

| ツール | 用途 |
| --- | --- |
| Node.js 20 以上 | アプリのビルド・実行 |
| Java 11 以上 | Firestore Emulator の実行 |
| Firebase CLI | Emulator の起動（`firebase-tools`、devDependency に含む） |

## 初回セットアップ

```bash
npm install
```

`.env.development` は Emulator 接続用に設定済み（`VITE_USE_EMULATOR=true`）。
このファイルは `.gitignore` 済みで、本番の認証情報は含まない。

## 毎回の起動手順（ターミナル2つ）

**ターミナル1 — Emulator を起動**

```bash
npm run emulators
```

- Auth Emulator: `localhost:9099`
- Firestore Emulator: `localhost:8080`
- Emulator UI: http://localhost:4000

**ターミナル2 — サンプルデータ投入 → 開発サーバー起動**

```bash
npm run seed:emulator   # 管理者ユーザー + 入所者/診療録を投入
npm run dev             # http://localhost:5173
```

`npm run seed:emulator` は次を行う。

- 管理者ユーザー `dev@example.com`（`admin` クレーム付き）を作成
- サンプル入所者 15 名と診療録を Firestore Emulator に投入

別のメールで管理者を作る場合: `npm run seed:emulator you@example.com`

## ログイン

1. http://localhost:5173 を開く
2. Google サインインのポップアップで **`dev@example.com`** を入力してサインイン
3. `admin` クレームが付与されているため、そのまま利用できる

`admin` クレームが反映されない場合は、Emulator UI（http://localhost:4000）→ Authentication →
対象ユーザー → Custom Claims に `{"admin": true}` を設定し、アプリを再読み込みする。

## データの扱い

- Emulator のデータはプロセス終了で消える（毎回 `npm run seed:emulator` で再投入）
- `src/firebase.ts` は `VITE_USE_EMULATOR=true` のときだけ Emulator に接続する
- `npm run build`（本番ビルド）は `.env.development` を読まないため Emulator 接続は無効

## 本番 Firestore に接続する場合

本番接続は通常のローカル開発では不要。接続する場合のみ:

1. `.env.development` の `VITE_USE_EMULATOR` を `false` にする
2. Firebase Console（プロジェクト `emr-system-dc60d`）の実際の設定値を `VITE_FIREBASE_*` に入れる

## ポート一覧

| ポート | サービス |
| --- | --- |
| 5173 | Vite 開発サーバー |
| 4000 | Firebase Emulator UI |
| 8080 | Firestore Emulator |
| 9099 | Auth Emulator |
