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

  // チャンネルIDを10個ずつバッチ処理（APIクォータ節約）
  // バッチサイズを大きくして、並列リクエスト回数を削減
  const batchSize = 10
  for (let i = 0; i < channelIds.length; i += batchSize) {
    const batch = channelIds.slice(i, i + batchSize)

    // 各チャンネルのライブ配信を検索
    const batchResults = await Promise.all(
      batch.map(channelId => checkChannelLiveStatus(channelId, apiKey))
    )

    results.push(...batchResults)

    // バッチ間に少し待機（レート制限対策）
    if (i + batchSize < channelIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
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
      const errorText = await searchResponse.text()
      console.error(`YouTube API search error for channel ${channelId}:`, {
        status: searchResponse.status,
        statusText: searchResponse.statusText,
        error: errorText
      })
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

    // YouTube APIクォータ節約のため、視聴者数の取得をスキップ
    // Videos APIは1ユニット消費するが、頻繁な呼び出しでクォータを消費する
    return {
      channelId,
      isLive: true,
      videoId,
      title,
      // viewerCountは取得しない（APIクォータ節約）
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
