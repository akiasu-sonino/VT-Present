/**
 * Database utility functions
 * Vercel Postgresへの接続とクエリを管理
 * キャッシュレイヤーを使用してDBアクセスを最小限に抑える
 */

import { sql } from '@vercel/postgres'
import { cache } from './cache.js'

export interface Streamer {
  id: number
  name: string
  platform: string
  avatar_url: string
  description: string
  tags: string[]
  follower_count: number
  channel_url?: string
  video_id?: string
  created_at: Date
}

export interface AnonymousUser {
  id: number
  anonymous_id: string
  created_at: Date
  last_active_at: Date
}

export type PreferenceAction = 'LIKE' | 'SOSO' | 'DISLIKE'

export interface Preference {
  id: number
  anonymous_user_id: number
  streamer_id: number
  action: PreferenceAction
  created_at: Date
}

/**
 * ランダムに配信者を1人取得
 * キャッシュされたデータから選択するため、DBアクセスなし
 * @param excludeIds 除外する配信者IDのリスト
 */
export async function getRandomStreamer(excludeIds: number[] = []): Promise<Streamer | null> {
  return cache.getRandomStreamer(excludeIds)
}

/**
 * ランダムに複数の配信者を取得（重複なし）
 * キャッシュされたデータから選択するため、DBアクセスなし
 * @param count 取得する配信者の数
 * @param excludeIds 除外する配信者IDのリスト
 */
export async function getRandomStreamers(count: number, excludeIds: number[] = []): Promise<Streamer[]> {
  return cache.getRandomStreamers(count, excludeIds)
}

/**
 * IDで配信者を取得
 * キャッシュされたデータから検索するため、DBアクセスなし
 */
export async function getStreamerById(id: number): Promise<Streamer | null> {
  return cache.getStreamerById(id)
}

/**
 * 匿名ユーザーを作成
 */
export async function createAnonymousUser(anonymousId: string): Promise<AnonymousUser> {
  const result = await sql<AnonymousUser>`
    INSERT INTO anonymous_users (anonymous_id)
    VALUES (${anonymousId})
    RETURNING *
  `
  return result.rows[0]
}

/**
 * 匿名ユーザーを取得（存在しない場合は作成）
 * キャッシュを使用してDBアクセスを削減
 */
export async function getOrCreateAnonymousUser(anonymousId: string): Promise<AnonymousUser> {
  // キャッシュから取得を試みる
  const cached = cache.getUser(anonymousId)
  if (cached) {
    return cached
  }

  // キャッシュになければDBから検索
  const existing = await sql<AnonymousUser>`
    SELECT * FROM anonymous_users
    WHERE anonymous_id = ${anonymousId}
  `

  if (existing.rows.length > 0) {
    // last_active_atを更新
    const updated = await sql<AnonymousUser>`
      UPDATE anonymous_users
      SET last_active_at = NOW()
      WHERE anonymous_id = ${anonymousId}
      RETURNING *
    `
    const user = updated.rows[0]

    // キャッシュに保存
    cache.setUser(anonymousId, user)
    return user
  }

  // 新規作成
  const user = await createAnonymousUser(anonymousId)
  cache.setUser(anonymousId, user)
  return user
}

/**
 * 好みを記録
 * 記録後、ユーザーアクションキャッシュを更新
 */
export async function recordPreference(
  anonymousUserId: number,
  streamerId: number,
  action: PreferenceAction
): Promise<Preference> {
  const result = await sql<Preference>`
    INSERT INTO preferences (anonymous_user_id, streamer_id, action)
    VALUES (${anonymousUserId}, ${streamerId}, ${action})
    RETURNING *
  `

  // キャッシュを更新（次回のgetActionedStreamerIdsでDBアクセス不要に）
  cache.addUserAction(anonymousUserId, streamerId)

  return result.rows[0]
}

/**
 * ユーザーがアクション済みの配信者IDリストを取得
 * キャッシュから取得するため、頻繁なDBアクセスを回避
 */
export async function getActionedStreamerIds(anonymousUserId: number): Promise<number[]> {
  return cache.getUserActionedStreamerIds(anonymousUserId)
}

/**
 * アクション別に配信者リストを取得
 * この関数は複雑なJOINとORDER BYが必要なため、キャッシュレイヤーに委譲
 * （頻度が低いため、キャッシュ最適化の優先度は低い）
 */
export async function getStreamersByAction(
  anonymousUserId: number,
  action?: PreferenceAction
): Promise<Streamer[]> {
  return cache.getStreamersByAction(anonymousUserId, action)
}
