# 本番環境でマイグレーションを実行するPowerShellスクリプト
# 使い方: .\tools\migrate-production.ps1

Write-Host "🚀 本番環境でタグカテゴリマイグレーションを実行します" -ForegroundColor Green
Write-Host ""

# 環境変数を確認
if (-not $env:POSTGRES_URL) {
    Write-Host "❌ POSTGRES_URL 環境変数が設定されていません" -ForegroundColor Red
    Write-Host ""
    Write-Host "以下の手順で実行してください:" -ForegroundColor Yellow
    Write-Host "1. Vercel ダッシュボードで POSTGRES_URL を取得"
    Write-Host "2. 環境変数を設定:"
    Write-Host '   $env:POSTGRES_URL="your_postgres_url"' -ForegroundColor Cyan
    Write-Host "3. 再度このスクリプトを実行"
    Write-Host ""
    Write-Host "または直接実行:" -ForegroundColor Yellow
    Write-Host '   $env:POSTGRES_URL="your_url"; npm run migrate-tag-categories' -ForegroundColor Cyan
    exit 1
}

Write-Host "✅ データベース接続情報を確認しました" -ForegroundColor Green
Write-Host ""

# マイグレーションを実行
Write-Host "🔄 マイグレーションを実行中..." -ForegroundColor Yellow
npm run migrate-tag-categories

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ マイグレーションが完了しました" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ マイグレーションに失敗しました" -ForegroundColor Red
    exit 1
}
