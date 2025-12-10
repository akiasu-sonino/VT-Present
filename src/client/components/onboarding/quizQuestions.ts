/**
 * オンボーディング診断質問定義
 * バックエンドのタグマッピング（src/lib/onboarding.ts）と同期させる必要がある
 */

export interface QuizOption {
  value: string
  label: string
  tags: string[]
}

export interface QuizQuestion {
  id: number
  question: string
  options: QuizOption[]
}

export const quizQuestions: QuizQuestion[] = [
  {
    id: 1,
    question: "好きな配信ジャンルは？",
    options: [
      { value: "game", label: "ゲーム実況", tags: ["FPS", "RPG", "レトロゲーム", "ゲーム"] },
      { value: "chat", label: "雑談配信", tags: ["雑談", "ASMR"] },
      { value: "music", label: "歌ってみた", tags: ["歌", "歌枠"] },
      { value: "creative", label: "制作配信", tags: ["お絵描き", "プログラミング"] }
    ]
  },
  {
    id: 2,
    question: "配信の雰囲気は？",
    options: [
      { value: "energetic", label: "元気・ハイテンション", tags: [] },
      { value: "calm", label: "落ち着いている・癒し系", tags: ["癒し系", "ASMR"] },
      { value: "funny", label: "面白い・ネタ系", tags: [] },
      { value: "informative", label: "情報発信・解説系", tags: [] }
    ]
  },
  {
    id: 3,
    question: "視聴者層の好みは？",
    options: [
      { value: "popular", label: "人気配信者", tags: [] },
      { value: "smallMedium", label: "中堅配信者", tags: [] },
      { value: "newTalent", label: "新人・発掘枠", tags: [] },
      { value: "noPreference", label: "特にこだわらない", tags: [] }
    ]
  }
]
