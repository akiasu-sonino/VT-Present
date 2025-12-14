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
 * キャッシュされたデータから取得するため、DBアクセスを最小化
 */
export async function getTagCategories(): Promise<Record<string, string[]>> {
  return cache.getTagCategories()
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
 * ユーザー情報とJOINして返す（キャッシュ経由、5分TTL）
 */
export async function getCommentsByStreamerId(streamerId: number): Promise<Comment[]> {
  return cache.getCommentsByStreamerId(streamerId)
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
 * キャッシュされたデータから取得するため、DBアクセスを最小化
 * @param userId 匿名ユーザーID
 * @returns Map<streamerId, score> (LIKE: 1.0, SOSO: 0.3, DISLIKE: -0.5)
 */
export async function getUserPreferences(userId: number): Promise<Map<number, number>> {
  return cache.getUserPreferences(userId)
}

/**
 * アクション数がN件以上のアクティブユーザーIDリストを取得
 * 協調フィルタリングの対象ユーザー抽出に使用
 * キャッシュされたデータから取得するため、DBアクセスを最小化
 * @param minActions 最小アクション数（デフォルト: 5）
 * @returns アクティブユーザーIDの配列
 */
export async function getActiveUserIds(minActions: number = 5): Promise<number[]> {
  return cache.getActiveUserIds(minActions)
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
          selected_tags = ${sql.array(selectedTags)}
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
        ${sql.array(selectedTags)}
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

    // コメントキャッシュを無効化
    cache.invalidateComments()

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

    // コメントキャッシュを無効化
    cache.invalidateComments()

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
