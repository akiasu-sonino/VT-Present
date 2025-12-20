#!/usr/bin/env tsx
/**
 * 既存配信者のチャンネル開設日を更新するスクリプト
 * Usage: npx tsx tools/update-channel-created-dates.ts
 */

import { sql } from '@vercel/postgres'

// =================================================================
// 設定
// =================================================================
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyAH5q0fG0JFkalyRWHT5gJDVkW27jUCLRM'
const POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://neondb_owner:npg_57hzmRBLTlcD@ep-shy-cloud-a1d938v2-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'

// @vercel/postgres が環境変数を参照するため、設定
if (!process.env.POSTGRES_URL) {
  process.env.POSTGRES_URL = POSTGRES_URL
}

// =================================================================
// ログ出力
// =================================================================
function log(msg: string) {
  console.log(msg)
}

function logError(msg: string) {
  console.error(`❌ ${msg}`)
}

function logSuccess(msg: string) {
  console.log(`✨ ${msg}`)
}

// =================================================================
// YouTube API呼び出し
// =================================================================
async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}: ${url}`)
  }
  return response.json()
}

async function getChannelCreatedDate(channelId: string): Promise<string | null> {
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${YOUTUBE_API_KEY}`
    const data = await fetchJson(url)

    if (!data.items || data.items.length === 0) {
      logError(`チャンネル情報が見つかりませんでした: ${channelId}`)
      return null
    }

    const channelCreatedAt = data.items[0].snippet.publishedAt
    return channelCreatedAt
  } catch (error) {
    logError(`API呼び出しエラー: ${error}`)
    return null
  }
}

// =================================================================
// メイン処理
// =================================================================
async function main() {
  log('=====================================')
  log('既存配信者のチャンネル開設日を更新')
  log('=====================================')

  try {
    // channel_created_atがNULLのYouTube配信者を取得
    const result = await sql`
      SELECT id, name, youtube_channel_id
      FROM streamers
      WHERE youtube_channel_id IS NOT NULL
        AND channel_created_at IS NULL
      ORDER BY id
    `

    const streamers = result.rows
    log(`対象配信者数: ${streamers.length}`)

    if (streamers.length === 0) {
      logSuccess('更新対象の配信者がいません')
      return
    }

    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < streamers.length; i++) {
      const streamer = streamers[i]
      log(`\n[${i + 1}/${streamers.length}] ${streamer.name} (ID: ${streamer.id})`)

      // YouTube APIからチャンネル開設日を取得
      const channelCreatedAt = await getChannelCreatedDate(streamer.youtube_channel_id)

      if (channelCreatedAt) {
        // DBを更新
        await sql`
          UPDATE streamers
          SET channel_created_at = ${channelCreatedAt}
          WHERE id = ${streamer.id}
        `
        logSuccess(`  更新完了: ${channelCreatedAt}`)
        successCount++
      } else {
        logError('  チャンネル開設日の取得に失敗')
        errorCount++
      }

      // API制限対策: 1秒待機
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    log('\n=====================================')
    logSuccess(`処理完了: 成功 ${successCount}件 / エラー ${errorCount}件`)
    log('=====================================')
  } catch (error) {
    logError(`致命的エラー: ${error}`)
    process.exit(1)
  }
}

main().catch(error => {
  logError(`エラー: ${error}`)
  process.exit(1)
})
