/* eslint-disable no-console */
/**
 * YouTube Data API v3 ヘルパー
 * activities:list + channels:list でライブ配信を低コスト検知（1時間ポーリング）
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

interface YouTubeActivitiesResponse {
  items?: Array<{
    snippet?: {
      type?: string
      title?: string
      publishedAt?: string
    }
  }>
}

interface YouTubeChannelsResponse {
  items?: Array<{
    id: string
    contentDetails?: {
      relatedPlaylists?: {
        liveStream?: string
      }
    }
  }>
}

const ACTIVITY_BATCH_SIZE = 10
const CHANNEL_BATCH_SIZE = 50

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * activities:list で直近アクティビティが live か確認（1 unit）
 */
async function fetchLatestLiveActivities(
  channelIds: string[],
  apiKey: string
): Promise<Map<string, { title?: string }>> {
  const liveActivityMap = new Map<string, { title?: string }>()

  for (let i = 0; i < channelIds.length; i += ACTIVITY_BATCH_SIZE) {
    const batch = channelIds.slice(i, i + ACTIVITY_BATCH_SIZE)

    const batchResults = await Promise.all(
      batch.map(async channelId => {
        try {
          const url = new URL('https://www.googleapis.com/youtube/v3/activities')
          url.searchParams.set('part', 'snippet')
          url.searchParams.set('channelId', channelId)
          url.searchParams.set('maxResults', '1')
          url.searchParams.set('key', apiKey)

          const response = await fetch(url.toString())
          if (!response.ok) {
            const errorText = await response.text()
            console.error('[YouTube] activities:list error', {
              channelId,
              status: response.status,
              error: errorText
            })
            return null
          }

          const data: YouTubeActivitiesResponse = await response.json()
          const activity = data.items?.[0]
          const isLive = activity?.snippet?.type === 'live'

          if (isLive) {
            return {
              channelId,
              title: activity?.snippet?.title
            }
          }
        } catch (error) {
          console.error('[YouTube] Failed to fetch activities', { channelId, error })
        }
        return null
      })
    )

    batchResults.forEach(result => {
      if (result) {
        liveActivityMap.set(result.channelId, { title: result.title })
      }
    })

    if (i + ACTIVITY_BATCH_SIZE < channelIds.length) {
      await delay(100)
    }
  }

  return liveActivityMap
}

/**
 * channels:list で liveStream プレイリストに現在のストリームIDがあるか確認（1 unit）
 */
async function fetchLiveStreamIds(
  channelIds: string[],
  apiKey: string
): Promise<Map<string, string>> {
  const liveStreamMap = new Map<string, string>()

  for (let i = 0; i < channelIds.length; i += CHANNEL_BATCH_SIZE) {
    const batch = channelIds.slice(i, i + CHANNEL_BATCH_SIZE)
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/channels')
      url.searchParams.set('part', 'contentDetails')
      url.searchParams.set('id', batch.join(','))
      url.searchParams.set('key', apiKey)

      const response = await fetch(url.toString())
      if (!response.ok) {
        const errorText = await response.text()
        console.error('[YouTube] channels:list error', {
          channelIds: batch,
          status: response.status,
          error: errorText
        })
        continue
      }

      const data: YouTubeChannelsResponse = await response.json()
      data.items?.forEach(item => {
        const liveStreamId = item.contentDetails?.relatedPlaylists?.liveStream
        if (liveStreamId) {
          liveStreamMap.set(item.id, liveStreamId)
        }
      })
    } catch (error) {
      console.error('[YouTube] Failed to fetch channel details', { channelIds: batch, error })
    }

    if (i + CHANNEL_BATCH_SIZE < channelIds.length) {
      await delay(100)
    }
  }

  return liveStreamMap
}

/**
 * チャンネルIDのリストからライブ配信状態を取得
 * activities:list で検知 → channels:list で確定（各1 unit）
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

  console.log(`[YouTube] Hourly polling for ${channelIds.length} channels (activities -> channels)`)

  // 1. activities:list で最新アクティビティが live か判定（1 unit）
  const liveActivities = await fetchLatestLiveActivities(channelIds, apiKey)
  const channelsToConfirm = Array.from(liveActivities.keys())

  // 2. live アクティビティがあったチャンネルのみ channels:list で liveStream を確認（1 unit）
  const confirmedLiveStreams = channelsToConfirm.length
    ? await fetchLiveStreamIds(channelsToConfirm, apiKey)
    : new Map<string, string>()

  // 3. 結果構築（ステータスをキャッシュしやすい形にする）
  const now = Date.now()
  return channelIds.map(channelId => {
    const liveStreamId = confirmedLiveStreams.get(channelId)
    const activityMeta = liveActivities.get(channelId)

    if (liveStreamId) {
      return {
        channelId,
        isLive: true,
        videoId: liveStreamId,
        liveStreamId,
        title: activityMeta?.title,
        lastCheckedAt: now
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
