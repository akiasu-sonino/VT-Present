/* eslint-disable no-console */
/**
 * Data Cache Layer
 * NeonDBへのアクセスを最小限にするためのキャッシュレイヤー
 * - ストリーマーデータ：1時間キャッシュ
 * - ユーザーアクション：1時間キャッシュ
 * - ユーザー情報：1時間キャッシュ
 * - ユーザープリファレンス（スコア付き）：1時間キャッシュ
 * - ユーザー類似度：1時間キャッシュ
 * - ライブ配信状態：5分キャッシュ（RSS + Videos API）
 */

import { sql } from '@vercel/postgres'
import type { Streamer, AnonymousUser, PreferenceAction } from './db.js'
import type { LiveStreamInfo } from './youtube.js'

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

/**
 * データキャッシュマネージャー
 * Vercel Serverless環境でインスタンスごとにキャッシュを保持
 */
class DataCache {
  private streamersCache: CacheEntry<Streamer[]> | null = null
  private userActionsCache: Map<number, CacheEntry<number[]>> = new Map()
  private usersCache: Map<string, CacheEntry<AnonymousUser>> = new Map()
  private liveStatusCache: CacheEntry<Map<string, LiveStreamInfo>> | null = null
  private userPreferencesCache: Map<number, CacheEntry<Map<number, number>>> = new Map()
  private userSimilarityCache: Map<string, CacheEntry<number>> = new Map()

  private readonly TTL = 60 * 60 * 1000 // 1時間（ミリ秒）
  private readonly LIVE_STATUS_TTL = 5 * 60 * 1000 // 5分（ミリ秒） - YouTubeライブステータスは5分毎にポーリング

  /**
   * 全ストリーマーをキャッシュから取得
   * キャッシュが無効またはTTL切れの場合はDBから取得
   */
  async getStreamers(): Promise<Streamer[]> {
    // キャッシュが有効かチェック
    if (this.streamersCache && this.streamersCache.expiresAt > Date.now()) {
      console.log('[Cache] Using cached streamers data')
      return this.streamersCache.data
    }

    // DBから全件取得
    console.log('[Cache] Fetching streamers from DB (cache miss or expired)')
    const result = await sql<Streamer>`SELECT * FROM streamers`
    const streamers = result.rows

    // キャッシュを更新
    this.streamersCache = {
      data: streamers,
      expiresAt: Date.now() + this.TTL
    }

    console.log(`[Cache] Cached ${streamers.length} streamers for 1 hour`)
    return streamers
  }

  /**
   * キャッシュされたデータからランダムにストリーマーを1人取得
   * @param excludeIds 除外する配信者IDのリスト
   */
  async getRandomStreamer(excludeIds: number[] = []): Promise<Streamer | null> {
    const streamers = await this.getStreamers()
    const available = streamers.filter(s => !excludeIds.includes(s.id))

    if (available.length === 0) {
      return null
    }

    // ランダムに選択
    const randomIndex = Math.floor(Math.random() * available.length)
    return available[randomIndex]
  }

