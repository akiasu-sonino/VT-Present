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
 * @param excludeIds 除外する配信者IDのリスト
 */
export async function getRandomStreamer(excludeIds: number[] = []): Promise<Streamer | null> {
  if (excludeIds.length > 0) {
    const result = await sql<Streamer>`
      SELECT * FROM streamers
      WHERE NOT (id = ANY(${excludeIds}))
      ORDER BY RANDOM()
      LIMIT 1
    `
    return result.rows[0] || null
  }

  const result = await sql<Streamer>`
    SELECT * FROM streamers
    ORDER BY RANDOM()
    LIMIT 1
  `
  return result.rows[0] || null
}

/**
 * ランダムに複数の配信者を取得（重複なし）
 * @param count 取得する配信者の数
 * @param excludeIds 除外する配信者IDのリスト
 */
export async function getRandomStreamers(count: number, excludeIds: number[] = []): Promise<Streamer[]> {
  if (excludeIds.length > 0) {
    const result = await sql<Streamer>`
      SELECT * FROM streamers
      WHERE NOT (id = ANY(${excludeIds}))
      ORDER BY RANDOM()
      LIMIT ${count}
    `
    return result.rows
  }

  const result = await sql<Streamer>`
    SELECT * FROM streamers
    ORDER BY RANDOM()
    LIMIT ${count}
  `
  return result.rows
}

/**
 * IDで配信者を取得
 */
export async function getStreamerById(id: number): Promise<Streamer | null> {
  const result = await sql<Streamer>`
    SELECT * FROM streamers
    WHERE id = ${id}
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

/**
 * ユーザーがアクション済みの配信者IDリストを取得
 */
export async function getActionedStreamerIds(anonymousUserId: number): Promise<number[]> {
  const result = await sql<{ streamer_id: number }>`
    SELECT DISTINCT streamer_id
    FROM preferences
    WHERE anonymous_user_id = ${anonymousUserId}
  `
  return result.rows.map(row => row.streamer_id)
}

/**
 * アクション別に配信者リストを取得
 */
export async function getStreamersByAction(
  anonymousUserId: number,
  action?: PreferenceAction
): Promise<Streamer[]> {
  if (action) {
    const result = await sql<Streamer>`
      SELECT s.*, MAX(p.created_at) as last_action_at
      FROM streamers s
      INNER JOIN preferences p ON s.id = p.streamer_id
      WHERE p.anonymous_user_id = ${anonymousUserId}
        AND p.action = ${action}
      GROUP BY s.id
      ORDER BY last_action_at DESC
    `
    return result.rows
  }

  // アクション指定なしの場合は全てのアクション済み配信者を取得
  const result = await sql<Streamer>`
    SELECT s.*, MAX(p.created_at) as last_action_at
    FROM streamers s
    INNER JOIN preferences p ON s.id = p.streamer_id
    WHERE p.anonymous_user_id = ${anonymousUserId}
    GROUP BY s.id
    ORDER BY last_action_at DESC
  `
  return result.rows
}
