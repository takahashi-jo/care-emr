/**
 * Firebase Emulator 用シードスクリプト
 *
 * 実行前に別ターミナルで `npm run emulators` を起動しておくこと。
 * 本スクリプトは Emulator（Auth/Firestore）にのみ接続し、本番には接続しない。
 *
 *   npm run seed:emulator                 # 既定の管理者 dev@example.com を作成
 *   npm run seed:emulator you@example.com # 任意のメールで管理者を作成
 *
 * 実施内容（冪等。実行のたびに同じ状態へ揃える）:
 *   1. 管理者ユーザー（admin カスタムクレーム付き）を作成
 *   2. 既存のサンプルデータ（入所者・診療録とそのサブコレクション）を全削除
 *   3. サンプル入所者と各記録（診療録・投薬・バイタル・プロブレム・検査・予防接種）を投入
 *   4. 医薬品／病名マスターは空のときのみ投入（フル取り込み済みなら保持）
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
const SEED_AUTHOR = { uid: 'seed', name: 'dev@example.com' };
function buildAllergy() {
  const r = Math.random();
  if (r < 0.25) return { allergyStatus: 'あり', allergies: pick(['ペニシリン', 'そば', '卵', 'ヨード']) };
  if (r < 0.9) return { allergyStatus: 'なし', allergies: '' };
  return { allergyStatus: '未確認', allergies: '' };
}

const MED_PRESETS = [
  { name: 'アムロジピン錠5mg', dosage: '1錠', frequency: '1日1回 朝食後', route: '経口', type: '定期' },
  { name: 'アリセプト錠5mg', dosage: '1錠', frequency: '1日1回 朝食後', route: '経口', type: '定期' },
  { name: 'マグミット錠330mg', dosage: '1錠', frequency: '1日3回 毎食後', route: '経口', type: '定期' },
  { name: 'ランソプラゾールOD錠15mg', dosage: '1錠', frequency: '1日1回 朝食後', route: '経口', type: '定期' },
  { name: 'メトホルミン錠250mg', dosage: '1錠', frequency: '1日2回 朝夕食後', route: '経口', type: '定期' },
  { name: 'ロキソプロフェン錠60mg', dosage: '1錠', frequency: '疼痛時', route: '経口', type: '頓用', notes: '疼痛時、1日3回まで' },
  { name: 'アセトアミノフェン錠200mg', dosage: '2錠', frequency: '発熱時', route: '経口', type: '頓用', notes: '38.5℃以上で使用' },
  { name: 'モーラステープ', dosage: '1枚', frequency: '1日1回', route: '貼付', type: '定期' },
  { name: 'ブロチゾラム錠0.25mg', dosage: '1錠', frequency: '不眠時', route: '経口', type: '頓用', notes: '就寝前に使用' },
];

// 医薬品マスターのサンプル（老健で頻用する薬剤名。本番は公式マスターを import-drug-master.mjs で取り込む）
const DRUG_MASTER_NAMES = [
  'アリセプト錠3mg', 'アリセプト錠5mg', 'アリセプトD錠10mg', 'ドネペジル塩酸塩錠5mg',
  'メマリー錠10mg', 'メマリー錠20mg', 'レミニール錠8mg', 'リバスタッチパッチ18mg', 'イクセロンパッチ18mg',
  'アムロジピン錠2.5mg', 'アムロジピン錠5mg', 'ニフェジピンCR錠20mg',
  'アジルバ錠20mg', 'オルメサルタンOD錠20mg', 'カンデサルタン錠8mg', 'テルミサルタン錠40mg',
  'エナラプリル錠5mg', 'ビソプロロールフマル酸塩錠2.5mg', 'カルベジロール錠10mg', 'ニコランジル錠5mg',
  'フロセミド錠20mg', 'アゾセミド錠30mg', 'スピロノラクトン錠25mg', 'トラセミド錠4mg',
  'ワーファリン錠1mg', 'エリキュース錠5mg', 'リクシアナOD錠30mg', 'イグザレルト錠15mg',
  'バイアスピリン錠100mg', 'クロピドグレル錠75mg', 'ジゴキシン錠0.125mg',
  'メトホルミン錠250mg', 'メトホルミン錠500mg', 'ジャヌビア錠50mg', 'トラゼンタ錠5mg',
  'グリメピリド錠1mg', 'フォシーガ錠10mg', 'ボグリボースOD錠0.3mg',
  'アトルバスタチン錠10mg', 'ロスバスタチンOD錠2.5mg', 'ピタバスタチン錠2mg', 'エゼチミブ錠10mg',
  'ランソプラゾールOD錠15mg', 'ランソプラゾールOD錠30mg', 'オメプラゾール錠20mg', 'タケキャブ錠20mg',
  'レバミピド錠100mg', 'モサプリドクエン酸塩錠5mg', 'マグミット錠330mg', '酸化マグネシウム錠500mg',
  'センノシド錠12mg', 'ラキソベロン内用液', 'ビオフェルミン配合散', 'ミヤBM錠',
  'ブロチゾラム錠0.25mg', 'ゾルピデム酒石酸塩錠5mg', 'エチゾラム錠0.5mg', 'デエビゴ錠5mg', 'ベルソムラ錠15mg',
  'リスペリドンOD錠1mg', 'クエチアピン錠25mg', 'ミルタザピン錠15mg', 'エスシタロプラム錠10mg', '抑肝散エキス顆粒',
  'アセトアミノフェン錠200mg', 'カロナール錠500mg', 'ロキソプロフェン錠60mg', 'セレコキシブ錠100mg', 'トラマドール錠25mg',
  'アルファカルシドールカプセル0.5μg', 'エディロールカプセル0.75μg', 'アレンドロン酸錠35mg', 'ミノドロン酸錠50mg',
  'カルボシステイン錠500mg', 'アンブロキソール錠15mg', 'テオフィリン徐放錠200mg', 'モンテルカスト錠10mg', 'スピリーバレスピマット',
  'メネシット配合錠100', 'プラミペキソールOD錠0.125mg',
  'レボフロキサシン錠500mg', 'セフカペンピボキシル錠100mg', 'アモキシシリンカプセル250mg', 'クラリスロマイシン錠200mg',
  'モーラステープ20mg', 'ロキソニンテープ100mg', 'ヒルドイドソフト軟膏0.3%', '白色ワセリン', 'アズノール軟膏0.033%', 'リンデロンVG軟膏',
];

// 経路から代表的な剤形をあてる（サンプル用の近似）
const FORM_BY_ROUTE = { '経口': '錠剤', '外用': '軟膏・クリーム', '貼付': '貼付剤', '注射': '注射剤', 'その他': 'その他' };

function buildMedications(admissionDate) {
  const chosen = pickN(MED_PRESETS, Math.floor(Math.random() * 4)); // 0〜3件
  return chosen.map((m, idx) => {
    const start = new Date(admissionDate);
    start.setDate(start.getDate() + idx * 5);
    // 定期薬の一部は「中止済み」にして処方の変遷を表現
    const stopped = m.type === '定期' && Math.random() < 0.25;
    const end = stopped ? new Date(start.getTime() + 60 * 24 * 3600 * 1000) : null;
    return {
      name: m.name,
      dosageForm: FORM_BY_ROUTE[m.route] || '錠剤',
      dosage: m.dosage,
      frequency: m.frequency,
      daysSupply: m.type === '定期' ? pick([14, 28, 30, 30, 90]) : null,
      route: m.route,
      type: m.type,
      prescriber: '山田 一郎',
      startDate: Timestamp.fromDate(start),
      endDate: end ? Timestamp.fromDate(end) : null,
      notes: m.notes || '',
      createdBy: SEED_AUTHOR,
      updatedBy: SEED_AUTHOR,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
  });
}

function buildVitals() {
  const count = 4 + Math.floor(Math.random() * 8); // 4〜11回
  const baseWeight = 42 + Math.random() * 28;      // 入所者ごとの基準体重
  const round1 = (n) => Math.round(n * 10) / 10;
  const out = [];
  for (let k = 0; k < count; k++) {
    // 直近から数日おきに測定
    const measured = new Date();
    measured.setDate(measured.getDate() - k * 3 - Math.floor(Math.random() * 2));
    measured.setHours(8 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60), 0, 0);
    out.push({
      measuredAt: Timestamp.fromDate(measured),
      temperature: round1(36.2 + Math.random() * 1.6),          // 36.2〜37.8（時々発熱）
      systolicBP: 105 + Math.floor(Math.random() * 45),         // 105〜149
      diastolicBP: 60 + Math.floor(Math.random() * 35),         // 60〜94
      pulse: 58 + Math.floor(Math.random() * 40),               // 58〜97
      respiratoryRate: 14 + Math.floor(Math.random() * 12),     // 14〜25（時々頻呼吸）
      spo2: 92 + Math.floor(Math.random() * 8),                 // 92〜99（時々低め）
      weight: round1(baseWeight + (Math.random() * 2 - 1)),     // 基準±1kg
      bloodGlucose: Math.random() < 0.4 ? 90 + Math.floor(Math.random() * 90) : null, // 一部のみ測定
      consciousness: Math.random() < 0.7 ? '清明' : pick(['I-1', 'I-2', 'II-10']), // 多くは清明
      notes: '',
      createdBy: SEED_AUTHOR,
      updatedBy: SEED_AUTHOR,
      deletedAt: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
  return out;
}

// 病名マスターのサンプル（老健で頻用。本番は MEDIS 標準病名マスターを取り込む想定）
const DISEASE_MASTER = [
  { name: '高血圧症', icd10: 'I10' }, { name: '2型糖尿病', icd10: 'E11' }, { name: '脂質異常症', icd10: 'E78.5' },
  { name: 'アルツハイマー型認知症', icd10: 'G30' }, { name: '血管性認知症', icd10: 'F01' }, { name: '認知症', icd10: 'F03' },
  { name: '脳梗塞', icd10: 'I63' }, { name: '脳梗塞後遺症', icd10: 'I69.3' }, { name: '心房細動', icd10: 'I48' },
  { name: '慢性心不全', icd10: 'I50.0' }, { name: '狭心症', icd10: 'I20' }, { name: '骨粗鬆症', icd10: 'M81' },
  { name: '変形性膝関節症', icd10: 'M17' }, { name: '変形性腰椎症', icd10: 'M47' }, { name: '誤嚥性肺炎', icd10: 'J69.0' },
  { name: '慢性閉塞性肺疾患', icd10: 'J44' }, { name: '気管支喘息', icd10: 'J45' }, { name: '逆流性食道炎', icd10: 'K21.0' },
  { name: '便秘症', icd10: 'K59.0' }, { name: '慢性腎臓病', icd10: 'N18' }, { name: '前立腺肥大症', icd10: 'N40' },
  { name: '過活動膀胱', icd10: 'N32.8' }, { name: '尿路感染症', icd10: 'N39.0' }, { name: '白内障', icd10: 'H25' },
  { name: '甲状腺機能低下症', icd10: 'E03.9' }, { name: 'パーキンソン病', icd10: 'G20' }, { name: 'うつ病', icd10: 'F32' },
  { name: '不眠症', icd10: 'G47.0' }, { name: '鉄欠乏性貧血', icd10: 'D50' }, { name: '褥瘡', icd10: 'L89' },
  { name: '関節リウマチ', icd10: 'M06' }, { name: '胃潰瘍', icd10: 'K25' }, { name: '嚥下障害', icd10: 'R13' },
];

function buildProblems() {
  const chosen = pickN(DISEASE_MASTER, 2 + Math.floor(Math.random() * 3)); // 2〜4件
  return chosen.map((d, idx) => {
    const onset = new Date(2018 + Math.floor(Math.random() * 6), Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 27));
    const resolved = Math.random() < 0.2; // 一部は消失にして変遷を表現
    const resolvedDate = resolved ? new Date(onset.getTime() + (200 + Math.floor(Math.random() * 400)) * 24 * 3600 * 1000) : null;
    return {
      number: idx + 1,
      title: d.name,
      icd10: d.icd10 || null,
      status: resolved ? '消失' : '現行',
      onsetDate: Timestamp.fromDate(onset),
      resolvedDate: resolvedDate ? Timestamp.fromDate(resolvedDate) : null,
      notes: '',
      createdBy: SEED_AUTHOR,
      updatedBy: SEED_AUTHOR,
      deletedAt: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
  });
}

// 検査項目（老健で頻用の一部）。lo/hi は生成範囲（基準値をやや外れる値も出す）、d は小数桁。
const SEED_LAB = [
  { code: 'WBC', name: '白血球数 (WBC)', unit: '×10³/µL', refLow: 3.3, refHigh: 8.6, lo: 3.0, hi: 11.0, d: 1 },
  { code: 'Hb', name: 'ヘモグロビン (Hb)', unit: 'g/dL', refLow: 11.6, refHigh: 16.8, lo: 9.5, hi: 16.0, d: 1 },
  { code: 'Plt', name: '血小板数 (Plt)', unit: '×10⁴/µL', refLow: 15.8, refHigh: 34.8, lo: 14, hi: 35, d: 1 },
  { code: 'Alb', name: 'アルブミン (Alb)', unit: 'g/dL', refLow: 4.1, refHigh: 5.1, lo: 3.2, hi: 5.0, d: 1 },
  { code: 'AST', name: 'AST', unit: 'U/L', refLow: 13, refHigh: 30, lo: 14, hi: 55, d: 0 },
  { code: 'ALT', name: 'ALT', unit: 'U/L', refLow: 10, refHigh: 42, lo: 10, hi: 60, d: 0 },
  { code: 'BUN', name: '尿素窒素 (BUN)', unit: 'mg/dL', refLow: 8, refHigh: 20, lo: 9, hi: 30, d: 0 },
  { code: 'Cr', name: 'クレアチニン (Cr)', unit: 'mg/dL', refLow: 0.46, refHigh: 1.07, lo: 0.5, hi: 1.6, d: 2 },
  { code: 'eGFR', name: 'eGFR', unit: 'mL/min/1.73m²', refLow: 60, refHigh: null, lo: 35, hi: 90, d: 0 },
  { code: 'Na', name: 'ナトリウム (Na)', unit: 'mEq/L', refLow: 138, refHigh: 145, lo: 135, hi: 146, d: 0 },
  { code: 'K', name: 'カリウム (K)', unit: 'mEq/L', refLow: 3.6, refHigh: 4.8, lo: 3.4, hi: 5.2, d: 1 },
  { code: 'CRP', name: 'CRP', unit: 'mg/dL', refLow: null, refHigh: 0.14, lo: 0.02, hi: 2.5, d: 2 },
  { code: 'Glu', name: '血糖 (Glu)', unit: 'mg/dL', refLow: 73, refHigh: 109, lo: 80, hi: 180, d: 0 },
  { code: 'HbA1c', name: 'HbA1c', unit: '%', refLow: 4.9, refHigh: 6.0, lo: 5.2, hi: 8.0, d: 1 },
  { code: 'LDL', name: 'LDLコレステロール', unit: 'mg/dL', refLow: null, refHigh: 139, lo: 70, hi: 170, d: 0 },
  { code: 'HDL', name: 'HDLコレステロール', unit: 'mg/dL', refLow: 40, refHigh: null, lo: 35, hi: 80, d: 0 },
  { code: 'TG', name: '中性脂肪 (TG)', unit: 'mg/dL', refLow: 30, refHigh: 149, lo: 50, hi: 220, d: 0 },
];

function buildLabResults() {
  const count = 1 + Math.floor(Math.random() * 3); // 1〜3回
  const out = [];
  for (let k = 0; k < count; k++) {
    const collected = new Date();
    collected.setDate(collected.getDate() - k * 90 - Math.floor(Math.random() * 20)); // 約3ヶ月おき
    collected.setHours(9, Math.floor(Math.random() * 30), 0, 0);
    const items = SEED_LAB.map((a) => {
      const p = Math.pow(10, a.d);
      const value = Math.round((a.lo + Math.random() * (a.hi - a.lo)) * p) / p;
      return { code: a.code, name: a.name, value, unit: a.unit, refLow: a.refLow ?? null, refHigh: a.refHigh ?? null };
    });
    out.push({
      collectedAt: Timestamp.fromDate(collected),
      items,
      notes: '',
      createdBy: SEED_AUTHOR,
      updatedBy: SEED_AUTHOR,
      deletedAt: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
  return out;
}

// 予防接種のサンプル。予防接種台帳の記録事項（種類・接種日・製造番号・製造販売業者・接種者）に沿う。
const VACCINE_SEED = [
  { vaccine: 'インフルエンザ', makers: ['第一三共', 'デンカ', '阪大微生物病研究会'], dose: '1回目', monthsAgo: 2 },
  { vaccine: '新型コロナ', makers: ['ファイザー', 'モデルナ'], dose: '追加接種', monthsAgo: 8 },
  { vaccine: '肺炎球菌（PPSV23）', makers: ['MSD'], dose: '1回目', monthsAgo: 18 },
];

function buildImmunizations() {
  const lot = () => 'ABCDEFGHJKLMN'[Math.floor(Math.random() * 13)] + (1000 + Math.floor(Math.random() * 9000));
  // インフルは全員、他は一部の入所者に付与
  const chosen = VACCINE_SEED.filter((v, i) => i === 0 || Math.random() < 0.6);
  return chosen.map((v) => {
    const d = new Date();
    d.setMonth(d.getMonth() - v.monthsAgo - Math.floor(Math.random() * 2));
    d.setHours(10, 0, 0, 0);
    return {
      vaccine: v.vaccine,
      vaccinatedAt: Timestamp.fromDate(d),
      doseNumber: v.dose,
      manufacturer: pick(v.makers),
      lot: lot(),
      physician: '山田 一郎',
      facility: '施設内',
      notes: '',
      createdBy: SEED_AUTHOR,
      updatedBy: SEED_AUTHOR,
      deletedAt: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
  });
}

// 介護保険情報・日常生活自立度のサンプル。認定有効期間は入所日ごろ開始・24ヶ月間を想定。
const INSURERS = ['中央市', '港区', '緑町', '北山市'];
const PHYS_RANKS = ['J1', 'J2', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const DEM_RANKS = ['自立', 'I', 'IIa', 'IIb', 'IIIa', 'IIIb', 'IV'];
function buildCareInsurance(admission) {
  const from = new Date(admission);
  const to = new Date(from);
  to.setMonth(to.getMonth() + 24);
  return {
    physicalIndependence: pick(PHYS_RANKS),
    dementiaIndependence: pick(DEM_RANKS),
    insuredNumber: String(1000000000 + Math.floor(Math.random() * 8999999999)),
    insurer: pick(INSURERS),
    certValidFrom: Timestamp.fromDate(from),
    certValidTo: Timestamp.fromDate(to),
  };
}

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
    dischargeDate: Math.random() < 0.15 ? Timestamp.fromDate(new Date(2025, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 27))) : null,
    medicalHistory: pickN(histories, 1 + Math.floor(Math.random() * 3)).join('、'),
    ...buildAllergy(),
    careLevel: 1 + Math.floor(Math.random() * 5),
    ...buildCareInsurance(admission),
    createdBy: SEED_AUTHOR,
    updatedBy: SEED_AUTHOR,
    deletedAt: null,
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

// Emulator のサンプルデータを全削除（冪等。residents はサブコレクションごと再帰削除）。
async function clearSampleData() {
  await db.recursiveDelete(db.collection('residents'));   // medications/vitals/problems/labResults/immunizations も削除
  await db.recursiveDelete(db.collection('medicalRecords')); // revisions も削除
}

async function main() {
  const user = await ensureAdminUser(ADMIN_EMAIL);
  console.log(`管理者ユーザーを用意: ${ADMIN_EMAIL} (uid=${user.uid}) に admin クレーム付与`);
  console.log(`   ログイン用パスワード（Emulator内）: ${ADMIN_PASSWORD}`);

  // 既存のサンプルデータを全削除してから投入（毎回同じ状態に揃える）
  await clearSampleData();
  console.log('既存のサンプルデータ（入所者・診療録）を削除');

  // 医薬品マスターは空のときのみ投入（フル取り込み済みなら保持し、重複投入も避ける）
  if ((await db.collection('drugMaster').limit(1).get()).empty) {
    for (const name of DRUG_MASTER_NAMES) {
      await db.collection('drugMaster').add({ name, createdAt: Timestamp.now() });
    }
    console.log(`医薬品マスター ${DRUG_MASTER_NAMES.length} 件を投入`);
  } else {
    console.log('医薬品マスターは既存を保持');
  }

  // 病名マスターも空のときのみ投入
  if ((await db.collection('diseaseMaster').limit(1).get()).empty) {
    for (const d of DISEASE_MASTER) {
      await db.collection('diseaseMaster').add({ name: d.name, kana: d.kana || null, icd10: d.icd10 || null, createdAt: Timestamp.now() });
    }
    console.log(`病名マスター ${DISEASE_MASTER.length} 件を投入`);
  } else {
    console.log('病名マスターは既存を保持');
  }

  const RESIDENT_COUNT = 15;
  let recordCount = 0;
  let medCount = 0;
  let vitalCount = 0;
  let problemCount = 0;
  let labCount = 0;
  let immunizationCount = 0;
  for (let i = 0; i < RESIDENT_COUNT; i++) {
    const resident = buildResident();
    const ref = await db.collection('residents').add(resident);
    const numRecords = 1 + Math.floor(Math.random() * 4);
    for (let j = 0; j < numRecords; j++) {
      await db.collection('medicalRecords').add({
        residentId: ref.id,
        date: Timestamp.fromDate(new Date(2024, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 27))),
        record: pick(notes),
        createdBy: SEED_AUTHOR,
        updatedBy: SEED_AUTHOR,
        deletedAt: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      recordCount++;
    }
    // 構造化された投薬を residents/{id}/medications サブコレクションに投入
    for (const med of buildMedications(resident.admissionDate.toDate())) {
      await ref.collection('medications').add(med);
      medCount++;
    }
    // バイタルを residents/{id}/vitals サブコレクションに投入
    for (const v of buildVitals()) {
      await ref.collection('vitals').add(v);
      vitalCount++;
    }
    // プロブレムを residents/{id}/problems サブコレクションに投入
    for (const pr of buildProblems()) {
      await ref.collection('problems').add(pr);
      problemCount++;
    }
    // 検査結果を residents/{id}/labResults サブコレクションに投入
    for (const lab of buildLabResults()) {
      await ref.collection('labResults').add(lab);
      labCount++;
    }
    // 予防接種を residents/{id}/immunizations サブコレクションに投入
    for (const im of buildImmunizations()) {
      await ref.collection('immunizations').add(im);
      immunizationCount++;
    }
  }
  console.log(`シード完了: 入所者 ${RESIDENT_COUNT} 名 / 診療録 ${recordCount} 件 / 投薬 ${medCount} 件 / バイタル ${vitalCount} 件 / プロブレム ${problemCount} 件 / 検査 ${labCount} 件 / 予防接種 ${immunizationCount} 件を投入`);
  process.exit(0);
}

main().catch((err) => {
  console.error('シード失敗:', err);
  console.error('   → 別ターミナルで `npm run emulators` が起動しているか確認してください。');
  process.exit(1);
});
