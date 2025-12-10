/**
 * オンボーディングユーティリティ
 * 診断結果からタグへのマッピングロジック
 */

export interface QuizAnswer {
  questionId: number
  answer: string
}

// クライアント側の質問定義と同期させる必要があるタグマッピング
// 将来的にはDBで管理することも検討
const TAG_MAPPINGS: Record<string, string[]> = {
  // Q1: 好きな配信ジャンルは？
  'game': ['FPS', 'RPG', 'レトロゲーム', 'ゲーム'],
  'chat': ['雑談', 'ASMR'],
  'music': ['歌', '歌枠'],
  'creative': ['お絵描き', 'プログラミング'],

  // Q2: 配信の雰囲気は？
  'energetic': [],  // 雰囲気はタグマッピングせず
  'calm': ['癒し系', 'ASMR'],
  'funny': [],
  'informative': [],

  // Q3: 視聴者層の好みは？
  'popular': [],
  'smallMedium': [],
  'newTalent': [],
  'noPreference': []
}

/**
 * 診断結果から推奨タグを生成
 * @param answers ユーザーの回答リスト
 * @returns 推奨タグの配列（重複なし、3-10個）
 */
export function mapAnswersToTags(answers: QuizAnswer[]): string[] {
  const tagSet = new Set<string>()

  // 各回答に紐づくタグを収集
  for (const answer of answers) {
    const tags = TAG_MAPPINGS[answer.answer] || []
    for (const tag of tags) {
      tagSet.add(tag)
    }
  }

  // Set → Array に変換
  const uniqueTags = Array.from(tagSet)

  // 最低3個、最大10個に制限
  if (uniqueTags.length < 3) {
    // タグが少ない場合は一般的なタグを追加
    const defaultTags = ['雑談', 'ゲーム', '歌']
    for (const tag of defaultTags) {
      if (uniqueTags.length >= 3) break
      if (!tagSet.has(tag)) {
        uniqueTags.push(tag)
      }
    }
  }

  // 最大10個に制限
  return uniqueTags.slice(0, 10)
}

/**
 * オンボーディング進捗から現在のステップを判定
 * @param progress オンボーディング進捗（nullの場合は未開始）
 * @returns 現在のステップ
 */
import type { OnboardingProgress } from './db.js'

export function determineCurrentStep(progress: OnboardingProgress | null): 'quiz' | 'tags' | 'tutorial' | 'completed' | null {
  if (!progress) {
    return null  // 未開始
  }

  if (progress.tutorial_completed) {
    return 'completed'
  }

  if (progress.tags_selected) {
    return 'tutorial'
  }

  if (progress.quiz_completed) {
    return 'tags'
  }

  return 'quiz'
}
