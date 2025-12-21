#!/usr/bin/env tsx
/**
 * YouTubeチャンネル情報を取得してDBに登録するスクリプト
 * Usage: npx tsx tools/insert-youtube-streamer.ts <youtube_handle>
 */

import { sql } from '@vercel/postgres'
import { OpenAI } from 'openai'

// =================================================================
// 設定
// =================================================================
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyAH5q0fG0JFkalyRWHT5gJDVkW27jUCLRM'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://neondb_owner:npg_57hzmRBLTlcD@ep-shy-cloud-a1d938v2-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'

// @vercel/postgres が環境変数を参照するため、設定
if (!process.env.POSTGRES_URL) {
  process.env.POSTGRES_URL = POSTGRES_URL
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

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

async function getChannelIdFromHandle(handle: string): Promise<string | null> {
  log(`▶️ チャンネルID取得中: @${handle}`)

  try {
    const url = `https://www.youtube.com/@${handle}`
    const response = await fetch(url)
    const html = await response.text()

    // パターン1: "externalId":"UC..." で検索
    let match = html.match(/"externalId":"(UC[a-zA-Z0-9_-]{22})"/)
    if (match) {
      const channelId = match[1]
      log(`  - チャンネルID: ${channelId} (externalIdから取得)`)
      return channelId
    }

    // パターン2: "channelId":"UC..." で検索
    match = html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/)
    if (match) {
      const channelId = match[1]
      log(`  - チャンネルID: ${channelId} (channelIdから取得)`)
      return channelId
    }

    logError(`チャンネルIDが取得できませんでした: @${handle}`)
    logError(`HTMLの一部: ${html.substring(0, 500)}...`)
    return null
  } catch (error) {
    logError(`チャンネルID取得エラー: ${error}`)
    return null
  }
}

async function getChannelInfo(channelId: string) {
  log('▶️ チャンネル情報取得中...')

  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`
  const data = await fetchJson(url)

  if (!data.items || data.items.length === 0) {
    throw new Error('チャンネル情報が見つかりませんでした')
  }

  const item = data.items[0]
  const channelCreatedAt = item.snippet.publishedAt // チャンネル開設日

  log(`  - チャンネル開設日: ${channelCreatedAt}`)

  return {
    name: item.snippet.title,
    avatarUrl: item.snippet.thumbnails.medium.url,
    description: item.snippet.description || '',
    followerCount: parseInt(item.statistics.subscriberCount || '0', 10),
    channelCreatedAt: channelCreatedAt
  }
}

async function getLatestVideo(channelId: string) {
  log('▶️ 最新動画ID取得中...')

  const searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${channelId}&part=snippet&order=date&maxResults=1&type=video`
  const searchData = await fetchJson(searchUrl)

  if (!searchData.items || searchData.items.length === 0) {
    log('  ⚠️ 最新動画なし')
    return null
  }

  const videoId = searchData.items[0].id.videoId
  log(`  - 最新動画ID: ${videoId}`)

  // 動画詳細取得
  const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`
  const videoData = await fetchJson(videoUrl)

  if (!videoData.items || videoData.items.length === 0) {
    return { videoId, title: '', description: '', tags: [], publishedAt: null }
  }

  const video = videoData.items[0].snippet
  log(`  - 最新動画公開日: ${video.publishedAt}`)
  return {
    videoId,
    title: video.title || '',
    description: video.description || '',
    tags: video.tags || [],
    publishedAt: video.publishedAt || null
  }
}

// =================================================================
// AI生成: 説明文とタグ
// =================================================================
async function generateDescriptionAndTags(payload: {
  name: string
  channelDesc: string
  latestVideoTitle?: string
  latestVideoDesc?: string
  videoTags?: string[]
}): Promise<{ description: string; tags: string[] }> {
  log('▶️ AI生成: 説明文とタグを生成中...')

  const prompt = `あなたはVTuber/配信者の「第三者紹介文」を作る編集者です。

制約:
- 本人視点の表現は禁止（「はじめまして」「私は」等NG）
- 出力は **JSONのみ**
- description:
  - 書き出しは必ず「この方は〇〇さんです。」
  - 日本語・丁寧語
  - 120字以内
- tags:
  - 最大8件
  - 単語のみ（ひらがな/カタカナ/漢字）
  - 必ず「VTuber」または「配信者」を含める
- 個人情報・憶測は書かない

入力:
配信者名: ${payload.name}
公式説明: ${payload.channelDesc}

出力フォーマット:
{
  "description": string,
  "tags": string[]
}`.trim()

  try {
    await new Promise(resolve => setTimeout(resolve, 2000)) // API制限対策

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt }
      ]
    })

    let text = response.choices[0]?.message?.content?.trim() || ''

    // ```json ... ``` の囲いを除去
    if (text.startsWith('```')) {
      const match = text.match(/```(?:json)?\s*(.*?)```/s)
      if (match) {
        text = match[1].trim()
      }
    }

    const data = JSON.parse(text)
    const description = String(data.description || '').trim().replace(/\n/g, ' ')
    const tags = (data.tags || []).map((t: string) => t.trim()).filter(Boolean)

    logSuccess(`AI生成完了: description=${description.length}文字, tags=${tags.length}個`)
    return { description, tags }
  } catch (error) {
    logError(`AI生成エラー: ${error}`)
    return { description: '', tags: [] }
  }
}

