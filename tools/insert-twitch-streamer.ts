#!/usr/bin/env tsx
/**
 * Twitch配信者情報を取得してDBに登録するスクリプト
 * Usage: npx tsx tools/insert-twitch-streamer.ts <twitch_username>
 */

import { sql } from '@vercel/postgres'
import { OpenAI } from 'openai'
import {
  getTwitchAccessToken,
  getTwitchUserByLogin,
  getTwitchFollowerCount
} from '../src/lib/twitch.js'

// =================================================================
// 設定
// =================================================================
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || ''
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || ''
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const POSTGRES_URL = process.env.POSTGRES_URL || ''

// @vercel/postgres が環境変数を参照するため、設定
if (!process.env.POSTGRES_URL && POSTGRES_URL) {
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
// AI生成: 説明文とタグ
// =================================================================
async function generateDescriptionAndTags(payload: {
  name: string
  channelDesc: string
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
プラットフォーム: Twitch

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
  twitchUserId: string
  channelCreatedAt: string | null
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
        NULL,
        ${data.twitchUserId},
        NULL,
        ${data.channelCreatedAt},
        NULL
      )
      ON CONFLICT (twitch_user_id) DO UPDATE SET
        name = EXCLUDED.name,
        avatar_url = EXCLUDED.avatar_url,
        follower_count = EXCLUDED.follower_count,
        channel_url = EXCLUDED.channel_url,
        description = EXCLUDED.description,
        tags = EXCLUDED.tags,
        channel_created_at = EXCLUDED.channel_created_at
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
export async function insertTwitchStreamer(username: string): Promise<void> {
  console.log('=====================================')
  console.log(`▶️ 処理開始: ${username}`)
  console.log('=====================================')

  // バリデーション
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    throw new Error('TWITCH_CLIENT_ID と TWITCH_CLIENT_SECRET が設定されていません')
  }

  // ユーザー名のクリーンアップ
  const cleanUsername = username.toLowerCase().replace(/^@/, '')

  // 1. アクセストークン取得
  log('▶️ Twitchアクセストークン取得中...')
  const accessToken = await getTwitchAccessToken(TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET)

  // 2. ユーザー情報取得
  log(`▶️ ユーザー情報取得中: ${cleanUsername}`)
  const user = await getTwitchUserByLogin(cleanUsername, TWITCH_CLIENT_ID, accessToken)

  if (!user) {
    throw new Error(`Twitchユーザーが見つかりませんでした: ${cleanUsername}`)
  }

  log(`  - ユーザーID: ${user.id}`)
  log(`  - 表示名: ${user.display_name}`)
  log(`  - チャンネル開設日: ${user.created_at}`)

  // 3. フォロワー数取得
  log('▶️ フォロワー数取得中...')
  const followerCount = await getTwitchFollowerCount(user.id, TWITCH_CLIENT_ID, accessToken)
  log(`  - フォロワー数: ${followerCount}`)

  // 4. AI生成
  const { description, tags } = await generateDescriptionAndTags({
    name: user.display_name,
    channelDesc: user.description || ''
  })

  // 5. タグ正規化
  const normalizedTags = await normalizeTags(tags)

  // 6. DB挿入
  await insertStreamer({
    name: user.display_name,
    platform: 'Twitch',
    avatarUrl: user.profile_image_url,
    description: description || `この方は${user.display_name}さんです。Twitchで活動されている配信者です。`,
    tags: normalizedTags.length > 0 ? normalizedTags : ['配信者', 'Twitch'],
    followerCount: followerCount,
    channelUrl: `https://www.twitch.tv/${cleanUsername}`,
    twitchUserId: user.id,
    channelCreatedAt: user.created_at || null
  })

  logSuccess(`処理完了: ${cleanUsername}`)
}

// =================================================================
// メイン処理（CLI実行時のみ）
// =================================================================
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('使い方: npx tsx tools/insert-twitch-streamer.ts <twitch_username>')
    process.exit(1)
  }

  for (const username of args) {
    try {
      await insertTwitchStreamer(username)
    } catch (error) {
      logError(`処理エラー: ${error}`)
    }
    console.log('')
  }
}

// CLI実行時のみmain()を呼び出す
const isMainModule = process.argv[1]?.includes('insert-twitch-streamer')

if (isMainModule) {
  main().catch(error => {
    logError(`致命的エラー: ${error}`)
    process.exit(1)
  })
}
