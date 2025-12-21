/* eslint-disable no-console */
/**
 * Twitch Helix API ヘルパー
 * ライブ配信状態の検知を行う
 */

export interface TwitchLiveStreamInfo {
  twitchUserId: string
  isLive: boolean
  viewerCount?: number
  streamId?: string
  title?: string
  gameName?: string
  thumbnailUrl?: string
  startedAt?: string
  lastCheckedAt?: number
}

interface TwitchTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

interface TwitchStream {
  id: string
  user_id: string
  user_login: string
  user_name: string
  game_id: string
  game_name: string
  type: 'live' | ''
  title: string
  viewer_count: number
  started_at: string
  language: string
  thumbnail_url: string
  is_mature: boolean
}

interface TwitchStreamsResponse {
  data: TwitchStream[]
  pagination?: {
    cursor?: string
  }
}

interface TwitchUser {
  id: string
  login: string
  display_name: string
  type: string
  broadcaster_type: string
  description: string
  profile_image_url: string
  offline_image_url: string
  view_count: number
  created_at: string
}

interface TwitchUsersResponse {
  data: TwitchUser[]
}

interface TwitchFollowersResponse {
  total: number
  data: Array<{
    user_id: string
    user_name: string
    user_login: string
    followed_at: string
  }>
  pagination?: {
    cursor?: string
  }
}

const FETCH_TIMEOUT_MS = 10000
const MAX_RETRIES = 2
const USERS_BATCH_SIZE = 100 // Twitch APIは1リクエストで最大100ユーザー

// トークンキャッシュ（メモリ内）
let cachedToken: { token: string; expiresAt: number } | null = null

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * タイムアウト付きfetch
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
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
 * Twitch OAuth2 Client Credentials フローでアクセストークンを取得
 * トークンは約60日間有効だが、有効期限が近づいたら更新
 */
export async function getTwitchAccessToken(
  clientId: string,
  clientSecret: string
): Promise<string> {
  // キャッシュされたトークンが有効ならそれを使用
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token
  }

  console.log('[Twitch] Fetching new access token')

  const url = new URL('https://id.twitch.tv/oauth2/token')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('client_secret', clientSecret)
  url.searchParams.set('grant_type', 'client_credentials')

  const response = await fetchWithTimeout(url.toString(), {
    method: 'POST'
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Twitch OAuth error: ${response.status} ${errorText}`)
  }

  const data: TwitchTokenResponse = await response.json()

  // トークンをキャッシュ
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000
  }

  console.log('[Twitch] Access token obtained successfully')
  return data.access_token
}

/**
 * Twitchユーザー名からユーザー情報を取得
 */
export async function getTwitchUserByLogin(
  login: string,
  clientId: string,
  accessToken: string
): Promise<TwitchUser | null> {
  const url = new URL('https://api.twitch.tv/helix/users')
  url.searchParams.set('login', login.toLowerCase())

  const response = await fetchWithTimeout(url.toString(), {
    headers: {
      'Client-ID': clientId,
      'Authorization': `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    console.error('[Twitch] Failed to fetch user', {
      login,
      status: response.status
    })
    return null
  }

  const data: TwitchUsersResponse = await response.json()
  return data.data[0] || null
}

/**
 * TwitchユーザーIDからユーザー情報を取得（バッチ対応）
 */