// =================================================================
// タグ正規化
// =================================================================
async function normalizeTags(tags: string[]): Promise<string[]> {
  if (tags.length === 0) {
    return []
  }

  log('▶️ タグの正規化処理中...')
  log(`  正規化前: ${JSON.stringify(tags)}`)

  try {
    const result = await sql`
      WITH input_tags AS (
        SELECT unnest(${tags}::text[]) AS tag
      ),
      normalized AS (
        SELECT DISTINCT
          CASE
            WHEN tn.normalized_tag IS NOT NULL THEN tn.normalized_tag
            WHEN tn.alias IS NOT NULL AND tn.normalized_tag IS NULL THEN NULL
            ELSE it.tag
          END AS cleaned_tag
        FROM input_tags it
        LEFT JOIN tag_normalization tn ON tn.alias = it.tag
        WHERE CASE
          WHEN tn.normalized_tag IS NOT NULL THEN tn.normalized_tag
          WHEN tn.alias IS NOT NULL AND tn.normalized_tag IS NULL THEN NULL
          ELSE it.tag
        END IS NOT NULL
      )
      SELECT array_agg(cleaned_tag) as tags
      FROM normalized
    `

    const normalizedTags = result.rows[0]?.tags || []
    log(`  正規化後: ${JSON.stringify(normalizedTags)}`)
    return normalizedTags
  } catch (error) {
    logError(`タグ正規化エラー: ${error}`)
    return tags
  }
}

// =================================================================
// DB挿入
// =================================================================
async function insertStreamer(data: {
  name: string
  platform: string
  avatarUrl: string
  description: string
  tags: string[]
  followerCount: number
  channelUrl: string
  youtubeChannelId: string
  videoId: string | null
  channelCreatedAt: string | null
  latestVideoPublishedAt: string | null
}) {
  log('▶️ DBへ挿入中...')

  try {
    await sql`
      INSERT INTO streamers (
        name, platform, avatar_url, description, tags,
        follower_count, channel_url, youtube_channel_id,
        twitch_user_id, video_id, channel_created_at, latest_video_published_at
      ) VALUES (
        ${data.name},
        ${data.platform},
        ${data.avatarUrl},
        ${data.description},
        ${data.tags},
        ${data.followerCount},
        ${data.channelUrl},
        ${data.youtubeChannelId},
        NULL,
        ${data.videoId},
        ${data.channelCreatedAt},
        ${data.latestVideoPublishedAt}
      )
      ON CONFLICT (youtube_channel_id) DO UPDATE SET
        name = EXCLUDED.name,
        avatar_url = EXCLUDED.avatar_url,
        follower_count = EXCLUDED.follower_count,
        channel_url = EXCLUDED.channel_url,
        video_id = EXCLUDED.video_id,
        description = EXCLUDED.description,
        tags = EXCLUDED.tags,
        channel_created_at = EXCLUDED.channel_created_at,
        latest_video_published_at = EXCLUDED.latest_video_published_at
    `

    logSuccess('DBに挿入/更新完了！')
  } catch (error) {
    logError(`DB挿入エラー: ${error}`)
    throw error
  }
}

// =================================================================
// メイン処理関数（エクスポート用）
// =================================================================
export async function insertYoutubeStreamer(handle: string): Promise<void> {
  console.log('=====================================')
  console.log(`▶️ 処理開始: @${handle}`)
  console.log('=====================================')

  // YouTubeハンドルのクリーンアップ
  const cleanHandle = handle.replace(/^@/, '')

  // 1. チャンネルID取得
  const channelId = await getChannelIdFromHandle(cleanHandle)
  if (!channelId) {
    throw new Error('チャンネルIDが取得できませんでした')
  }

  // 2. チャンネル情報取得
  const channelInfo = await getChannelInfo(channelId)

  // 3. 最新動画情報取得
  const latestVideo = await getLatestVideo(channelId)

  // 4. AI生成
  const { description, tags } = await generateDescriptionAndTags({
    name: cleanHandle,
    channelDesc: channelInfo.description,
    latestVideoTitle: latestVideo?.title,
    latestVideoDesc: latestVideo?.description,
    videoTags: latestVideo?.tags
  })

  // 5. タグ正規化
  const normalizedTags = await normalizeTags(tags)

  // 6. DB挿入
  await insertStreamer({
    name: channelInfo.name,
    platform: 'YouTube',
    avatarUrl: channelInfo.avatarUrl,
    description: description || channelInfo.name,
    tags: normalizedTags.length > 0 ? normalizedTags : [],
    followerCount: channelInfo.followerCount,
    channelUrl: `https://www.youtube.com/@${cleanHandle}`,
    youtubeChannelId: channelId,
    videoId: latestVideo?.videoId || null,
    channelCreatedAt: channelInfo.channelCreatedAt || null,
    latestVideoPublishedAt: latestVideo?.publishedAt || null
  })

  logSuccess(`処理完了: @${cleanHandle}`)
}

// =================================================================
// メイン処理（CLI実行時のみ）
// =================================================================
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('使い方: npx tsx tools/insert-youtube-streamer.ts <youtube_handle>')
    process.exit(1)
  }

  for (const handle of args) {
    try {
      await insertYoutubeStreamer(handle)
    } catch (error) {
      logError(`処理エラー: ${error}`)
    }
    console.log('')
  }
}

// CLI実行時のみmain()を呼び出す（require.main === module の代替）
// ESモジュールではrequire.mainが使えないため、ファイル名で判定
const isMainModule = process.argv[1]?.includes('insert-youtube-streamer')

if (isMainModule) {
  main().catch(error => {
    logError(`致命的エラー: ${error}`)
    process.exit(1)
  })
}
