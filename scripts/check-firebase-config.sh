#!/bin/bash

# Firebase 設定同期確認スクリプト
# Git リポジトリと Firebase Console の設定差分をチェック

set -e

PROJECT_ID="emr-system-dc60d"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🔍 Firebase 設定同期チェック開始..."
echo "📦 Project ID: $PROJECT_ID"
echo "📁 Root Directory: $ROOT_DIR"
echo ""

# 現在のプロジェクトを設定
firebase use $PROJECT_ID

echo "📋 Git管理されている設定ファイル:"
echo "✅ firebase.json"
echo "✅ .firebaserc"
echo "✅ firestore.rules"
echo "✅ firestore.indexes.json"
echo "✅ apphosting.yaml"
echo "✅ firebase-auth-config.json (手動作成)"
echo "✅ firebase-analytics-config.json (手動作成)"
echo "✅ auth-users.json (エクスポート済み)"
echo ""

echo "🔒 Firestore セキュリティルール確認..."
if [ -f "$ROOT_DIR/firestore.rules" ]; then
    echo "現在のルール:"
    cat "$ROOT_DIR/firestore.rules"
    echo ""
else
    echo "❌ firestore.rules が見つかりません"
fi

echo "📊 Firestore インデックス確認..."
if [ -f "$ROOT_DIR/firestore.indexes.json" ]; then
    echo "現在のインデックス数: $(jq '.indexes | length' "$ROOT_DIR/firestore.indexes.json")"
    echo "フィールドオーバーライド数: $(jq '.fieldOverrides | length' "$ROOT_DIR/firestore.indexes.json")"
else
    echo "❌ firestore.indexes.json が見つかりません"
fi

echo ""
echo "🏠 App Hosting 設定確認..."
if [ -f "$ROOT_DIR/apphosting.yaml" ]; then
    echo "環境変数数: $(yq e '.env | length' "$ROOT_DIR/apphosting.yaml")"
    echo "minInstances: $(yq e '.runConfig.minInstances' "$ROOT_DIR/apphosting.yaml")"
    echo "maxInstances: $(yq e '.runConfig.maxInstances' "$ROOT_DIR/apphosting.yaml")"
else
    echo "❌ apphosting.yaml が見つかりません"
fi

echo ""
echo "🔐 認証設定確認..."
if [ -f "$ROOT_DIR/firebase-auth-config.json" ]; then
    echo "Google認証: $(jq -r '.signInProviders.google.enabled' "$ROOT_DIR/firebase-auth-config.json")"
    echo "認証ドメイン数: $(jq '.settings.authorizedDomains | length' "$ROOT_DIR/firebase-auth-config.json")"
else
    echo "❌ firebase-auth-config.json が見つかりません"
fi

echo ""
echo "📈 Analytics設定確認..."
if [ -f "$ROOT_DIR/firebase-analytics-config.json" ]; then
    echo "カスタムイベント数: $(jq '.customDefinitions.customEvents | length' "$ROOT_DIR/firebase-analytics-config.json")"
    echo "カスタムパラメータ数: $(jq '.customDefinitions.customParameters | length' "$ROOT_DIR/firebase-analytics-config.json")"
    echo "コンバージョンイベント数: $(jq '.conversionEvents | length' "$ROOT_DIR/firebase-analytics-config.json")"
else
    echo "❌ firebase-analytics-config.json が見つかりません"
fi

echo ""
echo "👥 ユーザー情報確認..."
if [ -f "$ROOT_DIR/auth-users.json" ]; then
    echo "エクスポート済みユーザー数: $(jq '.users | length' "$ROOT_DIR/auth-users.json")"
else
    echo "❌ auth-users.json が見つかりません"
fi

echo ""
echo "🎉 設定ファイル確認完了！"
echo ""
echo "📌 注意事項:"
echo "   - Firebase Console での変更は自動的にGitに反映されません"
echo "   - 設定変更後は手動でエクスポート・同期が必要です"
echo ""
echo "🔄 設定を最新化する場合:"
echo "   firebase auth:export auth-users.json"
echo "   手動でコンソール設定を *-config.json ファイルに反映"