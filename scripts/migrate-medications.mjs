/**
 * 旧 Resident.medications(string[]) を構造化 medications サブコレクションへ移行する一回限りのスクリプト。
 * 各薬剤名を name のみの Medication ドキュメントとして作成し、旧 medications フィールドを削除する。
 * 用量・用法・経路等は既定値/空（移行後に投薬管理から補完する想定）。
 *
 *   # ローカル（別ターミナルで npm run emulators を起動しておく）
 *   node scripts/migrate-medications.mjs --emulator
 *   # 本番（要 serviceAccountKey.json）
 *   node scripts/migrate-medications.mjs --prod ./scripts/admin/serviceAccountKey.json
 */
import fs from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const PROJECT_ID = 'emr-system-dc60d';

if (args.includes('--prod')) {
  const keyPath = args[args.indexOf('--prod') + 1];
  if (!keyPath) { console.error('--prod には serviceAccountKey.json のパスが必要です'); process.exit(1); }
  initializeApp({ credential: cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))), projectId: PROJECT_ID });
} else {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
  initializeApp({ projectId: PROJECT_ID });
}
const db = getFirestore();

async function main() {
  const snap = await db.collection('residents').get();
  let residents = 0;
  let meds = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (!('medications' in data)) continue; // 既に移行済み or フィールド無し
    const list = Array.isArray(data.medications) ? data.medications : [];
    const admission = data.admissionDate?.toDate ? data.admissionDate.toDate() : new Date();
    for (const name of list) {
      if (!name) continue;
      await doc.ref.collection('medications').add({
        name: String(name),
        dosage: '',
        frequency: '',
        route: '経口',
        type: '定期',
        startDate: Timestamp.fromDate(admission),
        endDate: null,
        notes: '（旧データ移行：用量・用法未設定）',
        yjCode: null,
        hotCode: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      meds++;
    }
    await doc.ref.update({ medications: FieldValue.delete() });
    residents++;
  }
  console.log(`✅ 移行完了: 入所者 ${residents} 名を処理 / 構造化投薬 ${meds} 件を作成、旧 medications フィールドを削除`);
  process.exit(0);
}

main().catch((e) => { console.error('❌ 移行失敗:', e); process.exit(1); });
