/**
 * Database utility functions
 * Vercel Postgresへの接続とクエリを管理
 */

import { sql } from '@vercel/postgres'

export interface Streamer {
  id: number
  name: string
  platform: string
  avatar_url: string
  description: string
  tags: string[]
  follower_count: number
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
 */
export async function getRandomStreamer(): Promise<Streamer | null> {
  const result = await sql<Streamer>`
    SELECT * FROM streamers
    ORDER BY RANDOM()
    LIMIT 1
  `
  return result.rows[0] || null
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
 */
export async function getOrCreateAnonymousUser(anonymousId: string): Promise<AnonymousUser> {
  // 既存ユーザーを検索
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
    return updated.rows[0]
  }

  // 新規作成
  return createAnonymousUser(anonymousId)
}

/**
 * 好みを記録
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
  return result.rows[0]
}
