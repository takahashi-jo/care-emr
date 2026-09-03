# 医薬品マスター（薬剤名オートコンプリート）

薬剤名の入力候補は Firestore の `drugMaster` コレクションから供給される。
ローカル（Emulator）と本番は別データベースであり、それぞれに取り込みが必要。

- ローカル: `npm run seed:emulator` で見本90件が入る（開発用）。
- 全件（約1.8万剤）: 下記の公式マスターを `scripts/import-drug-master.mjs` で取り込む。

## 取得元（無料）

| マスター | 入手先 | 特徴 |
| --- | --- | --- |
| レセプト電算 医薬品マスター（支払基金） | https://www.ssk.or.jp/seikyushiharai/tensuhyo/kihonmasta/ | 販売名・カナ・レセ電コード・YJコード・薬価。ZIP→CSV |
| 医薬品HOTコードマスター（MEDIS） | https://www2.medis.or.jp/hcode/index.html | HOT/YJ/レセ電/販売名を横断。ZIP→CSV |

いずれも **Shift-JIS・ヘッダ無しの固定列CSV**（毎月更新）。

## 支払基金 医薬品マスター（`y_ALL*.csv`）の列マッピング

`Y` レコード（42列・約18,515行）。0始まりの列インデックス。

| 項目 | 列 | 例 |
| --- | --- | --- |
| レセ電コード | 2 | `610406079` |
| 販売名（医薬品名・漢字名称） | 4 | `ガスター散２％` |
| カナ名称（半角） | 6 | `ｶﾞｽﾀｰｻﾝ2%` |
| 個別医薬品コード（YJコード） | 31 | `2325003B2029` |

## 取り込み手順

前提: 別ターミナルで `npm run emulators` を起動しておく（ローカルの場合）。

```bash
# 1) 列を確認（書き込みなし）
node scripts/import-drug-master.mjs <csv> --inspect

# 2) 取り込み（支払基金 医薬品マスターの場合）
node scripts/import-drug-master.mjs <csv> --map name=4,kana=6,rezept=2,yj=31

# 本番へ取り込む場合（要 serviceAccountKey.json）
node scripts/import-drug-master.mjs <csv> --map name=4,kana=6,rezept=2,yj=31 --prod ./scripts/admin/serviceAccountKey.json
```

`drugMaster` の各ドキュメント: `{ name, kana, yjCode, hotCode, rezeptCode, createdAt }`。
薬剤名選択時に `yjCode` / `hotCode` が Medication に保持される（LIFE連携・レセプト・相互作用の基盤）。

## 注意

- Emulator のデータは再起動で消えるため、ローカルは都度取り込みが必要。
- 支払基金マスターの列は改定で変わりうるため、取り込み前に `--inspect` で確認する。
