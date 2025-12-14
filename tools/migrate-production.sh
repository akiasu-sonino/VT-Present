#!/bin/bash
# 本番環境でマイグレーションを実行するスクリプト
# 使い方: ./tools/migrate-production.sh

echo "🚀 本番環境でタグカテゴリマイグレーションを実行します"
echo ""

# Vercel環境変数を取得
echo "📡 Vercel環境変数を取得中..."
POSTGRES_URL=$(vercel env pull --environment production --yes 2>&1 | grep POSTGRES_URL | cut -d'=' -f2)

if [ -z "$POSTGRES_URL" ]; then
  echo "❌ POSTGRES_URL が取得できませんでした"
  echo ""
  echo "手動で実行してください:"
  echo "1. Vercel ダッシュボードで POSTGRES_URL を取得"
  echo "2. 以下のコマンドを実行:"
  echo "   POSTGRES_URL='your_url' npm run migrate-tag-categories"
  exit 1
fi

echo "✅ データベース接続情報を取得しました"
echo ""

# マイグレーションを実行
echo "🔄 マイグレーションを実行中..."
POSTGRES_URL="$POSTGRES_URL" npm run migrate-tag-categories

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ マイグレーションが完了しました"
else
  echo ""
  echo "❌ マイグレーションに失敗しました"
  exit 1
fi
