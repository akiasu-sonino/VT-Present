/* eslint-disable no-console */
/**
 * Database utility functions
 * Vercel Postgresへの接続とクエリを管理
 * すべてDBから直接取得（キャッシュなし）
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
  youtube_channel_id?: string
  twitch_user_id?: string
  video_id?: string
  created_at: Date
}

export interface AnonymousUser {
  id: number
  anonymous_id: string
  user_id: number | null
  created_at: Date
  last_active_at: Date
}

export interface User {
  id: number
  google_id: string
  email: string
  name: string | null
  avatar_url: string | null
  created_at: Date
  last_login_at: Date
}

export type PreferenceAction = 'LIKE' | 'SOSO' | 'DISLIKE'

export interface Preference {
  id: number
  anonymous_user_id: number
  streamer_id: number
  action: PreferenceAction
  created_at: Date
}

export interface Comment {
  id: number
  streamer_id: number
  user_id: number
  content: string
  comment_type: 'normal' | 'recommendation'
  reaction_count: number
  created_at: Date
  user?: User
}

export interface CommentReaction {
  id: number
  comment_id: number
  user_id: number
  reaction_type: 'like' | 'helpful' | 'heart' | 'fire'
  created_at: Date
}

export interface ShareLog {
  id: number
  user_id: number | null
  streamer_id: number
  comment_id: number | null
  platform: 'twitter' | 'facebook' | 'line' | 'other'
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  shared_at: Date
}

export interface ContactMessage {
  id: number
  user_id: number
  subject: string | null
  message: string
  status: string
  created_at: Date
}

// ========================================
// 内部ヘルパー関数
// ========================================

/**
 * 全ストリーマーをDBから取得
 */
async function getStreamers(): Promise<Streamer[]> {
  console.log('[DB] Fetching all streamers')
  const result = await sql<Streamer>`SELECT * FROM streamers`
  return result.rows
}

// ========================================
// 配信者関連
// ========================================

/**
 * ランダムに配信者を1人取得
 */
export async function getRandomStreamer(excludeIds: number[] = []): Promise<Streamer | null> {
  const streamers = await getStreamers()
  const available = streamers.filter(s => !excludeIds.includes(s.id))

  if (available.length === 0) {
    return null
  }

  const randomIndex = Math.floor(Math.random() * available.length)
  return available[randomIndex]
}

/**
 * ランダムに複数の配信者を取得（重複なし）
 */
