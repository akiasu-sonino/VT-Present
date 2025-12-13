#!/usr/bin/env tsx
/**
 * RSS + videos:list でライブ配信を検出するテストスクリプト
 *
 * 使い方:
 * tsx tools/test-rss-live-detection.ts <CHANNEL_ID> [CHANNEL_ID2] [CHANNEL_ID3]
 *
 * 例:
 * tsx tools/test-rss-live-detection.ts UCxxxxxxxxxxxxxxxxxxxxxx
 */

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
    console.log(`\n[RSS] Fetching: ${rssUrl}`)

    const response = await fetch(rssUrl)
    if (!response.ok) {
      console.error(`❌ RSS fetch failed: ${response.status} ${response.statusText}`)
      return []
    }

    const xmlText = await response.text()

    // <yt:videoId>VIDEO_ID</yt:videoId> を正規表現で抽出
    const videoIdMatches = xmlText.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)
    const videoIds: string[] = []

    for (const match of videoIdMatches) {
      videoIds.push(match[1])
      if (videoIds.length >= 3) break // 最新3件まで
    }

    console.log(`✅ Found ${videoIds.length} videos in RSS:`)
    videoIds.forEach((id, i) => console.log(`   ${i + 1}. ${id}`))

    return videoIds
  } catch (error) {
    console.error(`❌ RSS fetch error:`, error)
    return []
  }
}

/**
 * videos:list でライブ配信状態を確認
 */
async function fetchVideoDetails(videoIds: string[], apiKey: string): Promise<VideoDetails[]> {
  if (videoIds.length === 0) return []

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos')
    url.searchParams.set('part', 'snippet,liveStreamingDetails')
    url.searchParams.set('id', videoIds.join(','))
    url.searchParams.set('key', apiKey)

    console.log(`\n[YouTube API] Fetching video details for ${videoIds.length} videos`)

    const response = await fetch(url.toString())
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ API error: ${response.status}`)
      console.error(errorText)
      return []
    }

    const data = await response.json()
    const results: VideoDetails[] = []

    for (const item of data.items || []) {
      const liveDetails = item.liveStreamingDetails
      const isLive = !!liveDetails?.actualStartTime && !liveDetails.actualEndTime

      results.push({
        id: item.id,
        title: item.snippet?.title || '',
        channelId: item.snippet?.channelId || '',
        isLive,
        actualStartTime: liveDetails?.actualStartTime,
        actualEndTime: liveDetails?.actualEndTime,
        concurrentViewers: liveDetails?.concurrentViewers ? parseInt(liveDetails.concurrentViewers, 10) : undefined
      })
    }

    return results
  } catch (error) {
    console.error(`❌ API fetch error:`, error)
    return []
  }
}

/**
 * メイン処理
 */
async function main() {
  const channelIds = process.argv.slice(2)

  if (channelIds.length === 0) {
    console.error('❌ Usage: tsx tools/test-rss-live-detection.ts <CHANNEL_ID> [CHANNEL_ID2] ...')
    console.error('\nExample:')
    console.error('  tsx tools/test-rss-live-detection.ts UCxxxxxxxxxxxxxxxxxxxxxx')
    process.exit(1)
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    console.error('❌ YOUTUBE_API_KEY environment variable is not set')
    console.error('Please set it in your .env file or export it:')
    console.error('  export YOUTUBE_API_KEY=your_api_key')
    process.exit(1)
  }

  console.log('🔍 YouTube Live Stream Detection Test')
  console.log('=' .repeat(60))
  console.log(`Testing ${channelIds.length} channel(s)`)

  for (const channelId of channelIds) {
    console.log('\n' + '='.repeat(60))
    console.log(`📺 Channel: ${channelId}`)
    console.log('='.repeat(60))

    // 1. RSSから最新動画を取得
    const videoIds = await fetchVideoIdsFromRSS(channelId)

    if (videoIds.length === 0) {
      console.log('⚠️  No videos found in RSS feed')
      continue
    }

    // 2. videos:list でライブ配信状態を確認
    const videoDetails = await fetchVideoDetails(videoIds, apiKey)

    // 3. 結果を表示
    console.log(`\n📊 Results:`)
    console.log('-'.repeat(60))

    let foundLive = false
    for (const video of videoDetails) {
      console.log(`\n🎬 Video: ${video.title}`)
      console.log(`   ID: ${video.id}`)
      console.log(`   Channel: ${video.channelId}`)

      // デバッグ情報
      console.log(`   🔍 Debug:`)
      console.log(`      actualStartTime: ${video.actualStartTime || 'N/A'}`)
      console.log(`      actualEndTime: ${video.actualEndTime === undefined ? 'undefined' : video.actualEndTime === null ? 'null' : video.actualEndTime}`)
      console.log(`      concurrentViewers: ${video.concurrentViewers || 'N/A'}`)

      if (video.isLive) {
        console.log(`   🔴 LIVE STATUS: Currently streaming!`)
        if (video.concurrentViewers !== undefined) {
          console.log(`   👥 Viewers: ${video.concurrentViewers.toLocaleString()}`)
        }
        console.log(`   🕐 Started: ${video.actualStartTime}`)
        foundLive = true
      } else if (video.actualStartTime && video.actualEndTime) {
        console.log(`   ⚫ LIVE STATUS: Stream ended`)
        console.log(`   🕐 Started: ${video.actualStartTime}`)
        console.log(`   🕑 Ended: ${video.actualEndTime}`)
      } else if (video.actualStartTime) {
        console.log(`   ⚠️  LIVE STATUS: Has actualStartTime but not detected as live`)
        console.log(`   🕐 Started: ${video.actualStartTime}`)
      } else {
        console.log(`   📹 LIVE STATUS: Regular video (not a stream)`)
      }
    }

    if (foundLive) {
      console.log(`\n✅ Live stream detected for channel ${channelId}!`)
    } else {
      console.log(`\n⚪ No live streams currently for channel ${channelId}`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ Test completed')
}

main().catch(console.error)
