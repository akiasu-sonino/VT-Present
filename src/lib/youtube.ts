/* eslint-disable no-console */
/**
 * YouTube Data API v3 ヘルパー
 * RSS Feed + Videos API方式でクォータを大幅削減
 */

export interface LiveStreamInfo {
  channelId: string
  isLive: boolean
  viewerCount?: number
  videoId?: string
  title?: string
}

interface YouTubeVideosResponse {
  items?: Array<{
    id: string
    snippet: {
      channelId: string
      title: string
      liveBroadcastContent: 'live' | 'upcoming' | 'none'
    }
    liveStreamingDetails?: {
      concurrentViewers?: string
    }
  }>
}

interface RSSFeedEntry {
  videoId: string
  title: string
}

/**
 * RSS Feedから最新動画IDを取得（APIクォータ不使用）
 * @param channelId YouTubeチャンネルID
 * @returns 動画IDの配列（最大15件）
 */
async function getVideoIdsFromRSS(channelId: string): Promise<RSSFeedEntry[]> {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    const response = await fetch(rssUrl)

    if (!response.ok) {
      console.error(`RSS fetch error for channel ${channelId}:`, response.status)
      return []
    }

    const xmlText = await response.text()

    // XMLから動画IDとタイトルを抽出（シンプルな正規表現）
    const videoIdMatches = xmlText.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)
    const titleMatches = xmlText.matchAll(/<media:title>([^<]+)<\/media:title>/g)

    const videoIds = Array.from(videoIdMatches).map(m => m[1])
    const titles = Array.from(titleMatches).map(m => m[1])

    return videoIds.map((videoId, index) => ({
      videoId,
      title: titles[index] || ''
    }))
  } catch (error) {
    console.error(`Error fetching RSS for channel ${channelId}:`, error)
    return []
  }
}

/**
 * Videos APIで動画のライブ配信状態を一括チェック（1 unit/最大50動画）
 * @param videoIds 動画IDの配列
 * @param apiKey YouTube Data API v3 APIキー
 * @returns ライブ配信情報のMap
 */
async function checkVideosLiveStatus(
  videoIds: string[],
  apiKey: string
): Promise<Map<string, LiveStreamInfo>> {
  const resultMap = new Map<string, LiveStreamInfo>()

  if (!videoIds.length) return resultMap

  // Videos APIは最大50個の動画IDを一括取得可能（1 unit）
  const batchSize = 50
  for (let i = 0; i < videoIds.length; i += batchSize) {
    const batch = videoIds.slice(i, i + batchSize)

    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/videos')
      url.searchParams.set('part', 'snippet,liveStreamingDetails')
      url.searchParams.set('id', batch.join(','))
      url.searchParams.set('key', apiKey)

      const response = await fetch(url.toString())

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Videos API error:', {
          status: response.status,
          error: errorText
        })
        continue
      }

      const data: YouTubeVideosResponse = await response.json()

      if (data.items) {
        for (const item of data.items) {
          const isLive = item.snippet.liveBroadcastContent === 'live'
          const channelId = item.snippet.channelId

          resultMap.set(channelId, {
            channelId,
            isLive,
            videoId: isLive ? item.id : undefined,
            title: isLive ? item.snippet.title : undefined,
            viewerCount: item.liveStreamingDetails?.concurrentViewers
              ? parseInt(item.liveStreamingDetails.concurrentViewers)
              : undefined
          })
        }
      }
    } catch (error) {
      console.error('Error checking videos live status:', error)
    }

    // バッチ間に少し待機（レート制限対策）
    if (i + batchSize < videoIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return resultMap
}

/**
 * チャンネルIDのリストからライブ配信状態を取得
 * RSS Feed + Videos API方式（クォータ大幅削減）
 * @param channelIds YouTubeチャンネルIDの配列
 * @param apiKey YouTube Data API v3 APIキー
 * @returns ライブ配信情報の配列
 */
export async function getLiveStreamStatus(
  channelIds: string[],
  apiKey: string
): Promise<LiveStreamInfo[]> {
  if (!channelIds.length || !apiKey) {
    return []
  }

  const results: LiveStreamInfo[] = []
  const allVideoIds: string[] = []
  const channelVideoMap = new Map<string, string[]>() // channelId -> videoIds

  // 1. 各チャンネルのRSS Feedから動画IDを取得（並列処理、0 units）
  const batchSize = 10
  for (let i = 0; i < channelIds.length; i += batchSize) {
    const batch = channelIds.slice(i, i + batchSize)

    const rssResults = await Promise.all(
      batch.map(async channelId => {
        const entries = await getVideoIdsFromRSS(channelId)
        return { channelId, entries }
      })
    )

    for (const { channelId, entries } of rssResults) {
      const videoIds = entries.map(e => e.videoId)
      channelVideoMap.set(channelId, videoIds)
      allVideoIds.push(...videoIds)
    }
  }

  console.log(`[YouTube] Fetched ${allVideoIds.length} video IDs from ${channelIds.length} channels via RSS`)

  // 2. Videos APIで全動画のライブ状態を一括チェック（約1 unit/50動画）
  const liveStatusMap = await checkVideosLiveStatus(allVideoIds, apiKey)

  // 3. チャンネルごとの結果を構築
  for (const channelId of channelIds) {
    const liveInfo = liveStatusMap.get(channelId)

    if (liveInfo) {
      results.push(liveInfo)
    } else {
      // ライブ配信していない
      results.push({
        channelId,
        isLive: false
      })
    }
  }

  return results
}

/**
 * 視聴者数をフォーマット
 * @param count 視聴者数
 * @returns フォーマットされた文字列（例: "1.2K", "10.5K"）
 */
export function formatViewerCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`
  }
  return count.toString()
}
