/* eslint-disable no-console */
/**
 * Database Access Layer
 * すべてのデータをDBから直接取得
 * Vercel Serverless環境でのキャッシュ同期問題を解消
 */

import { sql } from '@vercel/postgres'
import type { Streamer, AnonymousUser, PreferenceAction } from './db.js'

/**
 * データアクセスマネージャー
 * 全てのデータをDBから直接取得
 */
class DataAccess {
  /**
   * 全ストリーマーをDBから取得
   */
  async getStreamers(): Promise<Streamer[]> {
    console.log('[DB] Fetching all streamers')
    const result = await sql<Streamer>`SELECT * FROM streamers`
    return result.rows
  }

  /**
   * DBからランダムにストリーマーを1人取得
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
   * DBからランダムに複数のストリーマーを取得
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

    // ライブ中のみフィルター
    if (liveChannelIds !== undefined) {
      available = available.filter(s =>
        s.youtube_channel_id && liveChannelIds.includes(s.youtube_channel_id)
      )
    }

    // フリーワード検索
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
        available = available.filter(s =>
          s.tags && tags.every(tag => s.tags.includes(tag))
        )
      } else {
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
   * IDでストリーマーを取得
   */
  async getStreamerById(id: number): Promise<Streamer | null> {
    const streamers = await this.getStreamers()
    return streamers.find(s => s.id === id) || null
  }

  /**
   * ユーザーがアクション済みの配信者IDリストをDBから取得
   */
  async getUserActionedStreamerIds(userId: number): Promise<number[]> {
    console.log(`[DB] Fetching user actions for user ${userId}`)
    const result = await sql<{ streamer_id: number }>`
      SELECT DISTINCT streamer_id
      FROM preferences
      WHERE anonymous_user_id = ${userId}
    `
    return result.rows.map(row => row.streamer_id)
  }

  /**
   * アクション別に配信者リストを取得
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
   * ユーザー情報をDBから取得
   */
  async getUser(anonymousId: string): Promise<AnonymousUser | null> {
    console.log(`[DB] Fetching user data for ${anonymousId}`)
    const result = await sql<AnonymousUser>`
      SELECT * FROM anonymous_users
      WHERE anonymous_id = ${anonymousId}
    `
    return result.rows[0] || null
  }

  /**
   * 全タグ一覧を取得
   */
  async getAllTags(): Promise<string[]> {
    const streamers = await this.getStreamers()
    const tagsSet = new Set<string>()

    streamers.forEach(streamer => {
      if (streamer.tags && Array.isArray(streamer.tags)) {
        streamer.tags.forEach(tag => tagsSet.add(tag))
      }
    })

    return Array.from(tagsSet).sort()
  }

  /**
   * タグカテゴリ情報を取得
   */
  async getTagCategories(): Promise<Record<string, string[]>> {
    console.log('[DB] Fetching tag categories')
    const result = await sql<{ category_name: string; tag_name: string }>`
      SELECT category_name, tag_name
      FROM tag_categories
      ORDER BY sort_order ASC
    `

    const categories: Record<string, string[]> = {}
    result.rows.forEach(row => {
      if (!categories[row.category_name]) {
        categories[row.category_name] = []
      }
      categories[row.category_name].push(row.tag_name)
    })

    return categories
  }

  /**
   * ユーザープリファレンスを取得（協調フィルタリング用）
   */
  async getUserPreferences(userId: number): Promise<Map<number, number>> {
    console.log(`[DB] Fetching user preferences for user ${userId}`)
    const result = await sql<{ streamer_id: number; action: string }>`
      SELECT streamer_id, action
      FROM preferences
      WHERE anonymous_user_id = ${userId}
    `

    const preferences = new Map<number, number>()
    result.rows.forEach(row => {
      const score = row.action === 'LIKE' ? 1 : row.action === 'SOSO' ? 0.5 : -1
      preferences.set(row.streamer_id, score)
    })

    return preferences
  }

  /**
   * アクティブユーザーのIDリストを取得（協調フィルタリング用）
   */
  async getActiveUserIds(limit: number = 1000): Promise<number[]> {
    console.log(`[DB] Fetching active user IDs (limit: ${limit})`)
    const result = await sql<{ anonymous_user_id: number }>`
      SELECT DISTINCT anonymous_user_id
      FROM preferences
      WHERE created_at > NOW() - INTERVAL '30 days'
      LIMIT ${limit}
    `

    return result.rows.map(row => row.anonymous_user_id)
  }

  /**
   * コメントを取得
   */
  async getCommentsByStreamerId(streamerId: number): Promise<any[]> {
    console.log(`[DB] Fetching comments for streamer ${streamerId}`)
    const result = await sql`
      SELECT c.*, u.name as user_name, u.email as user_email, u.avatar_url as user_avatar_url
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.streamer_id = ${streamerId}
      ORDER BY c.created_at DESC
    `

    return result.rows.map(row => ({
      id: row.id,
      streamer_id: row.streamer_id,
      user_id: row.user_id,
      content: row.content,
      created_at: row.created_at,
      comment_type: row.comment_type,
      user: row.user_id ? {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email,
        avatar_url: row.user_avatar_url
      } : null
    }))
  }
}

// シングルトンインスタンスをエクスポート
export const dbAccess = new DataAccess()
