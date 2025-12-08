/**
 * YouTube Data API v3 ヘルパー
 */

export interface LiveStreamInfo {
  channelId: string
  isLive: boolean
  viewerCount?: number
  videoId?: string
  title?: string
}

interface YouTubeSearchResponse {
  items?: Array<{
    id: {
      kind: string
      videoId: string
    }
    snippet: {
      channelId: string
      title: string
      liveBroadcastContent: string
    }
  }>
}

interface YouTubeVideoResponse {
  items?: Array<{
    id: string
    liveStreamingDetails?: {
      concurrentViewers?: string
    }
  }>
}

/**
 * チャンネルIDのリストからライブ配信状態を取得
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

  // チャンネルIDを5個ずつバッチ処理（APIクォータ節約）
  const batchSize = 5
  for (let i = 0; i < channelIds.length; i += batchSize) {
    const batch = channelIds.slice(i, i + batchSize)

    // 各チャンネルのライブ配信を検索
    const batchResults = await Promise.all(
      batch.map(channelId => checkChannelLiveStatus(channelId, apiKey))
    )

    results.push(...batchResults)
  }

  return results
}

/**
 * 単一チャンネルのライブ配信状態をチェック
 */
async function checkChannelLiveStatus(
  channelId: string,
  apiKey: string
): Promise<LiveStreamInfo> {
  try {
    // Search APIでライブ配信を検索
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
    searchUrl.searchParams.set('part', 'snippet')
    searchUrl.searchParams.set('channelId', channelId)
    searchUrl.searchParams.set('eventType', 'live')
    searchUrl.searchParams.set('type', 'video')
    searchUrl.searchParams.set('key', apiKey)

    const searchResponse = await fetch(searchUrl.toString())

    if (!searchResponse.ok) {
      console.error(`YouTube API search error for channel ${channelId}:`, searchResponse.status)
      return { channelId, isLive: false }
    }

    const searchData: YouTubeSearchResponse = await searchResponse.json()

    // ライブ配信が見つからない場合
    if (!searchData.items || searchData.items.length === 0) {
      return { channelId, isLive: false }
    }

    const liveVideo = searchData.items[0]
    const videoId = liveVideo.id.videoId
    const title = liveVideo.snippet.title

    // Videos APIで視聴者数を取得
    const videoUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
    videoUrl.searchParams.set('part', 'liveStreamingDetails')
    videoUrl.searchParams.set('id', videoId)
    videoUrl.searchParams.set('key', apiKey)

    const videoResponse = await fetch(videoUrl.toString())

    if (!videoResponse.ok) {
      return {
        channelId,
        isLive: true,
        videoId,
        title,
      }
    }

    const videoData: YouTubeVideoResponse = await videoResponse.json()
    const viewerCount = videoData.items?.[0]?.liveStreamingDetails?.concurrentViewers
      ? parseInt(videoData.items[0].liveStreamingDetails.concurrentViewers)
      : undefined

    return {
      channelId,
      isLive: true,
      videoId,
      title,
      viewerCount,
    }
  } catch (error) {
    console.error(`Error checking live status for channel ${channelId}:`, error)
    return { channelId, isLive: false }
  }
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
