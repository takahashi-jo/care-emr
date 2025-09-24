# Firebase Admin SDK セットアップ手順

## 1. サービスアカウントキーの取得

1. **Firebase Console**に移動: https://console.firebase.google.com/
2. プロジェクト「emr-system-dc60d」を選択
3. **プロジェクトの設定**（歯車アイコン）をクリック
4. **サービスアカウント**タブを選択
5. **Firebase Admin SDK** セクションで「新しい秘密鍵の生成」をクリック
6. ダウンロードした JSON ファイルを `serviceAccountKey.json` としてこのディレクトリに保存

## 2. 依存関係のインストール

```bash
cd admin-setup
npm install
```

## 3. ユーザーの作成とadminクレーム設定

### 新規ユーザーを作成してadminクレームを設定
```bash
npm run create-user admin@example.com "管理者名"
```

### 既存ユーザーにadminクレームを設定
```bash
npm run set-admin admin@example.com
```

## 4. Firebase Authentication設定の変更

1. **Firebase Console** → **Authentication** → **Settings**
2. **User actions** セクション
3. **「作成（登録）を許可する」のチェックを外す**
4. **「メール列挙保護」を有効にする（推奨）**

## 注意事項

- `serviceAccountKey.json` は絶対にGitにコミットしないこと
- このファイルは機密情報なので安全に管理すること
- 使用後は適切に削除または安全な場所に移動すること

## セキュリティ

このスクリプトを使用することで：
- 任意のGoogleアカウントでの自動登録を防止
- 管理者が明示的に許可したユーザーのみアクセス可能
- Firestoreへのアクセスもadminクレームでコントロール