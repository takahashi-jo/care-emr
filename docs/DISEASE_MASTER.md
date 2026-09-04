# 病名マスター（diseaseMaster）

プロブレムリストの「問題名（病名）」入力を、ICD-10 対応の**標準病名マスター**からの
オートコンプリートにするための参照データ。薬剤マスター（[DRUG_MASTER.md](./DRUG_MASTER.md)）と同じ考え方。

- Firestore コレクション: `diseaseMaster`
- 1件のスキーマ: `{ name: 病名, kana?: 読み, icd10?: ICD-10コード }`
- 検索: 病名の前方一致（`diseaseMasterService.search`）。選択時に ICD-10 を Problem に保持。

## 取得元（公式・無料）

**MEDIS 標準病名マスター（ICD-10 対応電子カルテ用病名マスター）**
- <https://www2.medis.or.jp/stdcd/byomei/index.html>
- 利用登録・規約同意のうえダウンロード（Shift-JIS）。「病名基本テーブル(nmain*.txt)」等を使用。
- 区切り（CSV/タブ）や列位置は版によって異なるため、必ず `--inspect` で確認してからマッピングする。

## 取り込み手順

```bash
# 1) 列を確認（区切りがタブなら --tab を付ける）
mise exec node@22 -- node scripts/import-disease-master.mjs ./nmain.txt --inspect --tab

# 2) 病名表記/カナ/ICD-10 の列番号を確認して取り込み（例）
mise exec node@22 -- node scripts/import-disease-master.mjs ./nmain.txt --tab --map name=3,kana=4,icd10=5

# 動作確認は --limit 100 を付けて少量から
# 本番へ入れる場合は --prod ./scripts/admin/serviceAccountKey.json
```

## 開発（Emulator）用サンプル

`scripts/seed-emulator.mjs` が老健で頻用する **33件**（高血圧症 I10、2型糖尿病 E11 など）を
`diseaseMaster` に投入する。実運用では上記 MEDIS マスターの全件取り込みに置き換える。

## メモ
- ICD-10 は施設・保険請求で使う標準コード。病名を構造化しておくと検索・統計・将来の LIFE 連携に効く。
- Firestore セキュリティルールで `diseaseMaster` は管理者のみ read/write。
