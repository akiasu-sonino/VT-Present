/* eslint-disable no-console */
/**
 * Collaborative Filtering (協調フィルタリング)
 * ユーザーベースの協調フィルタリングでパーソナライズド推薦を実現
 */

import { cache } from './cache.js'
import { getActiveUserIds } from './db.js'
import type { Streamer } from './db.js'

/**
 * 2人のユーザー間のコサイン類似度を計算
 * @param userPrefsA ユーザーAのプリファレンス（Map<streamerId, score>）
 * @param userPrefsB ユーザーBのプリファレンス（Map<streamerId, score>）
 * @returns 類似度（-1.0〜1.0、共通アクション不足の場合は0.0）
 */
export function calculateUserSimilarity(
  userPrefsA: Map<number, number>,
  userPrefsB: Map<number, number>
): number {
  // 共通の配信者のみで計算（スパース性を活用）
  const commonStreamerIds = Array.from(userPrefsA.keys()).filter(id =>
    userPrefsB.has(id)
  )

  // 最小共通アクション数チェック（信頼性確保）
  if (commonStreamerIds.length < 3) {
    return 0.0
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (const streamerId of commonStreamerIds) {
    const scoreA = userPrefsA.get(streamerId)!
    const scoreB = userPrefsB.get(streamerId)!
    dotProduct += scoreA * scoreB
    normA += scoreA * scoreA
    normB += scoreB * scoreB
  }

  if (normA === 0 || normB === 0) {
    return 0.0
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * 現在のユーザーと類似するユーザーのトップN人を取得
 * @param userId 現在のユーザーID
 * @param topN 取得する類似ユーザー数（デフォルト: 20）
 * @param minSimilarity 最小類似度閾値（デフォルト: 0.3）
 * @returns 類似ユーザーのリスト（類似度降順）
 */
export async function findSimilarUsers(
  userId: number,
  topN: number = 20,
  minSimilarity: number = 0.3
): Promise<{ userId: number; similarity: number }[]> {
  // 現在のユーザーのプリファレンスを取得
  const currentUserPrefs = await cache.getUserPreferences(userId)

  // コールドスタート対策：アクション数が少ない場合は空配列を返す
  if (currentUserPrefs.size < 5) {
    return []
  }

  // アクティブユーザー（5件以上アクション）を取得
  const activeUserIds = await getActiveUserIds(5)

  // 類似度を計算
  const similarities: { userId: number; similarity: number }[] = []

  for (const otherUserId of activeUserIds) {
    if (otherUserId === userId) continue

    // キャッシュから類似度取得
    let similarity = cache.getUserSimilarity(userId, otherUserId)

    if (similarity === null) {
      // キャッシュミス → 計算
      const otherUserPrefs = await cache.getUserPreferences(otherUserId)
      similarity = calculateUserSimilarity(currentUserPrefs, otherUserPrefs)
      cache.setUserSimilarity(userId, otherUserId, similarity)
    }

    // 閾値フィルタ
    if (similarity > minSimilarity) {
      similarities.push({ userId: otherUserId, similarity })
    }
  }

  // 類似度降順でソート
  similarities.sort((a, b) => b.similarity - a.similarity)

  return similarities.slice(0, topN)
}

/**
 * 協調フィルタリングで推薦配信者を取得
 * @param userId 現在のユーザーID
 * @param excludeIds 除外する配信者IDリスト
 * @param tags タグフィルター
 * @param limit 取得数（デフォルト: 12）
 * @param randomRatio ランダム混入比率（デフォルト: 0.3）
 * @param query フリーワード検索クエリ
 * @param tagOperator タグ演算子（AND/OR）
 * @returns 推薦配信者のリスト
 */
export async function getCollaborativeRecommendations(
  userId: number,
  excludeIds: number[] = [],
  tags: string[] = [],
  limit: number = 12,
  randomRatio: number = 0.3,
  query?: string,
  tagOperator: 'OR' | 'AND' = 'OR',
  minFollowers?: number,
  maxFollowers?: number
): Promise<Streamer[]> {
  // 類似ユーザーを取得
  const similarUsers = await findSimilarUsers(userId, 20)

  // コールドスタート対応：類似ユーザーが見つからない場合はランダムにフォールバック
  if (similarUsers.length === 0) {
    console.log('[CollaborativeFiltering] No similar users found, falling back to random')
    return cache.getRandomStreamers(limit, excludeIds, tags, query, tagOperator, minFollowers, maxFollowers)
  }

  // 配信者ごとの推薦スコアを計算
  const streamerScores = new Map<number, number>()
  const totalSimilarity = similarUsers.reduce((sum, u) => sum + u.similarity, 0)

  for (const { userId: similarUserId, similarity } of similarUsers) {
    const similarUserPrefs = await cache.getUserPreferences(similarUserId)

    for (const [streamerId, score] of similarUserPrefs) {
      // 除外リストに含まれる配信者はスキップ
      if (excludeIds.includes(streamerId)) continue

      // DISLIKE (負のスコア) は推薦しない
      if (score <= 0) continue

      // 加重スコアを加算
      const currentScore = streamerScores.get(streamerId) || 0
      streamerScores.set(streamerId, currentScore + (similarity * score))
    }
  }

  // 加重平均（正規化）
  for (const [streamerId, score] of streamerScores) {
    streamerScores.set(streamerId, score / totalSimilarity)
  }

  // スコア降順でソート
  const sortedStreamerIds = Array.from(streamerScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)

  // 配信者データを取得
  const allStreamers = await cache.getStreamers()
  let recommendedStreamers = sortedStreamerIds
    .map(id => allStreamers.find(s => s.id === id))
    .filter(s => s !== undefined) as Streamer[]

  // フリーワード検索フィルター
  if (query && query.trim()) {
    const searchTerm = query.trim().toLowerCase()
    recommendedStreamers = recommendedStreamers.filter(s => {
      const nameMatch = s.name?.toLowerCase().includes(searchTerm)
      const descMatch = s.description?.toLowerCase().includes(searchTerm)
      return nameMatch || descMatch
    })
  }

  // フォロワー数フィルター
  if (minFollowers !== undefined && minFollowers > 0) {
    recommendedStreamers = recommendedStreamers.filter(s => s.follower_count >= minFollowers)
  }
  if (maxFollowers !== undefined && maxFollowers < Number.MAX_SAFE_INTEGER) {
    recommendedStreamers = recommendedStreamers.filter(s => s.follower_count <= maxFollowers)
  }

  // タグフィルター
  if (tags.length > 0) {
    if (tagOperator === 'AND') {
      // AND検索: すべてのタグを含むストリーマーのみ
      recommendedStreamers = recommendedStreamers.filter(s =>
        s.tags && tags.every(tag => s.tags.includes(tag))
      )
    } else {
      // OR検索: いずれかのタグを含むストリーマーのみ
      recommendedStreamers = recommendedStreamers.filter(s =>
        s.tags && s.tags.some(tag => tags.includes(tag))
      )
    }
  }

  // ランダム混入（多様性確保）
  const collaborativeCount = Math.floor(limit * (1 - randomRatio))
  const randomCount = limit - collaborativeCount

  const collaborative = recommendedStreamers.slice(0, collaborativeCount)
  const random = await cache.getRandomStreamers(
    randomCount,
    [...excludeIds, ...collaborative.map(s => s.id)],
    tags,
    query,
    tagOperator,
    minFollowers,
    maxFollowers
  )

  // シャッフルして返す
  const result = [...collaborative, ...random]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }

  console.log(`[CollaborativeFiltering] Recommended ${collaborative.length} collaborative + ${random.length} random = ${result.length} streamers`)

  return result.slice(0, limit)
}

/**
 * デバッグ情報付きで協調フィルタリング推薦を取得
 * @param userId 現在のユーザーID
 * @param excludeIds 除外する配信者IDリスト
 * @param tags タグフィルター
 * @param limit 取得数（デフォルト: 12）
 * @param randomRatio ランダム混入比率（デフォルト: 0.3）
 * @param query フリーワード検索クエリ
 * @param tagOperator タグ演算子（AND/OR）
 * @returns 推薦配信者のリスト（デバッグ情報付き）
 */
export async function getCollaborativeRecommendationsWithDebug(
  userId: number,
  excludeIds: number[] = [],
  tags: string[] = [],
  limit: number = 12,
  randomRatio: number = 0.3,
  query?: string,
  tagOperator: 'OR' | 'AND' = 'OR',
  minFollowers?: number,
  maxFollowers?: number
): Promise<{
  streamers: (Streamer & { _meta: { source: string; score?: number } })[]
  _debug: {
    totalActiveUsers: number
    currentUserActions: number
    similarUsersFound: number
    avgSimilarity: number
    collaborativeCount: number
    randomCount: number
  }
}> {
  // 類似ユーザーを取得
  const similarUsers = await findSimilarUsers(userId, 20)
  const currentUserPrefs = await cache.getUserPreferences(userId)
  const activeUserIds = await getActiveUserIds(5)

  // コールドスタート対応
  if (similarUsers.length === 0) {
    const randomStreamers = await cache.getRandomStreamers(limit, excludeIds, tags, query, tagOperator, minFollowers, maxFollowers)
    return {
      streamers: randomStreamers.map(s => ({
        ...s,
        _meta: { source: 'random' }
      })),
      _debug: {
        totalActiveUsers: activeUserIds.length,
        currentUserActions: currentUserPrefs.size,
        similarUsersFound: 0,
        avgSimilarity: 0,
        collaborativeCount: 0,
        randomCount: randomStreamers.length
      }
    }
  }

  // 配信者ごとの推薦スコアを計算
  const streamerScores = new Map<number, number>()
  const totalSimilarity = similarUsers.reduce((sum, u) => sum + u.similarity, 0)

  for (const { userId: similarUserId, similarity } of similarUsers) {
    const similarUserPrefs = await cache.getUserPreferences(similarUserId)

    for (const [streamerId, score] of similarUserPrefs) {
      if (excludeIds.includes(streamerId)) continue
      if (score <= 0) continue

      const currentScore = streamerScores.get(streamerId) || 0
      streamerScores.set(streamerId, currentScore + (similarity * score))
    }
  }

  // 正規化
  for (const [streamerId, score] of streamerScores) {
    streamerScores.set(streamerId, score / totalSimilarity)
  }

  // スコア降順でソート
  const sortedEntries = Array.from(streamerScores.entries())
    .sort((a, b) => b[1] - a[1])

  // 配信者データを取得
  const allStreamers = await cache.getStreamers()
  let recommendedStreamers = sortedEntries
    .map(([id, score]) => {
      const streamer = allStreamers.find(s => s.id === id)
      return streamer ? { ...streamer, _score: score } : null
    })
    .filter(s => s !== null) as (Streamer & { _score: number })[]

  // フリーワード検索フィルター
  if (query && query.trim()) {
    const searchTerm = query.trim().toLowerCase()
    recommendedStreamers = recommendedStreamers.filter(s => {
      const nameMatch = s.name?.toLowerCase().includes(searchTerm)
      const descMatch = s.description?.toLowerCase().includes(searchTerm)
      return nameMatch || descMatch
    })
  }

  // フォロワー数フィルター
  if (minFollowers !== undefined && minFollowers > 0) {
    recommendedStreamers = recommendedStreamers.filter(s => s.follower_count >= minFollowers)
  }
  if (maxFollowers !== undefined && maxFollowers < Number.MAX_SAFE_INTEGER) {
    recommendedStreamers = recommendedStreamers.filter(s => s.follower_count <= maxFollowers)
  }

  // タグフィルター
  if (tags.length > 0) {
    if (tagOperator === 'AND') {
      // AND検索: すべてのタグを含むストリーマーのみ
      recommendedStreamers = recommendedStreamers.filter(s =>
        s.tags && tags.every(tag => s.tags.includes(tag))
      )
    } else {
      // OR検索: いずれかのタグを含むストリーマーのみ
      recommendedStreamers = recommendedStreamers.filter(s =>
        s.tags && s.tags.some(tag => tags.includes(tag))
      )
    }
  }

  // ランダム混入
  const collaborativeCount = Math.floor(limit * (1 - randomRatio))
  const randomCount = limit - collaborativeCount

  const collaborative = recommendedStreamers.slice(0, collaborativeCount)
  const random = await cache.getRandomStreamers(
    randomCount,
    [...excludeIds, ...collaborative.map(s => s.id)],
    tags,
    query,
    tagOperator,
    minFollowers,
    maxFollowers
  )

  // 結果を構築
  const result = [
    ...collaborative.map(s => ({
      ...s,
      _meta: { source: 'collaborative', score: s._score }
    })),
    ...random.map(s => ({
      ...s,
      _meta: { source: 'random' }
    }))
  ]

  // シャッフル
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }

  // デバッグ情報
  const avgSimilarity = similarUsers.length > 0
    ? similarUsers.reduce((sum, u) => sum + u.similarity, 0) / similarUsers.length
    : 0

  return {
    streamers: result.slice(0, limit),
    _debug: {
      totalActiveUsers: activeUserIds.length,
      currentUserActions: currentUserPrefs.size,
      similarUsersFound: similarUsers.length,
      avgSimilarity: Math.round(avgSimilarity * 100) / 100,
      collaborativeCount: collaborative.length,
      randomCount: Math.min(randomCount, random.length)
    }
  }
}
