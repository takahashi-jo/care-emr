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

MEDIS 標準病名マスターの本体は `main/nmain518.txt`（病名基本テーブル。**カンマ区切り・Shift-JIS・ヘッダ無し**）。
列レイアウトは `option/ttl_main.txt` に記載。実績（V5.18・27,877件）の列マッピングは次の通り:

- `[2]` 病名表記 → `name`
- `[3]` 病名表記カナ → `kana`
- `[6]` ICD10‑2013 → `icd10`（ドット無し表記。例: E250 = E25.0）

```bash
# 1) 列を確認
mise exec node@22 -- node scripts/import-disease-master.mjs ./main/nmain518.txt --inspect

# 2) 取り込み（実績のマッピング）
mise exec node@22 -- node scripts/import-disease-master.mjs ./main/nmain518.txt --map name=2,kana=3,icd10=6

# 動作確認は --limit 100 で少量から。本番は --prod ./scripts/admin/serviceAccountKey.json
# 置換取り込み時は既存 diseaseMaster を先にクリアする（重複防止）。
```

## 開発（Emulator）用サンプル

`scripts/seed-emulator.mjs` が老健で頻用する **33件**（高血圧症 I10、2型糖尿病 E11 など）を
`diseaseMaster` に投入する。実運用では上記 MEDIS マスターの全件取り込みに置き換える。

## メモ
- ICD-10 は施設・保険請求で使う標準コード。病名を構造化しておくと検索・統計・将来の LIFE 連携に効く。
- Firestore セキュリティルールで `diseaseMaster` は管理者のみ read/write。
