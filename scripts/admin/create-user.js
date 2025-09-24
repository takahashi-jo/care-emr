const admin = require('firebase-admin');

// サービスアカウントキーを読み込み（後で設定）
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'emr-system-dc60d'
});

async function createUserWithAdminClaim(email, displayName, password = null) {
  try {
    // ユーザーを作成
    const userRecord = await admin.auth().createUser({
      email: email,
      displayName: displayName,
      password: password, // パスワードはオプション（Googleログインのみの場合は不要）
      emailVerified: true
    });

    console.log('ユーザー作成成功:', userRecord.uid, email);

    // adminカスタムクレームを設定
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      admin: true
    });

    console.log('adminクレーム設定完了:', email);

    return userRecord;
  } catch (error) {
    console.error('エラー:', error);
  }
}

// 使用例
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('使用方法: node create-user.js <email> <displayName> [password]');
    console.log('例: node create-user.js admin@example.com "管理者" password123');
    process.exit(1);
  }

  const [email, displayName, password] = args;
  await createUserWithAdminClaim(email, displayName, password);
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { createUserWithAdminClaim };