  /**
   * キャッシュされたデータからランダムに複数のストリーマーを取得
   * @param count 取得する配信者の数
   * @param excludeIds 除外する配信者IDのリスト
   * @param tags フィルタリングするタグ（指定された場合、いずれかのタグを含むストリーマーのみ）
   * @param query フリーワード検索クエリ
   * @param tagOperator タグ検索演算子（AND/OR）
   * @param minFollowers 最小フォロワー数
   * @param maxFollowers 最大フォロワー数
   * @param liveChannelIds ライブ中のチャンネルIDリスト（指定された場合、これらのチャンネルのみを返す）
   */
  async getRandomStreamers(
    count: number,
    excludeIds: number[] = [],
    tags: string[] = [],
    query?: string,
    tagOperator: 'OR' | 'AND' = 'OR',
    minFollowers?: number,
    maxFollowers?: number,
    liveChannelIds?: string[]
  ): Promise<Streamer[]> {
    const streamers = await this.getStreamers()
    let available = streamers.filter(s => !excludeIds.includes(s.id))

    // ライブ中のみフィルター（第一段階）
    if (liveChannelIds !== undefined) {
      available = available.filter(s =>
        s.youtube_channel_id && liveChannelIds.includes(s.youtube_channel_id)
      )
    }

    // フリーワード検索（配信者名、説明）
    if (query && query.trim()) {
      const searchTerm = query.trim().toLowerCase()
      available = available.filter(s => {
        const nameMatch = s.name?.toLowerCase().includes(searchTerm)
        const descMatch = s.description?.toLowerCase().includes(searchTerm)
        return nameMatch || descMatch
      })
    }

    // フォロワー数フィルター
    if (minFollowers !== undefined && minFollowers > 0) {
      available = available.filter(s => s.follower_count >= minFollowers)
    }
    if (maxFollowers !== undefined && maxFollowers < Number.MAX_SAFE_INTEGER) {
      available = available.filter(s => s.follower_count <= maxFollowers)
    }

    // タグでフィルタリング
    if (tags.length > 0) {
      if (tagOperator === 'AND') {
        // AND検索: すべてのタグを含むストリーマーのみ
        available = available.filter(s =>
          s.tags && tags.every(tag => s.tags.includes(tag))
        )
      } else {
        // OR検索: いずれかのタグを含むストリーマーのみ
        available = available.filter(s =>
          s.tags && s.tags.some(tag => tags.includes(tag))
        )
      }
    }

    // Fisher-Yatesアルゴリズムでシャッフル
    const shuffled = [...available]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    return shuffled.slice(0, count)
  }

  /**
   * キャッシュされたデータからIDでストリーマーを取得
   * @param id 配信者ID
   */
  async getStreamerById(id: number): Promise<Streamer | null> {
    const streamers = await this.getStreamers()
    return streamers.find(s => s.id === id) || null
  }

