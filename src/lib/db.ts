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
  created_at: Date
  user?: User
}

export interface ContactMessage {
  id: number
  user_id: number
  subject: string | null
  message: string
  status: string
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
 * @param tags フィルタリングするタグ
 * @param query フリーワード検索クエリ
 * @param tagOperator タグ検索演算子（AND/OR）
 * @param minFollowers 最小フォロワー数
 * @param maxFollowers 最大フォロワー数
 * @param liveChannelIds ライブ中のチャンネルIDリスト
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
  return cache.getRandomStreamers(count, excludeIds, tags, query, tagOperator, minFollowers, maxFollowers, liveChannelIds)
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

  // キャッシュを更新（次回のgetActionedStreamerIdsでDBアクセス不要に）
  cache.addUserAction(anonymousUserId, streamerId)

  // プリファレンスキャッシュを無効化（協調フィルタリング用）
  cache.invalidateUserPreferences(anonymousUserId)

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

  // キャッシュから削除
  cache.removeUserAction(anonymousUserId, streamerId)

  // プリファレンスキャッシュを無効化（協調フィルタリング用）
  cache.invalidateUserPreferences(anonymousUserId)
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

/**
 * 全タグ一覧を取得
 * キャッシュされたストリーマーデータから抽出するため、DBアクセスなし
 */
export async function getAllTags(): Promise<string[]> {
  return cache.getAllTags()
}

/**
 * タグカテゴリ情報を取得
 * タグをカテゴリ別にグループ化して返す
 */
export async function getTagCategories(): Promise<Record<string, string[]>> {
  try {
    const result = await sql`
      SELECT category_name, tag_name
      FROM tag_categories
      ORDER BY category_name, sort_order, tag_name
    `

    const categories: Record<string, string[]> = {}

    result.rows.forEach((row: { category_name: string; tag_name: string }) => {
      if (!categories[row.category_name]) {
        categories[row.category_name] = []
      }
      categories[row.category_name].push(row.tag_name)
    })

    return categories
  } catch (error) {
    console.error('Error fetching tag categories:', error)
    // エラー時は空のオブジェクトを返す
    return {}
  }
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
 * ユーザー情報とJOINして返す
 */
export async function getCommentsByStreamerId(streamerId: number): Promise<Comment[]> {
  const result = await sql<Comment>`
    SELECT
      c.*,
      json_build_object(
        'id', u.id,
        'name', u.name,
        'email', u.email,
        'avatar_url', u.avatar_url
      ) as user
    FROM comments c
    INNER JOIN users u ON c.user_id = u.id
    WHERE c.streamer_id = ${streamerId}
    ORDER BY c.created_at DESC
  `
  return result.rows
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

  // キャッシュを無効化（次回のリクエストで再取得）
  cache.invalidate()

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

  // キャッシュを無効化（次回のリクエストで再取得）
  cache.invalidate()

  return result.rows[0]
}

/**
 * ユーザーのアクション履歴をスコア付きMapで取得
 * 協調フィルタリングで使用
 * @param userId 匿名ユーザーID
 * @returns Map<streamerId, score> (LIKE: 1.0, SOSO: 0.3, DISLIKE: -0.5)
 */
export async function getUserPreferences(userId: number): Promise<Map<number, number>> {
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

  return prefs
}

/**
 * アクション数がN件以上のアクティブユーザーIDリストを取得
 * 協調フィルタリングの対象ユーザー抽出に使用
 * @param minActions 最小アクション数（デフォルト: 5）
 * @returns アクティブユーザーIDの配列
 */
export async function getActiveUserIds(minActions: number = 5): Promise<number[]> {
  const result = await sql<{ anonymous_user_id: number }>`
    SELECT anonymous_user_id
    FROM preferences
    GROUP BY anonymous_user_id
    HAVING COUNT(*) >= ${minActions}
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