export async function getTwitchUsersByIds(
  userIds: string[],
  clientId: string,
  accessToken: string
): Promise<TwitchUser[]> {
  if (userIds.length === 0) return []

  const allUsers: TwitchUser[] = []

  // 100件ずつバッチ処理
  for (let i = 0; i < userIds.length; i += USERS_BATCH_SIZE) {
    const batch = userIds.slice(i, i + USERS_BATCH_SIZE)
    const url = new URL('https://api.twitch.tv/helix/users')
    batch.forEach(id => url.searchParams.append('id', id))

    const response = await fetchWithTimeout(url.toString(), {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (response.ok) {
      const data: TwitchUsersResponse = await response.json()
      allUsers.push(...data.data)
    }

    if (i + USERS_BATCH_SIZE < userIds.length) {
      await delay(50) // レート制限対策
    }
  }

  return allUsers
}

/**
 * Twitchチャンネルのフォロワー数を取得
 */
export async function getTwitchFollowerCount(
  broadcasterId: string,
  clientId: string,
  accessToken: string
): Promise<number> {
  const url = new URL('https://api.twitch.tv/helix/channels/followers')
  url.searchParams.set('broadcaster_id', broadcasterId)
  url.searchParams.set('first', '1') // 総数だけ必要

  const response = await fetchWithTimeout(url.toString(), {
    headers: {
      'Client-ID': clientId,
      'Authorization': `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    console.error('[Twitch] Failed to fetch follower count', {
      broadcasterId,
      status: response.status
    })
    return 0
  }

  const data: TwitchFollowersResponse = await response.json()
  return data.total
}

/**
 * 複数のTwitchユーザーIDのライブ配信状態を取得
 * Twitch APIは1リクエストで最大100ユーザーまで確認可能
 */
async function fetchTwitchStreams(
  userIds: string[],
  clientId: string,
  accessToken: string,
  retryCount = 0
): Promise<Map<string, TwitchStream>> {
  const streamsMap = new Map<string, TwitchStream>()

  for (let i = 0; i < userIds.length; i += USERS_BATCH_SIZE) {
    const batch = userIds.slice(i, i + USERS_BATCH_SIZE)

    try {
      const url = new URL('https://api.twitch.tv/helix/streams')
      batch.forEach(id => url.searchParams.append('user_id', id))

      const response = await fetchWithTimeout(url.toString(), {
        headers: {
          'Client-ID': clientId,
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Twitch API] streams error', {
          batchSize: batch.length,
          status: response.status,
          error: errorText.substring(0, 200)
        })

        // 5xx または 429 の場合はリトライ
        if ((response.status >= 500 || response.status === 429) && retryCount < MAX_RETRIES) {
          console.log(`[Twitch API] Retrying batch (${retryCount + 1}/${MAX_RETRIES})`)
          await delay(2000 * (retryCount + 1))
          const retryResult = await fetchTwitchStreams(batch, clientId, accessToken, retryCount + 1)
          retryResult.forEach((stream, id) => streamsMap.set(id, stream))
          continue
        }

        continue
      }

      const data: TwitchStreamsResponse = await response.json()
      console.log(`[Twitch API] Found ${data.data.length} live streams from batch of ${batch.length}`)

      data.data.forEach(stream => {
        if (stream.type === 'live') {
          streamsMap.set(stream.user_id, stream)
          console.log(`[Twitch API] Found live stream: ${stream.user_name} - ${stream.title}`)
        }
      })
    } catch (error) {
      console.error('[Twitch API] Failed to fetch streams', {
        batchSize: batch.length,
        error: error instanceof Error ? error.message : String(error),
        retryCount
      })

      if (retryCount < MAX_RETRIES) {
        console.log(`[Twitch API] Retrying batch after error (${retryCount + 1}/${MAX_RETRIES})`)
        await delay(2000 * (retryCount + 1))
        const retryResult = await fetchTwitchStreams(batch, clientId, accessToken, retryCount + 1)
        retryResult.forEach((stream, id) => streamsMap.set(id, stream))
        continue
      }
    }

    if (i + USERS_BATCH_SIZE < userIds.length) {
      await delay(50)
    }
  }

  return streamsMap
}

/**
 * TwitchユーザーIDのリストからライブ配信状態を取得
 * @param userIds TwitchユーザーIDの配列
 * @param clientId Twitch Client ID
 * @param clientSecret Twitch Client Secret
 * @returns ライブ配信情報の配列
 */
export async function getTwitchLiveStreamStatus(
  userIds: string[],
  clientId: string,
  clientSecret: string
): Promise<TwitchLiveStreamInfo[]> {
  if (!userIds.length || !clientId || !clientSecret) {
    return []
  }

  console.log(`[Twitch] Polling for ${userIds.length} users`)
  const startTime = Date.now()

  // アクセストークンを取得
  const accessToken = await getTwitchAccessToken(clientId, clientSecret)

  // ライブ配信状態を取得
  const streamsMap = await fetchTwitchStreams(userIds, clientId, accessToken)

  const totalTime = Date.now() - startTime
  console.log(`[Twitch] Found ${streamsMap.size} live streams (${totalTime}ms)`)

  // 結果を構築
  const now = Date.now()
  return userIds.map(userId => {
    const stream = streamsMap.get(userId)

    if (stream) {
      return {
        twitchUserId: userId,
        isLive: true,
        viewerCount: stream.viewer_count,
        streamId: stream.id,
        title: stream.title,
        gameName: stream.game_name,
        thumbnailUrl: stream.thumbnail_url
          .replace('{width}', '320')
          .replace('{height}', '180'),
        startedAt: stream.started_at,
        lastCheckedAt: now
      }
    }

    return {
      twitchUserId: userId,
      isLive: false,
      lastCheckedAt: now
    }
  })
}

/**
 * 視聴者数をフォーマット
 */
export function formatViewerCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`
  }
  return count.toString()
}
