#!/bin/bash

# Firebase 設定デプロイスクリプト
# CareEMR Firebase プロダクト設定の同期・適用

set -e

PROJECT_ID="emr-system-dc60d"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 CareEMR Firebase 設定デプロイ開始..."
echo "📦 Project ID: $PROJECT_ID"

# 現在のプロジェクトを設定
echo "🔧 Firebase プロジェクト設定..."
firebase use $PROJECT_ID

# Firestore セキュリティルールとインデックスのデプロイ
echo "🔒 Firestore セキュリティルール・インデックスのデプロイ..."
firebase deploy --only firestore:rules,firestore:indexes --project $PROJECT_ID

# App Hosting 設定の適用
echo "🏠 App Hosting 設定の確認..."
if [ -f "$ROOT_DIR/apphosting.yaml" ]; then
    echo "✅ apphosting.yaml が存在します"
    echo "ℹ️  App Hosting設定は firebase apphosting:backends:create または Console で適用してください"
else
    echo "❌ apphosting.yaml が見つかりません"
    exit 1
fi

# 設定ファイルの存在確認
echo "📋 設定ファイルの確認..."

CONFIG_FILES=(
    "firebase.json"
    ".firebaserc"
    "firestore.rules"
    "firestore.indexes.json"
    "apphosting.yaml"
    "firebase-auth-config.json"
    "firebase-analytics-config.json"
)

for file in "${CONFIG_FILES[@]}"; do
    if [ -f "$ROOT_DIR/$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file が見つかりません"
    fi
done

echo ""
echo "🎉 Firebase 設定デプロイ完了！"
echo ""
echo "📌 手動で適用が必要な設定:"
echo "   - Authentication プロバイダー設定 (Firebase Console)"
echo "   - Analytics カスタムイベント・パラメータ (Firebase Console)"
echo "   - カスタムクレーム設定 (admin-setup スクリプト)"
echo ""
echo "🔗 次のステップ:"
echo "   1. firebase apphosting:backends:create (初回のみ)"
echo "   2. npm run build && firebase deploy (アプリケーションデプロイ)"
echo "   3. admin-setup でユーザー管理"