/**
 * 医薬品マスター インポートスクリプト
 *
 * 公式マスター（例: MEDIS 医薬品HOTコードマスター / レセプト電算処理システム 医薬品マスター）を
 * CSV に整形し、Firestore の drugMaster コレクションへ取り込む。
 * 取り込むと薬剤名オートコンプリートが全医薬品を網羅し、選択時に YJ/HOT コードを保持できる。
 *
 * 期待する CSV ヘッダ（下記いずれかの列名を自動認識）:
 *   name | 販売名 | 医薬品名
 *   kana | カナ
 *   yjCode | YJコード
 *   hotCode | HOTコード
 *
 * 使い方:
 *   # Emulator へ取り込み（別ターミナルで `npm run emulators` を起動しておく）
 *   node scripts/import-drug-master.mjs ./drugs.csv --emulator
 *   # 本番へ取り込み（scripts/admin/serviceAccountKey.json が必要）
 *   node scripts/import-drug-master.mjs ./drugs.csv --prod ./scripts/admin/serviceAccountKey.json
 */
import fs from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const [, , csvPath, mode = '--emulator', keyPath] = process.argv;
if (!csvPath) {
  console.error('使い方: node scripts/import-drug-master.mjs <csv> [--emulator | --prod <serviceAccountKey.json>]');
  process.exit(1);
}

const PROJECT_ID = 'emr-system-dc60d';

if (mode === '--prod') {
  if (!keyPath) {
    console.error('--prod には serviceAccountKey.json のパスが必要です');
    process.exit(1);
  }
  initializeApp({ credential: cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))), projectId: PROJECT_ID });
} else {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
  initializeApp({ projectId: PROJECT_ID });
}
const db = getFirestore();

// 簡易 CSV パーサ（クオート無しの単純CSV向け。複雑なCSVは csv パーサ導入を検討）
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row = {};
    header.forEach((h, i) => { row[h] = (cols[i] ?? '').trim(); });
    return row;
  });
}

const pickName = (r) => r.name || r['販売名'] || r['医薬品名'];
const pickKana = (r) => r.kana || r['カナ'] || '';
const pickYj = (r) => r.yjCode || r['YJコード'] || '';
const pickHot = (r) => r.hotCode || r['HOTコード'] || '';

async function main() {
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  console.log(`CSV 読み込み: ${rows.length} 行 (${mode})`);

  let batch = db.batch();
  let inBatch = 0;
  let total = 0;
  for (const row of rows) {
    const name = pickName(row);
    if (!name) continue;
    const ref = db.collection('drugMaster').doc();
    batch.set(ref, {
      name,
      kana: pickKana(row) || null,
      yjCode: pickYj(row) || null,
      hotCode: pickHot(row) || null,
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
