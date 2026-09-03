/**
 * Firebase Emulator 用シードスクリプト
 *
 * 実行前に別ターミナルで `npm run emulators` を起動しておくこと。
 * 本スクリプトは Emulator（Auth/Firestore）にのみ接続し、本番には接続しない。
 *
 *   npm run seed:emulator                 # 既定の管理者 dev@example.com を作成
 *   npm run seed:emulator you@example.com # 任意のメールで管理者を作成
 *
 * 実施内容:
 *   1. 管理者ユーザー（admin カスタムクレーム付き）を作成
 *   2. サンプル入所者・診療録を Firestore Emulator に投入
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// --- Emulator への接続を強制（本番を触らないための必須設定） ---
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';

const PROJECT_ID = 'emr-system-dc60d';
const ADMIN_EMAIL = process.argv[2] || 'dev@example.com';
const ADMIN_PASSWORD = 'password'; // Emulator 専用のダミー

const app = initializeApp({ projectId: PROJECT_ID });
const auth = getAuth(app);
const db = getFirestore(app);

// --- サンプルデータ生成用 ---
const surnames = ['田中', '佐藤', '鈴木', '高橋', '渡辺', '山本', '中村', '小林', '加藤', '吉田'];
const surnameKana = ['タナカ', 'サトウ', 'スズキ', 'タカハシ', 'ワタナベ', 'ヤマモト', 'ナカムラ', 'コバヤシ', 'カトウ', 'ヨシダ'];
const maleNames = [['太郎', 'タロウ'], ['一郎', 'イチロウ'], ['健一', 'ケンイチ'], ['明', 'アキラ'], ['博', 'ヒロシ']];
const femaleNames = [['花子', 'ハナコ'], ['よしこ', 'ヨシコ'], ['かずこ', 'カズコ'], ['みどり', 'ミドリ'], ['のりこ', 'ノリコ']];
const medications = ['アリセプト', 'メマリー', 'アムロジピン', 'メトホルミン', 'ワーファリン', 'フロセミド', 'ランソプラゾール'];
const histories = ['高血圧症', '糖尿病', '認知症', '心房細動', '脳梗塞', '骨粗鬆症', '慢性心不全'];
const notes = [
  '歩行時見守り必要。転倒リスクあり。',
  '食事摂取良好。水分摂取促し必要。',
  '夜間不穏あり。睡眠パターン観察継続。',
  '血圧変動あり。定期測定継続。',
  '服薬確認徹底。嚥下状態に注意。',
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const pickN = (a, n) => [...a].sort(() => 0.5 - Math.random()).slice(0, n);

function buildResident() {
  const si = Math.floor(Math.random() * surnames.length);
  const gender = Math.random() > 0.55 ? '女性' : '男性';
  const [given, givenKana] = gender === '男性' ? pick(maleNames) : pick(femaleNames);
  const birthYear = 1930 + Math.floor(Math.random() * 35);
  const admission = new Date(2021, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 27));
  return {
    name: `${surnames[si]} ${given}`,
    furigana: `${surnameKana[si]} ${givenKana}`,
    lastName: surnames[si],
    firstName: given,
    lastNameKana: surnameKana[si],
    firstNameKana: givenKana,
    gender,
    birthDate: Timestamp.fromDate(new Date(birthYear, 3, 15)),
    roomNumber: `${1 + Math.floor(Math.random() * 3)}0${(1 + Math.floor(Math.random() * 20)).toString().padStart(2, '0')}`,
    admissionDate: Timestamp.fromDate(admission),
    dischargeDate: null,
    medicalHistory: pickN(histories, 1 + Math.floor(Math.random() * 3)).join('、'),
    medications: pickN(medications, Math.floor(Math.random() * 4)),
    careLevel: 1 + Math.floor(Math.random() * 5),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

async function ensureAdminUser(email) {
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    user = await auth.createUser({
      email,
      password: ADMIN_PASSWORD,
      displayName: '開発管理者',
      emailVerified: true,
    });
  }
  await auth.setCustomUserClaims(user.uid, { admin: true });
  return user;
}

async function main() {
  const user = await ensureAdminUser(ADMIN_EMAIL);
  console.log(`✅ 管理者ユーザーを用意: ${ADMIN_EMAIL} (uid=${user.uid}) に admin クレーム付与`);
  console.log(`   ログイン用パスワード（Emulator内）: ${ADMIN_PASSWORD}`);

  const RESIDENT_COUNT = 15;
  let recordCount = 0;
  for (let i = 0; i < RESIDENT_COUNT; i++) {
    const resident = buildResident();
    const ref = await db.collection('residents').add(resident);
    const numRecords = 1 + Math.floor(Math.random() * 4);
    for (let j = 0; j < numRecords; j++) {
      await db.collection('medicalRecords').add({
        residentId: ref.id,
        date: Timestamp.fromDate(new Date(2024, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 27))),
        record: pick(notes),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      recordCount++;
    }
  }
  console.log(`✅ シード完了: 入所者 ${RESIDENT_COUNT} 名 / 診療録 ${recordCount} 件を投入`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ シード失敗:', err);
  console.error('   → 別ターミナルで `npm run emulators` が起動しているか確認してください。');
  process.exit(1);
});
