import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';

// Firebase設定 - 本番環境では環境変数を使用
const firebaseConfig = {
  apiKey: "AIzaSyDpNZLCqI4GHkjLMGIYdMDO8HnqYi5_Wj4",
  authDomain: "emr-system-dc60d.firebaseapp.com",
  projectId: "emr-system-dc60d",
  storageBucket: "emr-system-dc60d.firebasestorage.app",
  messagingSenderId: "1032965649808",
  appId: "1:1032965649808:web:b5f2a1c2a0e8a9d0e8f9c0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 入所者データ用の姓・名前
const surnames = ['田中', '佐藤', '鈴木', '高橋', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上'];

const maleNames = ['太郎', '一郎', '健一', '明', '博', '誠', '学', '正', '昭', '勇', '次郎', '三郎', '修', '治', '浩'];

const femaleNames = ['花子', 'みどり', 'よしこ', 'としこ', 'かずこ', 'まさこ', 'のりこ', 'ゆきこ', 'みつこ', 'きみこ', 'えみこ', 'ちかこ', 'たかこ', 'なおこ', 'せつこ'];

const furiganaMap = {
  '田中': 'タナカ', '佐藤': 'サトウ', '鈴木': 'スズキ', '高橋': 'タカハシ', '渡辺': 'ワタナベ',
  '山本': 'ヤマモト', '中村': 'ナカムラ', '小林': 'コバヤシ', '加藤': 'カトウ', '吉田': 'ヨシダ',
  '山田': 'ヤマダ', '佐々木': 'ササキ', '山口': 'ヤマグチ', '松本': 'マツモト', '井上': 'イノウエ',

  '太郎': 'タロウ', '一郎': 'イチロウ', '健一': 'ケンイチ', '明': 'アキラ', '博': 'ヒロシ',
  '誠': 'マコト', '学': 'マナブ', '正': 'タダシ', '昭': 'アキラ', '勇': 'イサム',
  '次郎': 'ジロウ', '三郎': 'サブロウ', '修': 'オサム', '治': 'オサム', '浩': 'ヒロシ',

  '花子': 'ハナコ', 'みどり': 'ミドリ', 'よしこ': 'ヨシコ', 'としこ': 'トシコ', 'かずこ': 'カズコ',
  'まさこ': 'マサコ', 'のりこ': 'ノリコ', 'ゆきこ': 'ユキコ', 'みつこ': 'ミツコ', 'きみこ': 'キミコ',
  'えみこ': 'エミコ', 'ちかこ': 'チカコ', 'たかこ': 'タカコ', 'なおこ': 'ナオコ', 'せつこ': 'セツコ'
};

// 100人の入所者データを生成
const generateResidents = () => {
  const residents = [];
  const usedNames = new Set();

  for (let i = 0; i < 100; i++) {
    let name, furigana, gender;
    let attempts = 0;

    do {
      gender = Math.random() > 0.6 ? '女性' : '男性';
      const surnameIndex = Math.floor(Math.random() * surnames.length);
      const givenNameIndex = gender === '男性'
        ? Math.floor(Math.random() * maleNames.length)
        : Math.floor(Math.random() * femaleNames.length);

      const surname = surnames[surnameIndex];
      const givenName = gender === '男性'
        ? maleNames[givenNameIndex]
        : femaleNames[givenNameIndex];

      name = `${surname} ${givenName}`;
      furigana = `${furiganaMap[surname]} ${furiganaMap[givenName]}`;
      attempts++;
    } while (usedNames.has(name) && attempts < 50);

    if (!usedNames.has(name)) {
      usedNames.add(name);
      const birthYear = 1930 + Math.floor(Math.random() * 40);

      residents.push({
        name,
        furigana,
        gender,
        birthYear
      });
    }
  }

  return residents;
};

const residents = generateResidents();

const medications = [
  'アリセプト', 'メマリー', 'リバスタッチ', 'イクセロン', 'レミニール',
  'アムロジピン', 'リシノプリル', 'メトホルミン', 'アスピリン', 'ワーファリン',
  'プレドニゾロン', 'フロセミド', 'アテノロール', 'シンバスタチン', 'オメプラゾール',
  'ランソプラゾール', 'カルシウム', 'ビタミンD', 'ビタミンB12', 'マグネシウム'
];

const medicalHistories = [
  '高血圧症', '糖尿病', '認知症', '心房細動', '脳梗塞',
  '関節リウマチ', '骨粗鬆症', '白内障', '緑内障', '難聴',
  '慢性腎臓病', '慢性心不全', 'COPD', '胃潰瘍', '便秘症',
  '不眠症', 'うつ病', 'パーキンソン病', '変形性膝関節症', '腰部脊柱管狭窄症'
];

const careNotes = [
  '歩行時見守り必要。転倒リスクあり。',
  '食事摂取良好。水分摂取促し必要。',
  '夜間不穏あり。睡眠パターン観察継続。',
  '排泄自立。定時誘導実施中。',
  '入浴拒否傾向。声かけ工夫必要。',
  'ADL全介助。褥瘡予防に注意。',
  '車椅子移乗時2人介助。',
  '認知機能低下あり。見当識障害。',
  'コミュニケーション良好。レクリエーション参加積極的。',
  '薬の管理必要。服薬確認徹底。',
  '血圧変動あり。定期測定継続。',
  '食事形態：きざみ食。むせ込み注意。',
  '家族面会頻回。精神的安定。',
  '日中傾眠傾向。活動促し必要。',
  '皮膚乾燥あり。保湿ケア実施。'
];

// ランダム選択関数
const randomChoice = (array) => array[Math.floor(Math.random() * array.length)];
const randomChoices = (array, count) => {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// 日付生成関数
const randomDate = (start, end) => {
  const startTime = start.getTime();
  const endTime = end.getTime();
  return new Date(startTime + Math.random() * (endTime - startTime));
};

// 部屋番号生成（重複あり）
const generateRoomNumber = () => {
  const floor = Math.floor(Math.random() * 3) + 1; // 1-3階
  const room = Math.floor(Math.random() * 20) + 1; // 1-20号室
  return `${floor}0${room.toString().padStart(2, '0')}`;
};

// 入所者データ作成
const createResident = (residentInfo) => {
  const birthDate = randomDate(new Date(residentInfo.birthYear, 0, 1), new Date(residentInfo.birthYear, 11, 31));
  const admissionDate = randomDate(new Date(2020, 0, 1), new Date(2024, 11, 31));

  // 5%の確率で退所済み
  const dischargeDate = Math.random() < 0.05 ?
    randomDate(admissionDate, new Date()) : null;

  const careLevel = Math.floor(Math.random() * 5) + 1; // 1-5必須

  const medicationCount = Math.floor(Math.random() * 6); // 0-5個
  const selectedMedications = randomChoices(medications, medicationCount);

  const historyCount = Math.floor(Math.random() * 4) + 1; // 1-4個
  const selectedHistories = randomChoices(medicalHistories, historyCount);

  const nameParts = residentInfo.name.split(' ');
  const furiganaParts = residentInfo.furigana.split(' ');

  return {
    name: residentInfo.name,
    furigana: residentInfo.furigana,
    lastName: nameParts[0],
    firstName: nameParts[1],
    lastNameKana: furiganaParts[0],
    firstNameKana: furiganaParts[1],
    gender: residentInfo.gender,
    birthDate: Timestamp.fromDate(birthDate),
    roomNumber: generateRoomNumber(),
    admissionDate: Timestamp.fromDate(admissionDate),
    dischargeDate: dischargeDate ? Timestamp.fromDate(dischargeDate) : null,
    medicalHistory: selectedHistories.join('、'),
    medications: selectedMedications,
    careLevel,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
};

// 診療録データ作成
const createMedicalRecord = (residentId, admissionDate) => {
  const recordDate = randomDate(admissionDate, new Date());
  const note = randomChoice(careNotes);

  return {
    residentId,
    date: Timestamp.fromDate(recordDate),
    record: note,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
};

// メインの実行関数
const createTestData = async () => {
  console.log('テストデータ作成開始...');

  try {
    const createdResidents = [];

    // 100名の入所者作成
    console.log('入所者データ作成中...');
    for (let i = 0; i < residents.length; i++) {
      const residentData = createResident(residents[i]);
      const docRef = await addDoc(collection(db, 'residents'), residentData);
      createdResidents.push({ id: docRef.id, ...residentData });
    }

    console.log('診療録データ作成中...');
    let recordCount = 0;

    // 各入所者に1-5件の診療録作成
    for (const resident of createdResidents) {
      const recordsToCreate = Math.floor(Math.random() * 5) + 1; // 1-5件

      for (let j = 0; j < recordsToCreate; j++) {
        const admissionDate = resident.admissionDate.toDate();
        const recordData = createMedicalRecord(resident.id, admissionDate);
        await addDoc(collection(db, 'medicalRecords'), recordData);
        recordCount++;
      }
    }

    console.log(`✅ テストデータ作成完了!`);
    console.log(`📊 作成されたデータ:`);
    console.log(`   - 入所者: ${createdResidents.length}名`);
    console.log(`   - 診療録: ${recordCount}件`);
    console.log(`   - 平均診療録数: ${(recordCount / createdResidents.length).toFixed(1)}件/人`);

    // 統計情報表示
    const genderStats = createdResidents.reduce((acc, r) => {
      acc[r.gender] = (acc[r.gender] || 0) + 1;
      return acc;
    }, {});
    console.log(`   - 性別分布: 男性${genderStats['男性']}名, 女性${genderStats['女性']}名`);

    const careLevelStats = createdResidents.reduce((acc, r) => {
      const level = `要介護${r.careLevel}`;
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {});
    console.log(`   - 要介護度分布:`, careLevelStats);

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    process.exit(0);
  }
};

// 実行
createTestData();