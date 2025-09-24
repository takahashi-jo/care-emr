const admin = require('firebase-admin');

// サービスアカウントキーを読み込み
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'emr-system-dc60d'
});

async function setAdminClaim(email) {
  try {
    // メールアドレスからユーザーを取得
    const userRecord = await admin.auth().getUserByEmail(email);

    // adminカスタムクレームを設定
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      admin: true
    });

    console.log(`adminクレーム設定完了: ${email} (UID: ${userRecord.uid})`);
  } catch (error) {
    console.error('エラー:', error);
  }
}

// 使用例
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('使用方法: node set-admin-claim.js <email>');
    console.log('例: node set-admin-claim.js admin@example.com');
    process.exit(1);
  }

  const email = args[0];
  await setAdminClaim(email);
  process.exit(0);
}

if (require.main === module) {
  main();
}