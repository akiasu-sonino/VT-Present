#!/usr/bin/env tsx
/**
 * 配信者のfollower_countとvideo_idを最新化するスクリプト
 * サイトアクセス時に前回更新から24時間以上経過していたら自動実行される
 */

import { sql } from '@vercel/postgres'

// =================================================================
// 設定
// =================================================================
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || ''
const POSTGRES_URL = process.env.POSTGRES_URL || ''

// @vercel/postgres が環境変数を参照するため、設定
if (!process.env.POSTGRES_URL && POSTGRES_URL) {
  process.env.POSTGRES_URL = POSTGRES_URL
}

// =================================================================
// ログ出力
// =================================================================
function log(msg: string) {
  console.log(`[UpdateStats] ${msg}`)
}

function logError(msg: string) {
  console.error(`[UpdateStats] ${msg}`)
}

function logSuccess(msg: string) {
  console.log(`[UpdateStats] ${msg}`)
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

/**
 * 複数チャンネルの統計情報を一括取得
 * @param channelIds チャンネルIDの配列（最大50件）
 */
async function getChannelsStats(channelIds: string[]): Promise<Map<string, { followerCount: number }>> {
  if (channelIds.length === 0) {
    return new Map()
  }

  const idsParam = channelIds.join(',')
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${idsParam}&key=${YOUTUBE_API_KEY}`

  try {
    const data = await fetchJson(url)
    const statsMap = new Map<string, { followerCount: number }>()

    if (data.items) {
      for (const item of data.items) {
        statsMap.set(item.id, {
          followerCount: parseInt(item.statistics.subscriberCount || '0', 10)
        })
      }
    }

    return statsMap
  } catch (error) {
    logError(`チャンネル統計取得エラー: ${error}`)
    return new Map()
  }
}

/**
 * チャンネルの最新動画IDを取得
 * @param channelId チャンネルID
 */
async function getLatestVideoId(channelId: string): Promise<{ videoId: string | null; publishedAt: string | null }> {
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${channelId}&part=snippet&order=date&maxResults=1&type=video`

  try {
    const searchData = await fetchJson(searchUrl)

    if (!searchData.items || searchData.items.length === 0) {
      return { videoId: null, publishedAt: null }
    }

    return {
      videoId: searchData.items[0].id.videoId,
      publishedAt: searchData.items[0].snippet.publishedAt || null
    }
  } catch (error) {
    // エラーは無視してnullを返す
    return { videoId: null, publishedAt: null }
  }
}

// =================================================================
// DB操作
// =================================================================

interface Streamer {
  id: number
  name: string
  youtube_channel_id: string | null
  follower_count: number
  video_id: string | null
}

/**
 * YouTube配信者の一覧を取得
 */
async function getYoutubeStreamers(): Promise<Streamer[]> {
  const result = await sql<Streamer>`
    SELECT id, name, youtube_channel_id, follower_count, video_id
    FROM streamers
    WHERE youtube_channel_id IS NOT NULL
  `
  return result.rows
}

/**
 * 配信者の統計情報を更新
 */
async function updateStreamerStats(
  id: number,
  followerCount: number,
  videoId: string | null,
  latestVideoPublishedAt: string | null
): Promise<void> {
  await sql`
    UPDATE streamers
    SET
      follower_count = ${followerCount},
      video_id = ${videoId},
      latest_video_published_at = ${latestVideoPublishedAt}
    WHERE id = ${id}
  `
}

/**
 * 最終更新日時を取得
 */
async function getLastUpdateTime(): Promise<Date | null> {
  const result = await sql<{ value: string | null }>`
    SELECT value FROM system_settings
    WHERE key = 'streamer_stats_last_update'
  `

  if (result.rows.length === 0 || !result.rows[0].value) {
    return null
  }

  return new Date(result.rows[0].value)
}

/**
 * 最終更新日時を更新
 */
async function setLastUpdateTime(): Promise<void> {
  await sql`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES ('streamer_stats_last_update', ${new Date().toISOString()}, NOW())
    ON CONFLICT (key) DO UPDATE SET
      value = ${new Date().toISOString()},
      updated_at = NOW()
  `
}

/**
 * 更新が必要かチェック（24時間以上経過しているか）
 */
export async function shouldUpdateStats(): Promise<boolean> {
  try {
    const lastUpdate = await getLastUpdateTime()

    if (!lastUpdate) {
      log('初回更新が必要です')
      return true
    }

    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000

    if (lastUpdate.getTime() < oneDayAgo) {
      log(`前回更新: ${lastUpdate.toISOString()} - 24時間以上経過`)
      return true
    }

    log(`前回更新: ${lastUpdate.toISOString()} - まだ更新不要`)
    return false
  } catch (error) {
    logError(`更新チェックエラー: ${error}`)
    return false
  }
}

// =================================================================
// メイン更新処理
// =================================================================

/**
 * 全配信者の統計情報を更新（エクスポート用）
 */
export async function updateAllStreamerStats(): Promise<{
  updated: number
  errors: number
  skipped: number
}> {
  log('配信者統計更新を開始...')

  const streamers = await getYoutubeStreamers()
  log(`対象配信者数: ${streamers.length}`)

  let updated = 0
  let errors = 0
  let skipped = 0

  // チャンネルIDを50件ずつに分割してバッチ処理
  const channelIds = streamers
    .filter(s => s.youtube_channel_id)
    .map(s => s.youtube_channel_id as string)

  // フォロワー数を一括取得
  const allStats = new Map<string, { followerCount: number }>()

  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50)
    log(`チャンネル統計取得中: ${i + 1}〜${Math.min(i + 50, channelIds.length)} / ${channelIds.length}`)

    const batchStats = await getChannelsStats(batch)
    batchStats.forEach((value, key) => allStats.set(key, value))

    // API制限対策（100リクエスト/秒制限を回避）
    if (i + 50 < channelIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  // 各配信者を更新
  for (const streamer of streamers) {
    if (!streamer.youtube_channel_id) {
      skipped++
      continue
    }

    try {
      const stats = allStats.get(streamer.youtube_channel_id)
      const followerCount = stats?.followerCount ?? streamer.follower_count

      // 最新動画IDを取得（Search APIはクォータを消費するため注意）
      const { videoId, publishedAt } = await getLatestVideoId(streamer.youtube_channel_id)

      // 変更があった場合のみ更新
      const hasChanges =
        followerCount !== streamer.follower_count ||
        videoId !== streamer.video_id

      if (hasChanges) {
        await updateStreamerStats(
          streamer.id,
          followerCount,
          videoId ?? streamer.video_id,
          publishedAt
        )
        updated++
        log(`更新: ${streamer.name} (ID: ${streamer.id}) - フォロワー: ${followerCount}, 動画ID: ${videoId || 'なし'}`)
      } else {
        skipped++
      }

      // API制限対策（Search APIのレート制限）
      await new Promise(resolve => setTimeout(resolve, 200))
    } catch (error) {
      logError(`更新エラー: ${streamer.name} (ID: ${streamer.id}) - ${error}`)
      errors++
    }
  }

  // 最終更新日時を記録
  await setLastUpdateTime()

  logSuccess(`更新完了: 更新=${updated}, スキップ=${skipped}, エラー=${errors}`)

  return { updated, errors, skipped }
}

/**
 * 条件付きで統計更新を実行
 * 24時間以上経過している場合のみ更新
 */
export async function updateStreamerStatsIfNeeded(): Promise<boolean> {
  try {
    const needsUpdate = await shouldUpdateStats()

    if (!needsUpdate) {
      return false
    }

    // バックグラウンドで更新を実行（awaitしない）
    // 注意: Vercel Edge/Serverlessの実行時間制限があるため、
    // 長時間かかる場合は分割実行が必要
    updateAllStreamerStats().catch(error => {
      logError(`バックグラウンド更新エラー: ${error}`)
    })

    return true
  } catch (error) {
    logError(`更新チェックエラー: ${error}`)
    return false
  }
}

// =================================================================
// CLI実行
// =================================================================
async function main() {
  const args = process.argv.slice(2)
  const forceUpdate = args.includes('--force') || args.includes('-f')

  if (forceUpdate) {
    log('強制更新モード')
    const result = await updateAllStreamerStats()
    console.log(result)
  } else {
    const shouldUpdate = await shouldUpdateStats()
    if (shouldUpdate) {
      const result = await updateAllStreamerStats()
      console.log(result)
    } else {
      log('更新不要です')
    }
  }
}

// CLI実行時のみmain()を呼び出す
const isMainModule = process.argv[1]?.includes('update-streamer-stats')

if (isMainModule) {
  main().catch(error => {
    logError(`致命的エラー: ${error}`)
    process.exit(1)
  })
}