  /**
   * ユーザーがアクション済みの配信者IDリストをキャッシュから取得
   * @param userId 匿名ユーザーID
   */
  async getUserActionedStreamerIds(userId: number): Promise<number[]> {
    const cached = this.userActionsCache.get(userId)

    // キャッシュが有効かチェック
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`[Cache] Using cached user actions for user ${userId}`)
      return cached.data
    }

    // DBから取得
    console.log(`[Cache] Fetching user actions from DB for user ${userId}`)
    const result = await sql<{ streamer_id: number }>`
      SELECT DISTINCT streamer_id
      FROM preferences
      WHERE anonymous_user_id = ${userId}
    `
    const streamerIds = result.rows.map(row => row.streamer_id)

    // キャッシュを更新
    this.userActionsCache.set(userId, {
      data: streamerIds,
      expiresAt: Date.now() + this.TTL
    })

    console.log(`[Cache] Cached ${streamerIds.length} actions for user ${userId}`)
    return streamerIds
  }

  /**
   * ユーザーアクションをキャッシュに追加
   * プリファレンス記録時に呼び出される
   * @param userId 匿名ユーザーID
   * @param streamerId 配信者ID
   */
  addUserAction(userId: number, streamerId: number): void {
    const cached = this.userActionsCache.get(userId)

    if (cached) {
      // キャッシュがあれば追加（重複チェック）
      if (!cached.data.includes(streamerId)) {
        cached.data.push(streamerId)
        console.log(`[Cache] Added streamer ${streamerId} to user ${userId} actions cache`)
      }
    }
  }

  /**
   * ユーザーアクションをキャッシュから削除
   * プリファレンス削除時に呼び出される
   * @param userId 匿名ユーザーID
   * @param streamerId 配信者ID
   */
  removeUserAction(userId: number, streamerId: number): void {
    const cached = this.userActionsCache.get(userId)

    if (cached) {
      // キャッシュから削除
      const index = cached.data.indexOf(streamerId)
      if (index > -1) {
        cached.data.splice(index, 1)
        console.log(`[Cache] Removed streamer ${streamerId} from user ${userId} actions cache`)
      }
    }
  }

  /**
   * アクション別に配信者リストを取得
   * この関数は複雑なJOINが必要なため、DBから直接取得
   * （キャッシュ最適化の対象外）
   */
  async getStreamersByAction(
    userId: number,
    action?: PreferenceAction
  ): Promise<Streamer[]> {
    if (action) {
      const result = await sql<Streamer>`
        SELECT s.*, MAX(p.created_at) as last_action_at
        FROM streamers s
        INNER JOIN preferences p ON s.id = p.streamer_id
        WHERE p.anonymous_user_id = ${userId}
          AND p.action = ${action}
        GROUP BY s.id
        ORDER BY last_action_at DESC
      `
      return result.rows
    }

    // アクション指定なしの場合
    const result = await sql<Streamer>`
      SELECT s.*, MAX(p.created_at) as last_action_at
      FROM streamers s
      INNER JOIN preferences p ON s.id = p.streamer_id
      WHERE p.anonymous_user_id = ${userId}
      GROUP BY s.id
      ORDER BY last_action_at DESC
    `
    return result.rows
  }

  /**
   * ユーザー情報をキャッシュから取得
   * @param anonymousId 匿名ID（UUID）
   */
  getUser(anonymousId: string): AnonymousUser | null {
    const cached = this.usersCache.get(anonymousId)

    if (cached && cached.expiresAt > Date.now()) {
      console.log(`[Cache] Using cached user data for ${anonymousId}`)
      return cached.data
    }

    return null
  }

  /**
   * ユーザー情報をキャッシュに保存
   * @param anonymousId 匿名ID（UUID）
   * @param user ユーザー情報
   */
  setUser(anonymousId: string, user: AnonymousUser): void {
    this.usersCache.set(anonymousId, {
      data: user,
      expiresAt: Date.now() + this.TTL
    })
    console.log(`[Cache] Cached user data for ${anonymousId}`)
  }

  /**
   * 全ストリーマーから重複なしのタグ一覧を取得
   * キャッシュされたストリーマーデータから抽出
   */
  async getAllTags(): Promise<string[]> {
    const streamers = await this.getStreamers()
    const tagsSet = new Set<string>()

    streamers.forEach(streamer => {
      if (streamer.tags) {
        streamer.tags.forEach(tag => tagsSet.add(tag))
      }
    })

    return Array.from(tagsSet).sort()
  }

  /**
   * ライブ配信状態をキャッシュから取得
   */
  getLiveStatus(): Map<string, LiveStreamInfo> | null {
    if (this.liveStatusCache && this.liveStatusCache.expiresAt > Date.now()) {
      console.log('[Cache] Using cached live status data')
      return this.liveStatusCache.data
    }
    return null
  }

  /**
   * ライブ配信状態をキャッシュに保存（5分）
   */
  setLiveStatus(liveStatusMap: Map<string, LiveStreamInfo>): void {
    this.liveStatusCache = {
      data: liveStatusMap,
      expiresAt: Date.now() + this.LIVE_STATUS_TTL
    }
    console.log(`[Cache] Cached live status for ${liveStatusMap.size} channels (5 min TTL)`)
  }

  /**
   * ストリーマーキャッシュを無効化
   * タグの追加・削除時など、ストリーマーデータが更新された時に呼び出す
   */
  invalidate(): void {
    console.log('[Cache] Invalidating streamers cache')
    this.streamersCache = null
  }

  /**
   * ユーザープリファレンス（スコア付き）をキャッシュから取得
   * 協調フィルタリングで使用
   * @param userId 匿名ユーザーID
   * @returns Map<streamerId, score>
   */
  async getUserPreferences(userId: number): Promise<Map<number, number>> {
    const cached = this.userPreferencesCache.get(userId)

    if (cached && cached.expiresAt > Date.now()) {
      console.log(`[Cache] Using cached user preferences for user ${userId}`)
      return cached.data
    }

    // DBから取得（循環インポート回避のため直接SQLクエリ）
    console.log(`[Cache] Fetching user preferences from DB for user ${userId}`)
    const result = await sql<{ streamer_id: number; score: number }>`
      SELECT
        streamer_id,
        CASE
          WHEN action = 'LIKE' THEN 1.0
          WHEN action = 'SOSO' THEN 0.3
          WHEN action = 'DISLIKE' THEN -0.5
          ELSE 0.0
        END as score
      FROM preferences
      WHERE anonymous_user_id = ${userId}
    `

    const prefs = new Map<number, number>()
    for (const row of result.rows) {
      prefs.set(row.streamer_id, row.score)
    }

    // キャッシュに保存
    this.userPreferencesCache.set(userId, {
      data: prefs,
      expiresAt: Date.now() + this.TTL
    })

    console.log(`[Cache] Cached ${prefs.size} preferences for user ${userId}`)
    return prefs
  }

  /**
   * ユーザー類似度をキャッシュから取得
   * @param userId1 ユーザーID1
   * @param userId2 ユーザーID2
   * @returns 類似度スコア（キャッシュにない場合はnull）
   */
  getUserSimilarity(userId1: number, userId2: number): number | null {
    // キーを正規化（小さい方を先に）
    const key = userId1 < userId2 ? `${userId1}-${userId2}` : `${userId2}-${userId1}`
    const cached = this.userSimilarityCache.get(key)

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data
    }

    return null
  }

  /**
   * ユーザー類似度をキャッシュに保存
   * @param userId1 ユーザーID1
   * @param userId2 ユーザーID2
   * @param similarity 類似度スコア
   */
  setUserSimilarity(userId1: number, userId2: number, similarity: number): void {
    // キーを正規化（小さい方を先に）
    const key = userId1 < userId2 ? `${userId1}-${userId2}` : `${userId2}-${userId1}`
    this.userSimilarityCache.set(key, {
      data: similarity,
      expiresAt: Date.now() + this.TTL
    })
  }

  /**
   * 特定ユーザーのプリファレンスキャッシュを無効化
   * recordPreference/deletePreference時に呼び出す
   * @param userId 匿名ユーザーID
   */
  invalidateUserPreferences(userId: number): void {
    console.log(`[Cache] Invalidating user preferences cache for user ${userId}`)
    this.userPreferencesCache.delete(userId)
    // 類似度キャッシュも無効化（このユーザーを含むすべての類似度）
    const keysToDelete: string[] = []
    for (const key of this.userSimilarityCache.keys()) {
      if (key.startsWith(`${userId}-`) || key.endsWith(`-${userId}`)) {
        keysToDelete.push(key)
      }
    }
    keysToDelete.forEach(key => this.userSimilarityCache.delete(key))
  }

  /**
   * キャッシュの統計情報を取得（デバッグ用）
   */
  getStats(): {
    streamers: { cached: boolean; count: number; ttl: number }
    userActions: { count: number }
    users: { count: number }
    liveStatus: { cached: boolean; count: number; ttl: number }
    userPreferences: { count: number }
    userSimilarity: { count: number }
  } {
    return {
      streamers: {
        cached: !!this.streamersCache,
        count: this.streamersCache?.data.length || 0,
        ttl: this.streamersCache ? Math.max(0, this.streamersCache.expiresAt - Date.now()) : 0
      },
      userActions: {
        count: this.userActionsCache.size
      },
      users: {
        count: this.usersCache.size
      },
      liveStatus: {
        cached: !!this.liveStatusCache,
        count: this.liveStatusCache?.data.size || 0,
        ttl: this.liveStatusCache ? Math.max(0, this.liveStatusCache.expiresAt - Date.now()) : 0
      },
      userPreferences: {
        count: this.userPreferencesCache.size
      },
      userSimilarity: {
        count: this.userSimilarityCache.size
      }
    }
  }
}

// シングルトンインスタンスをエクスポート
// Vercel Serverless環境では、各インスタンスごとに独立したキャッシュが作成される
export const cache = new DataCache()
