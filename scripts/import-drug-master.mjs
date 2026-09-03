/**
 * 医薬品マスター インポートスクリプト
 *
 * 公式マスターを Firestore の drugMaster コレクションへ取り込み、薬剤名オートコンプリートを
 * 全医薬品に拡張する。取り込むと選択時に YJ/HOT/レセ電コードを保持できる。
 *
 * 取得元（無料・いずれも Shift-JIS・ヘッダ無しの固定列CSV）:
 *   - 医薬品HOTコードマスター（MEDIS）  https://www2.medis.or.jp/hcode/index.html
 *   - レセプト電算 医薬品マスター（支払基金）https://www.ssk.or.jp/seikyushiharai/tensuhyo/kihonmasta/
 *
 * 使い方（列は実ファイルを見てからマッピングする）:
 *   1) 列を確認:   node scripts/import-drug-master.mjs ./y.csv --inspect
 *   2) 取り込み:   node scripts/import-drug-master.mjs ./y.csv --map name=3,kana=5,rezept=2,yj=31
 *        （--map の番号は 0 始まりの列インデックス。name は必須、他は任意）
 *
 * オプション:
 *   --emulator            (既定) ローカル Emulator へ取り込み
 *   --prod <keyPath>      本番へ取り込み（serviceAccountKey.json のパス）
 *   --sjis | --utf8       文字コード（既定 --sjis：公式マスターは Shift-JIS）
 *   --inspect             先頭数行を列インデックス付きで表示して終了
 *   --map k=idx,...       列マッピング（name/kana/yj/hot/rezept）
 *   --limit N             先頭N行だけ取り込む（動作確認用）
 */
import fs from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const csvPath = args.find((a) => !a.startsWith('--') && !isKeyPath(a));
const has = (f) => args.includes(f);
const valOf = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
function isKeyPath(a) {
  // --prod の直後の引数（鍵ファイル）は csv 扱いしない
  const i = args.indexOf('--prod');
  return i >= 0 && args[i + 1] === a;
}

if (!csvPath) {
  console.error('使い方: node scripts/import-drug-master.mjs <csv> [--inspect | --map name=..,kana=..,yj=..,rezept=..] [--prod <key>] [--utf8]');
  process.exit(1);
}

const encoding = has('--utf8') ? 'utf-8' : 'shift_jis';
const raw = fs.readFileSync(csvPath);
const text = new TextDecoder(encoding).decode(raw);
const rows = text
  .split(/\r?\n/)
  .filter((l) => l.trim().length > 0)
  .map((l) => l.split(',').map((c) => c.replace(/^"|"$/g, '').trim()));

// --- 列プレビュー ---
if (has('--inspect')) {
  console.log(`エンコーディング: ${encoding} / 行数: ${rows.length} / 列数(先頭行): ${rows[0]?.length}`);
  rows.slice(0, 3).forEach((r, ri) => {
    console.log(`\n--- row ${ri} ---`);
    r.forEach((c, ci) => console.log(`  [${ci}] ${c}`));
  });
  console.log('\n↑ 販売名/カナ/レセ電コード/YJコード が何番目([n])かを確認し、--map name=n,kana=n,rezept=n,yj=n を指定して再実行してください。');
  process.exit(0);
}

// --- 列マッピング ---
const mapStr = valOf('--map');
if (!mapStr) {
  console.error('列マッピングが必要です。まず --inspect で列を確認し、--map name=..,kana=..,rezept=..,yj=.. を指定してください。');
  process.exit(1);
}
const COLS = {};
for (const pair of mapStr.split(',')) {
  const [k, v] = pair.split('=');
  COLS[k.trim()] = Number(v);
}
if (COLS.name === undefined || Number.isNaN(COLS.name)) {
  console.error('--map に少なくとも name=<列番号> が必要です。');
  process.exit(1);
}
const limit = valOf('--limit') ? Number(valOf('--limit')) : Infinity;

// --- Firestore 初期化 ---
const PROJECT_ID = 'emr-system-dc60d';
if (has('--prod')) {
  const keyPath = valOf('--prod');
  if (!keyPath) { console.error('--prod には serviceAccountKey.json のパスが必要です'); process.exit(1); }
  initializeApp({ credential: cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))), projectId: PROJECT_ID });
} else {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
  initializeApp({ projectId: PROJECT_ID });
}
const db = getFirestore();

const at = (row, key) => (COLS[key] !== undefined ? (row[COLS[key]] || '') : '');

async function main() {
  console.log(`取り込み開始: ${csvPath} / ${has('--prod') ? '本番' : 'Emulator'} / マッピング ${JSON.stringify(COLS)}`);
  let batch = db.batch();
  let inBatch = 0;
  let total = 0;
  for (const row of rows) {
    if (total >= limit) break;
    const name = at(row, 'name');
    if (!name) continue;
    const ref = db.collection('drugMaster').doc();
    batch.set(ref, {
      name,
      kana: at(row, 'kana') || null,
      yjCode: at(row, 'yj') || null,
      hotCode: at(row, 'hot') || null,
      rezeptCode: at(row, 'rezept') || null,
      createdAt: Timestamp.now(),
    });
    inBatch++;
    total++;
    if (inBatch >= 450) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
      process.stdout.write(`\r取り込み中: ${total} 件`);
    }
  }
  if (inBatch > 0) await batch.commit();
  console.log(`\n✅ drugMaster に ${total} 件を取り込みました`);
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ 取り込み失敗:', e);
  process.exit(1);
});