export async function getRandomStreamers(
  count: number,
  excludeIds: number[] = [],
  tags: string[] = [],
  query?: string,
  tagOperator: 'OR' | 'AND' = 'OR',
  minFollowers?: number,
  maxFollowers?: number,
  liveChannelIds?: string[]
): Promise<Streamer[]> {
  const streamers = await getStreamers()
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
 * IDで配信者を取得
 */
export async function getStreamerById(id: number): Promise<Streamer | null> {
  const streamers = await getStreamers()
  return streamers.find(s => s.id === id) || null
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
  // DBから検索
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
  return await createAnonymousUser(anonymousId)
}

/**
 * 好みを記録
 * 記録後、ユーザーアクションキャッシュとプリファレンスキャッシュを更新
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
 * 配信者の好み設定を削除
 * 削除後、ユーザーアクションキャッシュとプリファレンスキャッシュを更新
 */
export async function deletePreference(
  anonymousUserId: number,
  streamerId: number
): Promise<void> {
  await sql`
    DELETE FROM preferences
    WHERE anonymous_user_id = ${anonymousUserId}
      AND streamer_id = ${streamerId}
  `
}

/**
 * ユーザーがアクション済みの配信者IDリストを取得
 */
export async function getActionedStreamerIds(anonymousUserId: number): Promise<number[]> {
  console.log(`[DB] Fetching user actions for user ${anonymousUserId}`)
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

/**
 * 全タグ一覧を取得
 */
export async function getAllTags(): Promise<string[]> {
  const streamers = await getStreamers()
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
export async function getTagCategories(): Promise<Record<string, string[]>> {
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
 * Google IDでユーザーを取得
 */
export async function getUserByGoogleId(googleId: string): Promise<User | null> {
  const result = await sql<User>`
    SELECT * FROM users
    WHERE google_id = ${googleId}
  `
  return result.rows[0] || null
}

/**
 * ユーザーIDでユーザーを取得
 */
export async function getUserById(userId: number): Promise<User | null> {
  const result = await sql<User>`
    SELECT * FROM users
    WHERE id = ${userId}
  `
  return result.rows[0] || null
}

/**
 * ユーザーを作成
 */
export async function createUser(
  googleId: string,
  email: string,
  name: string | null,
  avatarUrl: string | null
): Promise<User> {
  const result = await sql<User>`
    INSERT INTO users (google_id, email, name, avatar_url)
    VALUES (${googleId}, ${email}, ${name}, ${avatarUrl})
    RETURNING *
  `
  return result.rows[0]
}

/**
 * ユーザーのログイン日時を更新
 */
export async function updateUserLastLogin(userId: number): Promise<void> {
  await sql`
    UPDATE users
    SET last_login_at = NOW()
    WHERE id = ${userId}
  `
}

/**
 * 匿名ユーザーを認証済みユーザーに紐付け
 */
export async function linkAnonymousUserToUser(
  anonymousId: string,
  userId: number
): Promise<void> {
  await sql`
    UPDATE anonymous_users
    SET user_id = ${userId}
    WHERE anonymous_id = ${anonymousId}
  `
}

/**
 * 配信者のコメント一覧を取得
 */
export async function getCommentsByStreamerId(streamerId: number): Promise<Comment[]> {
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

/**
 * 配信者にタグを追加
 * 既存のタグ配列に新しいタグを追加（重複チェックあり）
 */
export async function addTagToStreamer(streamerId: number, tag: string): Promise<Streamer | null> {
  // タグの正規化（前後の空白を削除）
  const normalizedTag = tag.trim()

  if (!normalizedTag) {
    throw new Error('Tag cannot be empty')
  }

  // タグを追加（重複を避けるため、既に存在しない場合のみ追加）
  const result = await sql<Streamer>`
    UPDATE streamers
    SET tags = CASE
      WHEN ${normalizedTag} = ANY(tags) THEN tags
      ELSE array_append(tags, ${normalizedTag})
    END
    WHERE id = ${streamerId}
    RETURNING *
  `

  if (result.rows.length === 0) {
    return null
  }

  return result.rows[0]
}

/**
 * 配信者からタグを削除
 */
export async function removeTagFromStreamer(streamerId: number, tag: string): Promise<Streamer | null> {
  const result = await sql<Streamer>`
    UPDATE streamers
    SET tags = array_remove(tags, ${tag})
    WHERE id = ${streamerId}
    RETURNING *
  `

  if (result.rows.length === 0) {
    return null
  }

  return result.rows[0]
}

/**
 * ユーザーのアクション履歴をスコア付きMapで取得（協調フィルタリング用）
 */
export async function getUserPreferences(userId: number): Promise<Map<number, number>> {
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
 * アクティブユーザーIDリストを取得（協調フィルタリング用）
 */
export async function getActiveUserIds(limit: number = 1000): Promise<number[]> {
  console.log(`[DB] Fetching active user IDs (limit: ${limit})`)
  const result = await sql<{ anonymous_user_id: number }>`
    SELECT DISTINCT anonymous_user_id
    FROM preferences
    WHERE created_at > NOW() - INTERVAL '30 days'
    LIMIT ${limit}
  `

  return result.rows.map(row => row.anonymous_user_id)
}

// ========================================
// オンボーディング関連の関数
// ========================================

export interface OnboardingProgress {
  id: number
  anonymous_user_id: number | null
  user_id: number | null
  quiz_completed: boolean
  tags_selected: boolean
  tutorial_completed: boolean
  quiz_results: Record<string, unknown> | null
  selected_tags: string[]
  started_at: Date
  completed_at: Date | null
  anonymous_tutorial_shown: boolean
  anonymous_tutorial_skipped: boolean
}

/**
 * オンボーディング進捗を取得
 * @param anonymousUserId 匿名ユーザーID
 * @returns オンボーディング進捗、存在しない場合はnull
 */
export async function getOnboardingProgress(
  anonymousUserId: number
): Promise<OnboardingProgress | null> {
  const result = await sql<OnboardingProgress>`
    SELECT * FROM user_onboarding_progress
    WHERE anonymous_user_id = ${anonymousUserId}
  `

  return result.rows[0] || null
}

/**
 * オンボーディング進捗をユーザーIDで取得
 * @param userId ユーザーID
 * @returns オンボーディング進捗、存在しない場合はnull
 */
export async function getOnboardingProgressByUserId(
  userId: number
): Promise<OnboardingProgress | null> {
  const result = await sql<OnboardingProgress>`
    SELECT * FROM user_onboarding_progress
    WHERE user_id = ${userId}
  `

  return result.rows[0] || null
}

/**
 * 診断結果を保存
 * @param anonymousUserId 匿名ユーザーID
 * @param quizResults 診断結果
 * @param recommendedTags 推奨タグリスト
 * @returns 更新されたオンボーディング進捗
 */
export async function saveQuizResults(
  anonymousUserId: number,
  quizResults: Record<string, unknown>,
  recommendedTags: string[]
): Promise<OnboardingProgress> {
  // 既存の進捗を確認
  const existing = await getOnboardingProgress(anonymousUserId)

  if (existing) {
    // 更新
    const result = await sql<OnboardingProgress>`
      UPDATE user_onboarding_progress
      SET quiz_completed = TRUE,
          quiz_results = ${JSON.stringify({ ...quizResults, recommendedTags })}
      WHERE anonymous_user_id = ${anonymousUserId}
      RETURNING *
    `
    return result.rows[0]
  } else {
    // 新規作成
    const result = await sql<OnboardingProgress>`
      INSERT INTO user_onboarding_progress (
        anonymous_user_id,
        quiz_completed,
        quiz_results
      )
      VALUES (
        ${anonymousUserId},
        TRUE,
        ${JSON.stringify({ ...quizResults, recommendedTags })}
      )
      RETURNING *
    `
    return result.rows[0]
  }
}

/**
 * タグ選択を保存
 * @param anonymousUserId 匿名ユーザーID
 * @param selectedTags 選択されたタグリスト
 * @returns 更新されたオンボーディング進捗
 */
export async function saveTagSelection(
  anonymousUserId: number,
  selectedTags: string[]
): Promise<OnboardingProgress> {
  // 既存の進捗を確認
  const existing = await getOnboardingProgress(anonymousUserId)

  if (existing) {
    // 更新
    const result = await sql<OnboardingProgress>`
      UPDATE user_onboarding_progress
      SET tags_selected = TRUE,
          selected_tags = ${selectedTags}
      WHERE anonymous_user_id = ${anonymousUserId}
      RETURNING *
    `
    return result.rows[0]
  } else {
    // 新規作成（診断スキップされた場合）
    const result = await sql<OnboardingProgress>`
      INSERT INTO user_onboarding_progress (
        anonymous_user_id,
        tags_selected,
        selected_tags
      )
      VALUES (
        ${anonymousUserId},
        TRUE,
        ${selectedTags}
      )
      RETURNING *
    `
    return result.rows[0]
  }
}

/**
 * チュートリアル完了を記録
 * @param anonymousUserId 匿名ユーザーID
 * @returns 更新されたオンボーディング進捗
 */
export async function completeOnboarding(
  anonymousUserId: number
): Promise<OnboardingProgress> {
  // 既存の進捗を確認
  const existing = await getOnboardingProgress(anonymousUserId)

  if (existing) {
    // 更新
    const result = await sql<OnboardingProgress>`
      UPDATE user_onboarding_progress
      SET tutorial_completed = TRUE,
          completed_at = NOW()
      WHERE anonymous_user_id = ${anonymousUserId}
      RETURNING *
    `
    return result.rows[0]
  } else {
    // 新規作成（全スキップされた場合）
    const result = await sql<OnboardingProgress>`
      INSERT INTO user_onboarding_progress (
        anonymous_user_id,
        tutorial_completed,
        completed_at
      )
      VALUES (
        ${anonymousUserId},
        TRUE,
        NOW()
      )
      RETURNING *
    `
    return result.rows[0]
  }
}

/**
 * 匿名ユーザーから認証済みユーザーへのオンボーディング進捗移行
 * @param anonymousId 匿名ユーザーのUUID
 * @param userId 認証済みユーザーID
 */
export async function migrateOnboardingProgress(
  anonymousId: string,
  userId: number
): Promise<void> {
  // 匿名ユーザーのanonymous_user_idを取得
  const anonymousUser = await getOrCreateAnonymousUser(anonymousId)

  // オンボーディング進捗を移行
  await sql`
    UPDATE user_onboarding_progress
    SET user_id = ${userId}
    WHERE anonymous_user_id = ${anonymousUser.id}
  `
}

/**
 * 認証済みユーザーの診断結果を保存
 * @param userId ユーザーID
 * @param quizResults 診断結果
 * @param recommendedTags 推奨タグリスト
 * @returns オンボーディング進捗
 */
export async function saveQuizResultsForUser(
  userId: number,
  quizResults: Record<string, unknown>,
  recommendedTags: string[]
): Promise<OnboardingProgress> {
  // 既存の進捗を確認
  const existing = await getOnboardingProgressByUserId(userId)

  if (existing) {
    // 更新
    const result = await sql<OnboardingProgress>`
      UPDATE user_onboarding_progress
      SET quiz_completed = TRUE,
          quiz_results = ${JSON.stringify({ ...quizResults, recommendedTags })}
      WHERE user_id = ${userId}
      RETURNING *
    `
    return result.rows[0]
  } else {
    // 新規作成
    const result = await sql<OnboardingProgress>`
      INSERT INTO user_onboarding_progress (
        user_id,
        quiz_completed,
        quiz_results
      )
      VALUES (
        ${userId},
        TRUE,
        ${JSON.stringify({ ...quizResults, recommendedTags })}
      )
      RETURNING *
    `
    return result.rows[0]
  }
}

/**
 * 認証済みユーザーのタグ選択を保存
 * @param userId ユーザーID
 * @param selectedTags 選択されたタグリスト
 * @returns オンボーディング進捗
 */
export async function saveTagSelectionForUser(
  userId: number,
  selectedTags: string[]
): Promise<OnboardingProgress> {
  // 既存の進捗を確認
  const existing = await getOnboardingProgressByUserId(userId)

  if (existing) {
    // 更新
    const result = await sql<OnboardingProgress>`
      UPDATE user_onboarding_progress
      SET tags_selected = TRUE,
          selected_tags = ${selectedTags}
      WHERE user_id = ${userId}
      RETURNING *
    `
    return result.rows[0]
  } else {
    // 新規作成（診断スキップされた場合）
    const result = await sql<OnboardingProgress>`
      INSERT INTO user_onboarding_progress (
        user_id,
        tags_selected,
        selected_tags
      )
      VALUES (
        ${userId},
        TRUE,
        ${selectedTags}
      )
      RETURNING *
    `
    return result.rows[0]
  }
}

/**
 * 認証済みユーザーのオンボーディング完了
 * @param userId ユーザーID
 * @returns オンボーディング進捗
 */
export async function completeOnboardingForUser(
  userId: number
): Promise<OnboardingProgress> {
  // 既存の進捗を確認
  const existing = await getOnboardingProgressByUserId(userId)

  if (existing) {
    // 更新
    const result = await sql<OnboardingProgress>`
      UPDATE user_onboarding_progress
      SET tutorial_completed = TRUE,
          completed_at = NOW()
      WHERE user_id = ${userId}
      RETURNING *
    `
    return result.rows[0]
  } else {
    // 新規作成（全スキップされた場合）
    const result = await sql<OnboardingProgress>`
      INSERT INTO user_onboarding_progress (
        user_id,
        tutorial_completed,
        completed_at
      )
      VALUES (
        ${userId},
        TRUE,
        NOW()
      )
      RETURNING *
    `
    return result.rows[0]
  }
}

/**
 * 匿名ユーザー向けログイン誘導モーダルを表示済みとしてマーク
 * @param anonymousUserId 匿名ユーザーID
 */
export async function markAnonymousModalShown(
  anonymousUserId: number
): Promise<void> {
  // 既存の進捗を確認
  const existing = await getOnboardingProgress(anonymousUserId)

  if (existing) {
    // 既存レコードを更新
    await sql`
      UPDATE user_onboarding_progress
      SET anonymous_tutorial_shown = TRUE
      WHERE anonymous_user_id = ${anonymousUserId}
    `
  } else {
    // 新規レコードを作成
    await sql`
      INSERT INTO user_onboarding_progress (
        anonymous_user_id,
        quiz_completed,
        tags_selected,
        tutorial_completed,
        selected_tags,
        anonymous_tutorial_shown,
        anonymous_tutorial_skipped
      )
      VALUES (
        ${anonymousUserId},
        FALSE,
        FALSE,
        FALSE,
        ARRAY[]::TEXT[],
        TRUE,
        FALSE
      )
    `
  }
}

/**
 * 匿名ユーザー向けログイン誘導モーダルをスキップとしてマーク
 * @param anonymousUserId 匿名ユーザーID
 */
export async function markAnonymousModalSkipped(
  anonymousUserId: number
): Promise<void> {
  // 既存の進捗を確認
  const existing = await getOnboardingProgress(anonymousUserId)

  if (existing) {
    // 既存レコードを更新
    await sql`
      UPDATE user_onboarding_progress
      SET anonymous_tutorial_shown = TRUE,
          anonymous_tutorial_skipped = TRUE
      WHERE anonymous_user_id = ${anonymousUserId}
    `
  } else {
    // 新規レコードを作成
    await sql`
      INSERT INTO user_onboarding_progress (
        anonymous_user_id,
        quiz_completed,
        tags_selected,
        tutorial_completed,
        selected_tags,
        anonymous_tutorial_shown,
        anonymous_tutorial_skipped
      )
      VALUES (
        ${anonymousUserId},
        FALSE,
        FALSE,
        FALSE,
        ARRAY[]::TEXT[],
        TRUE,
        TRUE
      )
    `
  }
}

// ========================================
// コメントリアクション機能
// ========================================

/**
 * コメントにリアクション（いいね）を追加
 * @param commentId コメントID
 * @param userId ユーザーID
 * @param reactionType リアクションタイプ
 */
export async function addCommentReaction(
  commentId: number,
  userId: number,
  reactionType: 'like' | 'helpful' | 'heart' | 'fire' = 'like'
): Promise<CommentReaction | null> {
  try {
    const result = await sql<CommentReaction>`
      INSERT INTO comment_reactions (comment_id, user_id, reaction_type)
      VALUES (${commentId}, ${userId}, ${reactionType})
      ON CONFLICT (comment_id, user_id)
      DO UPDATE SET reaction_type = ${reactionType}
      RETURNING *
    `

    return result.rows[0] || null
  } catch (error) {
    console.error('Error adding comment reaction:', error)
    return null
  }
}

/**
 * コメントからリアクションを削除
 * @param commentId コメントID
 * @param userId ユーザーID
 */
export async function removeCommentReaction(
  commentId: number,
  userId: number
): Promise<boolean> {
  try {
    const result = await sql`
      DELETE FROM comment_reactions
      WHERE comment_id = ${commentId} AND user_id = ${userId}
    `

    return (result.rowCount ?? 0) > 0
  } catch (error) {
    console.error('Error removing comment reaction:', error)
    return false
  }
}

/**
 * 特定のコメントへのユーザーのリアクションを取得
 * @param commentId コメントID
 * @param userId ユーザーID
 */
export async function getUserReactionForComment(
  commentId: number,
  userId: number
): Promise<CommentReaction | null> {
  try {
    const result = await sql<CommentReaction>`
      SELECT *
      FROM comment_reactions
      WHERE comment_id = ${commentId} AND user_id = ${userId}
    `

    return result.rows[0] || null
  } catch (error) {
    console.error('Error getting user reaction:', error)
    return null
  }
}

/**
 * おすすめランキングを取得
 * @param limit 取得件数
 * @param sortBy ソート基準（'popular': リアクション数順、'recent': 新着順）
 */
export async function getRecommendationRanking(
  limit: number = 20,
  sortBy: 'popular' | 'recent' = 'popular'
): Promise<any[]> {
  try {
    const result = sortBy === 'popular'
      ? await sql<any>`
          SELECT
            c.*,
            json_build_object(
              'id', u.id,
              'name', u.name,
              'email', u.email,
              'avatar_url', u.avatar_url
            ) as user,
            json_build_object(
              'id', s.id,
              'name', s.name,
              'avatar_url', s.avatar_url,
              'platform', s.platform,
              'follower_count', s.follower_count
            ) as streamer
          FROM comments c
          INNER JOIN users u ON c.user_id = u.id
          INNER JOIN streamers s ON c.streamer_id = s.id
          WHERE c.comment_type = 'recommendation'
          ORDER BY c.reaction_count DESC, c.created_at DESC
          LIMIT ${limit}
        `
      : await sql<any>`
          SELECT
            c.*,
            json_build_object(
              'id', u.id,
              'name', u.name,
              'email', u.email,
              'avatar_url', u.avatar_url
            ) as user,
            json_build_object(
              'id', s.id,
              'name', s.name,
              'avatar_url', s.avatar_url,
              'platform', s.platform,
              'follower_count', s.follower_count
            ) as streamer
          FROM comments c
          INNER JOIN users u ON c.user_id = u.id
          INNER JOIN streamers s ON c.streamer_id = s.id
          WHERE c.comment_type = 'recommendation'
          ORDER BY c.created_at DESC
          LIMIT ${limit}
        `

    return result.rows
  } catch (error) {
    console.error('Error getting recommendation ranking:', error)
    return []
  }
}

// ========================================
// シェアログ機能
// ========================================

/**
 * シェアログを記録
 * @param params シェアログパラメータ
 */
export async function createShareLog(params: {
  userId?: number
  streamerId: number
  commentId?: number
  platform: 'twitter' | 'facebook' | 'line' | 'other'
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
}): Promise<ShareLog | null> {
  try {
    const result = await sql<ShareLog>`
      INSERT INTO share_logs (
        user_id,
        streamer_id,
        comment_id,
        platform,
        utm_source,
        utm_medium,
        utm_campaign
      ) VALUES (
        ${params.userId ?? null},
        ${params.streamerId},
        ${params.commentId ?? null},
        ${params.platform},
        ${params.utmSource ?? null},
        ${params.utmMedium ?? null},
        ${params.utmCampaign ?? null}
      )
      RETURNING *
    `

    return result.rows[0] || null
  } catch (error) {
    console.error('Error creating share log:', error)
    return null
  }
}

/**
 * 配信者のシェア数を取得
 * @param streamerId 配信者ID
 */
export async function getShareCountByStreamerId(streamerId: number): Promise<number> {
  try {
    const result = await sql<{ count: number }>`
      SELECT COUNT(*) as count
      FROM share_logs
      WHERE streamer_id = ${streamerId}
    `

    return parseInt(String(result.rows[0]?.count ?? 0))
  } catch (error) {
    console.error('Error getting share count:', error)
    return 0
  }
}

// ========================================
// ライブ配信状態管理
// ========================================

export interface LiveStream {
  channel_id: string
  is_live: boolean
  viewer_count: number | null
  video_id: string | null
  title: string | null
  updated_at: Date
}

/**
 * ライブ配信状態をDBに一括保存（UPSERT）
 * Vercel Cronから5分間隔で呼び出される
 * @param liveStreams ライブ配信状態の配列
 */
export async function upsertLiveStreams(liveStreams: LiveStream[]): Promise<void> {
  try {
    if (liveStreams.length === 0) {
      console.log('[DB] No live streams to upsert')
      return
    }

    // トランザクションで一括UPSERT
    const values = liveStreams.map(stream =>
      `('${stream.channel_id}', ${stream.is_live}, ${stream.viewer_count ?? 'NULL'}, ${stream.video_id ? `'${stream.video_id}'` : 'NULL'}, ${stream.title ? `'${stream.title.replace(/'/g, "''")}'` : 'NULL'}, NOW())`
    ).join(',')

    await sql.query(`
      INSERT INTO live_streams (channel_id, is_live, viewer_count, video_id, title, updated_at)
      VALUES ${values}
      ON CONFLICT (channel_id)
      DO UPDATE SET
        is_live = EXCLUDED.is_live,
        viewer_count = EXCLUDED.viewer_count,
        video_id = EXCLUDED.video_id,
        title = EXCLUDED.title,
        updated_at = EXCLUDED.updated_at
    `)

    console.log(`[DB] Upserted ${liveStreams.length} live stream statuses`)
  } catch (error) {
    console.error('Error upserting live streams:', error)
    throw error
  }
}

/**
 * DBからライブ配信状態を取得
 * @returns チャンネルIDをキーとしたライブ配信状態のMap
 */
export async function getLiveStreams(): Promise<Map<string, LiveStream>> {
  try {
    const result = await sql<LiveStream>`
      SELECT channel_id, is_live, viewer_count, video_id, title, updated_at
      FROM live_streams
      WHERE updated_at > NOW() - INTERVAL '15 minutes'
    `

    const liveStreamsMap = new Map<string, LiveStream>()
    result.rows.forEach(stream => {
      liveStreamsMap.set(stream.channel_id, stream)
    })

    console.log(`[DB] Retrieved ${liveStreamsMap.size} live stream statuses`)
    return liveStreamsMap
  } catch (error) {
    console.error('Error getting live streams:', error)
    return new Map()
  }
}

/**
 * DBからライブ中のチャンネルIDリストを取得
 * @returns ライブ中のチャンネルIDの配列
 */
export async function getLiveChannelIds(): Promise<string[]> {
  try {
    const result = await sql<{ channel_id: string }>`
      SELECT channel_id
      FROM live_streams
      WHERE is_live = true
        AND updated_at > NOW() - INTERVAL '15 minutes'
    `

    const channelIds = result.rows.map(row => row.channel_id)
    console.log(`[DB] Retrieved ${channelIds.length} live channel IDs`)
    return channelIds
  } catch (error) {
    console.error('Error getting live channel IDs:', error)
    return []
  }
}

/**
 * ライブ配信状態が古い場合に更新する（オンデマンド更新）
 * - 最終更新が5分以上前、またはデータが存在しない場合に更新
 * - YouTube APIを呼び出してDBを更新
 * @returns 更新が実行されたかどうか
 */
export async function updateLiveStreamsIfNeeded(): Promise<boolean> {
  try {
    // 最終更新時刻を確認
    const result = await sql<{ updated_at: Date }>`
      SELECT MAX(updated_at) as updated_at
      FROM live_streams
    `

    const lastUpdated = result.rows[0]?.updated_at
    const now = Date.now()
    const fiveMinutesAgo = now - 5 * 60 * 1000

    // データが存在しない、または5分以上前の場合に更新
    const shouldUpdate = !lastUpdated || new Date(lastUpdated).getTime() < fiveMinutesAgo

    if (!shouldUpdate) {
      console.log('[DB] Live streams data is fresh, skipping update')
      return false
    }

    console.log('[DB] Live streams data is stale, updating...')

    // YouTube API Keyを取得
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) {
      console.error('[DB] YOUTUBE_API_KEY is not configured')
      return false
    }

    // 全配信者を取得
    const streamers = await getStreamers()
    const channelIds = streamers
      .filter(s => s.youtube_channel_id)
      .map(s => s.youtube_channel_id as string)

    if (channelIds.length === 0) {
      console.log('[DB] No channels to check')
      return false
    }

    console.log(`[DB] Fetching live status for ${channelIds.length} channels`)

    // YouTube APIからライブ状態を取得（動的importが必要）
    const { getLiveStreamStatus } = await import('./youtube.js')
    const liveStreamInfoList = await getLiveStreamStatus(channelIds, apiKey)

    // LiveStreamInfo[] を LiveStream[] に変換
    const liveStreams: LiveStream[] = liveStreamInfoList.map(info => ({
      channel_id: info.channelId,
      is_live: info.isLive,
      viewer_count: info.viewerCount ?? null,
      video_id: info.videoId ?? null,
      title: info.title ?? null,
      updated_at: new Date()
    }))

    // DBに保存
    await upsertLiveStreams(liveStreams)

    const liveCount = liveStreams.filter(s => s.is_live).length
    console.log(`[DB] Updated ${liveStreams.length} live stream statuses (${liveCount} live)`)

    return true
  } catch (error) {
    console.error('[DB] Error updating live streams:', error)
    return false
  }
}

// ========================================
// コメント作成機能
// ========================================

/**
 * コメントを作成
 * @param streamerId 配信者ID
 * @param userId ユーザーID
 * @param content コメント内容
 * @param commentType コメントタイプ
 */
export async function createComment(
  streamerId: number,
  userId: number,
  content: string,
  commentType: 'normal' | 'recommendation' = 'normal'
): Promise<void> {
  try {
    await sql`
      INSERT INTO comments (streamer_id, user_id, content, comment_type)
      VALUES (${streamerId}, ${userId}, ${content}, ${commentType})
    `
    console.log(`[DB] Comment (${commentType}) created for streamer ${streamerId}`)
  } catch (error) {
    console.error('Error creating comment:', error)
    throw error
  }
}

// ========================================
// お問い合わせ作成機能
// ========================================

/**
 * お問い合わせを作成
 * @param userId ユーザーID
 * @param subject 件名
 * @param message メッセージ
 */
export async function createContactMessage(
  userId: number,
  subject: string | null,
  message: string
): Promise<void> {
  try {
    await sql`
      INSERT INTO contact_messages (user_id, subject, message)
      VALUES (${userId}, ${subject}, ${message})
    `
    console.log(`[DB] Contact message created for user ${userId}`)
  } catch (error) {
    console.error('Error creating contact message:', error)
    throw error
  }
}
