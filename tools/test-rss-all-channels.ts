#!/usr/bin/env tsx
/**
 * DB内のすべてのチャンネルでRSS + videos:list検証
 *
 * 使い方:
 * tsx tools/test-rss-all-channels.ts
 *
 * 環境変数が必要:
 * - YOUTUBE_API_KEY
 * - POSTGRES_URL (または Vercel環境変数)
 */

import { sql } from '@vercel/postgres'

interface Streamer {
  id: number
  name: string
  youtube_channel_id: string
}

interface VideoDetails {
  id: string
  title: string
  channelId: string
  isLive: boolean
  actualStartTime?: string
  actualEndTime?: string | null
  concurrentViewers?: number
}

/**
 * RSSフィードから最新動画IDを取得
 */
async function fetchVideoIdsFromRSS(channelId: string): Promise<string[]> {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    const response = await fetch(rssUrl)

    if (!response.ok) {
      return []
    }

    const xmlText = await response.text()
    const videoIdMatches = xmlText.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)
    const videoIds: string[] = []

    for (const match of videoIdMatches) {
      videoIds.push(match[1])
      if (videoIds.length >= 3) break
    }

    return videoIds
  } catch (error) {
    console.error(`❌ RSS fetch error for ${channelId}:`, error)
    return []
  }
}

/**
 * videos:list でライブ配信状態を確認
 */
async function fetchVideoDetails(videoIds: string[], apiKey: string): Promise<Map<string, VideoDetails>> {
  if (videoIds.length === 0) return new Map()

  const results = new Map<string, VideoDetails>()

  try {
    // 50件ずつバッチ処理
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50)

      const url = new URL('https://www.googleapis.com/youtube/v3/videos')
      url.searchParams.set('part', 'snippet,liveStreamingDetails')
      url.searchParams.set('id', batch.join(','))
      url.searchParams.set('key', apiKey)

      const response = await fetch(url.toString())
      if (!response.ok) {
        console.error(`❌ API error: ${response.status}`)
        continue
      }

      const data = await response.json()

      for (const item of data.items || []) {
        const liveDetails = item.liveStreamingDetails
        const isLive = !!liveDetails?.actualStartTime && !liveDetails.actualEndTime

        results.set(item.id, {
          id: item.id,
          title: item.snippet?.title || '',
          channelId: item.snippet?.channelId || '',
          isLive,
          actualStartTime: liveDetails?.actualStartTime,
          actualEndTime: liveDetails?.actualEndTime,
          concurrentViewers: liveDetails?.concurrentViewers ? parseInt(liveDetails.concurrentViewers, 10) : undefined
        })
      }
    }
  } catch (error) {
    console.error(`❌ API fetch error:`, error)
  }

  return results
}

/**
 * メイン処理
 */
async function main() {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    console.error('❌ YOUTUBE_API_KEY environment variable is not set')
    process.exit(1)
  }

  console.log('🔍 Testing RSS + videos:list for all channels in DB')
  console.log('=' .repeat(60))

  // DBから全チャンネルを取得
  const result = await sql<Streamer>`
    SELECT id, name, youtube_channel_id
    FROM streamers
    WHERE youtube_channel_id IS NOT NULL
    ORDER BY id
  `

  const streamers = result.rows
  console.log(`📊 Found ${streamers.length} channels in database\n`)

  const channelIds = streamers.map(s => s.youtube_channel_id)

  // 1. 全チャンネルのRSSから動画IDを取得
  console.log('📡 Fetching RSS feeds...')
  const videoIdsMap = new Map<string, string[]>()

  const rssResults = await Promise.all(
    channelIds.map(async channelId => {
      const videoIds = await fetchVideoIdsFromRSS(channelId)
      return { channelId, videoIds }
    })
  )

  rssResults.forEach(({ channelId, videoIds }) => {
    if (videoIds.length > 0) {
      videoIdsMap.set(channelId, videoIds)
    }
  })

  console.log(`✅ Fetched RSS for ${videoIdsMap.size}/${channelIds.length} channels`)

  // 2. すべての動画IDをまとめる
  const allVideoIds: string[] = []
  videoIdsMap.forEach(videoIds => {
    allVideoIds.push(...videoIds)
  })

  console.log(`📹 Total videos to check: ${allVideoIds.length}`)
  console.log(`💰 Estimated API cost: ${Math.ceil(allVideoIds.length / 50)} units\n`)

  // 3. videos:list で確認
  console.log('🔎 Checking live streaming status...')
  const videoDetailsMap = await fetchVideoDetails(allVideoIds, apiKey)

  // 4. 結果を集計
  const liveChannels: Array<{ streamer: Streamer; video: VideoDetails }> = []

  streamers.forEach(streamer => {
    const videoIds = videoIdsMap.get(streamer.youtube_channel_id) || []

    for (const videoId of videoIds) {
      const video = videoDetailsMap.get(videoId)
      if (video && video.isLive) {
        liveChannels.push({ streamer, video })
        break // 1チャンネルにつき1つのライブのみ表示
      }
    }
  })

  // 5. 結果表示
  console.log('\n' + '='.repeat(60))
  console.log('📊 RESULTS')
  console.log('='.repeat(60))

  console.log(`\n🔴 Currently Live: ${liveChannels.length} channel(s)`)

  if (liveChannels.length > 0) {
    console.log('\nLive Streams:')
    liveChannels.forEach(({ streamer, video }, index) => {
      console.log(`\n${index + 1}. ${streamer.name}`)
      console.log(`   Channel ID: ${streamer.youtube_channel_id}`)
      console.log(`   Video: ${video.title}`)
      console.log(`   Video ID: ${video.id}`)
      if (video.concurrentViewers !== undefined) {
        console.log(`   👥 Viewers: ${video.concurrentViewers.toLocaleString()}`)
      }
      console.log(`   🕐 Started: ${video.actualStartTime}`)
    })
  }

  console.log(`\n⚪ Not Live: ${streamers.length - liveChannels.length} channel(s)`)

  console.log('\n' + '='.repeat(60))
  console.log('✅ Test completed')
  console.log(`📊 Summary:`)
  console.log(`   - Total channels: ${streamers.length}`)
  console.log(`   - RSS fetched: ${videoIdsMap.size}`)
  console.log(`   - Videos checked: ${allVideoIds.length}`)
  console.log(`   - Live streams found: ${liveChannels.length}`)
  console.log(`   - API units used: ~${Math.ceil(allVideoIds.length / 50)}`)

  process.exit(0)
}

main().catch(error => {
  console.error('❌ Error:', error)
  process.exit(1)
})
