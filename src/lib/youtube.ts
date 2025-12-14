/* eslint-disable no-console */
/**
 * YouTube Data API v3 ヘルパー
 * RSS + videos:list でライブ配信を低コスト検知（5分ポーリング）
 */

export interface LiveStreamInfo {
  channelId: string
  isLive: boolean
  viewerCount?: number
  videoId?: string
  title?: string
  liveStreamId?: string
  lastCheckedAt?: number
}

interface YouTubeVideosResponse {
  items?: Array<{
    id: string
    snippet?: {
      title?: string
      channelId?: string
    }
    liveStreamingDetails?: {
      actualStartTime?: string
      actualEndTime?: string | null
      concurrentViewers?: string
    }
  }>
}

const RSS_MAX_VIDEOS = 3 // RSSから取得する最新動画数
const VIDEOS_BATCH_SIZE = 50
const FETCH_TIMEOUT_MS = 10000 // 10秒でタイムアウト
const MAX_RETRIES = 2 // 最大リトライ回数

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * タイムアウト付きfetch
 */
async function fetchWithTimeout(url: string, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Fetch timeout after ${timeoutMs}ms: ${url}`)
    }
    throw error
  }
}

/**
 * RSSフィードから最新動画IDを取得（無料・レート制限なし）
 * @param channelId YouTubeチャンネルID
 * @returns 最新動画IDの配列（最大RSS_MAX_VIDEOS件）
 */
async function fetchVideoIdsFromRSS(channelId: string, retryCount = 0): Promise<string[]> {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    const response = await fetchWithTimeout(rssUrl)

    if (!response.ok) {
      console.error('[YouTube RSS] Failed to fetch RSS feed', {
        channelId,
        status: response.status,
        statusText: response.statusText
      })

      // 5xx エラーの場合はリトライ
      if (response.status >= 500 && retryCount < MAX_RETRIES) {
        console.log(`[YouTube RSS] Retrying (${retryCount + 1}/${MAX_RETRIES}) for channel ${channelId}`)
        await delay(1000 * (retryCount + 1)) // 指数バックオフ
        return fetchVideoIdsFromRSS(channelId, retryCount + 1)
      }

      return []
    }

    const xmlText = await response.text()

    // <yt:videoId>VIDEO_ID</yt:videoId> を正規表現で抽出
    const videoIdMatches = xmlText.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)
    const videoIds: string[] = []

    for (const match of videoIdMatches) {
      videoIds.push(match[1])
      if (videoIds.length >= RSS_MAX_VIDEOS) break
    }

    console.log(`[YouTube RSS] Successfully fetched ${videoIds.length} videos for channel ${channelId}`)
    return videoIds
  } catch (error) {
    console.error('[YouTube RSS] Error fetching RSS feed', {
      channelId,
      error: error instanceof Error ? error.message : String(error),
      retryCount
    })

    // タイムアウトやネットワークエラーの場合はリトライ
    if (retryCount < MAX_RETRIES) {
      console.log(`[YouTube RSS] Retrying (${retryCount + 1}/${MAX_RETRIES}) after error for channel ${channelId}`)
      await delay(1000 * (retryCount + 1))
      return fetchVideoIdsFromRSS(channelId, retryCount + 1)
    }

    return []
  }
}

/**
 * 全チャンネルのRSSフィードから最新動画IDを取得
 */
async function fetchLatestVideoIdsFromRSS(
  channelIds: string[]
): Promise<Map<string, string[]>> {
  const videoIdsMap = new Map<string, string[]>()

  // RSSは並列で取得可能（無料・レート制限なし）
  const results = await Promise.all(
    channelIds.map(async channelId => {
      const videoIds = await fetchVideoIdsFromRSS(channelId)
      return { channelId, videoIds }
    })
  )

  results.forEach(({ channelId, videoIds }) => {
    if (videoIds.length > 0) {
      videoIdsMap.set(channelId, videoIds)
    }
  })

  return videoIdsMap
}

/**
 * videos:list で動画のライブ配信状態を確認（1 unit/50 videos）
 */
async function fetchVideoLiveDetails(
  videoIds: string[],
  apiKey: string,
  retryCount = 0
): Promise<Map<string, { channelId: string; title: string; viewerCount?: number; isLive: boolean }>> {
  const liveVideosMap = new Map<string, { channelId: string; title: string; viewerCount?: number; isLive: boolean }>()

  for (let i = 0; i < videoIds.length; i += VIDEOS_BATCH_SIZE) {
    const batch = videoIds.slice(i, i + VIDEOS_BATCH_SIZE)
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/videos')
      url.searchParams.set('part', 'snippet,liveStreamingDetails')
      url.searchParams.set('id', batch.join(','))
      url.searchParams.set('key', apiKey)

      const response = await fetchWithTimeout(url.toString())
      if (!response.ok) {
        const errorText = await response.text()
        console.error('[YouTube API] videos:list error', {
          batchSize: batch.length,
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 200) // エラーメッセージを短縮
        })

        // 5xx エラーまたはレート制限（429）の場合はリトライ
        if ((response.status >= 500 || response.status === 429) && retryCount < MAX_RETRIES) {
          console.log(`[YouTube API] Retrying batch (${retryCount + 1}/${MAX_RETRIES})`)
          await delay(2000 * (retryCount + 1)) // 指数バックオフ
          const retryResult = await fetchVideoLiveDetails(batch, apiKey, retryCount + 1)
          retryResult.forEach((value, key) => liveVideosMap.set(key, value))
          continue
        }

        continue
      }

      const data: YouTubeVideosResponse = await response.json()
      console.log(`[YouTube API] Successfully fetched ${data.items?.length || 0} video details from batch of ${batch.length}`)

      data.items?.forEach(item => {
        const liveDetails = item.liveStreamingDetails
        // actualStartTimeがあり、actualEndTimeがない（undefined/null）なら配信中
        const isLive = !!liveDetails?.actualStartTime && !liveDetails.actualEndTime

        if (isLive && item.snippet?.channelId) {
          liveVideosMap.set(item.id, {
            channelId: item.snippet.channelId,
            title: item.snippet.title || '',
            viewerCount: liveDetails?.concurrentViewers ? parseInt(liveDetails.concurrentViewers, 10) : undefined,
            isLive: true
          })
          console.log(`[YouTube API] Found live stream: ${item.snippet.title} (${item.id})`)
        }
      })
    } catch (error) {
      console.error('[YouTube API] Failed to fetch video details', {
        batchSize: batch.length,
        error: error instanceof Error ? error.message : String(error),
        retryCount
      })

      // タイムアウトやネットワークエラーの場合はリトライ
      if (retryCount < MAX_RETRIES) {
        console.log(`[YouTube API] Retrying batch after error (${retryCount + 1}/${MAX_RETRIES})`)
        await delay(2000 * (retryCount + 1))
        const retryResult = await fetchVideoLiveDetails(batch, apiKey, retryCount + 1)
        retryResult.forEach((value, key) => liveVideosMap.set(key, value))
        continue
      }
    }

    if (i + VIDEOS_BATCH_SIZE < videoIds.length) {
      await delay(100)
    }
  }

  return liveVideosMap
}

/**
 * チャンネルIDのリストからライブ配信状態を取得
 * RSS で最新動画を取得 → videos:list でライブ配信状態を確認
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

  console.log(`[YouTube] Polling for ${channelIds.length} channels (RSS -> videos)`)
  const startTime = Date.now()

  // 1. RSSフィードから各チャンネルの最新動画を取得（無料）
  const videoIdsMap = await fetchLatestVideoIdsFromRSS(channelIds)

  // 2. すべての動画IDをまとめる
  const allVideoIds: string[] = []
  videoIdsMap.forEach(videoIds => {
    allVideoIds.push(...videoIds)
  })

  const rssTime = Date.now() - startTime
  console.log(`[YouTube] Fetched ${allVideoIds.length} videos from ${videoIdsMap.size}/${channelIds.length} channels via RSS (${rssTime}ms)`)

  // 3. videos:list でライブ配信状態を確認（1 unit/50 videos）
  const apiStartTime = Date.now()
  const liveVideosMap = allVideoIds.length > 0
    ? await fetchVideoLiveDetails(allVideoIds, apiKey)
    : new Map()

  const apiTime = Date.now() - apiStartTime
  const totalTime = Date.now() - startTime
  console.log(`[YouTube] Found ${liveVideosMap.size} live streams (API: ${apiTime}ms, Total: ${totalTime}ms)`)

  // 4. チャンネルごとにライブ配信状態を構築
  const now = Date.now()
  return channelIds.map(channelId => {
    // このチャンネルの動画IDリストを取得
    const channelVideoIds = videoIdsMap.get(channelId) || []

    // ライブ配信中の動画を探す
    for (const videoId of channelVideoIds) {
      const liveVideo = liveVideosMap.get(videoId)
      if (liveVideo && liveVideo.channelId === channelId) {
        return {
          channelId,
          isLive: true,
          videoId,
          title: liveVideo.title,
          viewerCount: liveVideo.viewerCount,
          liveStreamId: videoId,
          lastCheckedAt: now
        }
      }
    }

    return {
      channelId,
      isLive: false,
      lastCheckedAt: now
    }
  })
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
