// タグカテゴリの定義
export type TagCategory = 'gaming' | 'asmr' | 'chat' | 'entertainment' | 'music' | 'creative' | 'other'

// カテゴリごとの色設定
export const categoryColors: Record<TagCategory, { bg: string; text: string; border: string }> = {
  gaming: {
    bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    text: '#0c4a6e',
    border: '#38bdf8',
  },
  asmr: {
    bg: 'linear-gradient(135deg, #a78bfa 0%, #c084fc 100%)',
    text: '#4c1d95',
    border: '#a78bfa',
  },
  chat: {
    bg: 'linear-gradient(135deg, #fb923c 0%, #fdba74 100%)',
    text: '#7c2d12',
    border: '#fb923c',
  },
  entertainment: {
    bg: 'linear-gradient(135deg, #f472b6 0%, #fb7185 100%)',
    text: '#831843',
    border: '#f472b6',
  },
  music: {
    bg: 'linear-gradient(135deg, #34d399 0%, #6ee7b7 100%)',
    text: '#064e3b',
    border: '#34d399',
  },
  creative: {
    bg: 'linear-gradient(135deg, #fbbf24 0%, #fcd34d 100%)',
    text: '#78350f',
    border: '#fbbf24',
  },
  other: {
    bg: 'linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%)',
    text: '#1e293b',
    border: '#94a3b8',
  },
}

// カテゴリごとの説明
export const categoryDescriptions: Record<TagCategory, string> = {
  gaming: 'ゲーム配信・実況プレイ',
  asmr: 'ASMR・癒し系コンテンツ',
  chat: '雑談・トーク配信',
  entertainment: 'エンタメ・バラエティ',
  music: '歌・音楽配信',
  creative: '創作・お絵描き配信',
  other: 'その他のコンテンツ',
}

// タグとカテゴリのマッピング
const tagCategoryMap: Record<string, TagCategory> = {
  // Gaming
  'ゲーム': 'gaming',
  'ゲーム実況': 'gaming',
  'FPS': 'gaming',
  'Apex': 'gaming',
  'APEX': 'gaming',
  'VALORANT': 'gaming',
  'ヴァロラント': 'gaming',
  'マイクラ': 'gaming',
  'Minecraft': 'gaming',
  'フォートナイト': 'gaming',
  'Fortnite': 'gaming',
  'スプラトゥーン': 'gaming',
  'ポケモン': 'gaming',
  'モンハン': 'gaming',
  '原神': 'gaming',
  'スト6': 'gaming',
  '格ゲー': 'gaming',
  'RPG': 'gaming',
  'ホラゲー': 'gaming',
  'ホラー': 'gaming',
  '麻雀': 'gaming',
  '将棋': 'gaming',
  'チェス': 'gaming',
  'League of Legends': 'gaming',
  'LoL': 'gaming',
  'スマブラ': 'gaming',
  '桃鉄': 'gaming',
  'Among Us': 'gaming',
  'Rust': 'gaming',
  'ARK': 'gaming',
  'DbD': 'gaming',
  '第五人格': 'gaming',

  // ASMR
  'ASMR': 'asmr',
  '耳かき': 'asmr',
  '囁き': 'asmr',
  'ささやき': 'asmr',
  '睡眠': 'asmr',
  '癒し': 'asmr',
  'リラックス': 'asmr',
  'バイノーラル': 'asmr',
  '添い寝': 'asmr',

  // Chat
  '雑談': 'chat',
  'トーク': 'chat',
  'おしゃべり': 'chat',
  '晩酌': 'chat',
  '酒': 'chat',
  '飲酒': 'chat',
  '料理': 'chat',
  '作業配信': 'chat',
  '朝活': 'chat',
  '夜活': 'chat',
  'ラジオ': 'chat',
  '相談': 'chat',

  // Entertainment
  'エンタメ': 'entertainment',
  'バラエティ': 'entertainment',
  '企画': 'entertainment',
  'コラボ': 'entertainment',
  'ネタ': 'entertainment',
  '面白い': 'entertainment',
  'おもしろ': 'entertainment',
  '検証': 'entertainment',
  'RTA': 'entertainment',
  '凸待ち': 'entertainment',
  'カラオケ': 'entertainment',
  '耐久': 'entertainment',
  '大会': 'entertainment',

  // Music
  '歌': 'music',
  '歌枠': 'music',
  '歌配信': 'music',
  '歌ってみた': 'music',
  'カバー': 'music',
  'オリジナル曲': 'music',
  'ボカロ': 'music',
  'VOCALOID': 'music',
  'DJ': 'music',
  '弾き語り': 'music',
  'ピアノ': 'music',
  'ギター': 'music',

  // Creative
  'イラスト': 'creative',
  'お絵描き': 'creative',
  '絵': 'creative',
  '作業': 'creative',
  'Live2D': 'creative',
  '3D': 'creative',
  'モデリング': 'creative',
  'プログラミング': 'creative',
  'DTM': 'creative',
  '作曲': 'creative',
}

// タグからカテゴリを取得
export function getTagCategory(tag: string): TagCategory {
  // 完全一致
  if (tagCategoryMap[tag]) {
    return tagCategoryMap[tag]
  }

  // 部分一致（大文字小文字無視）
  const lowerTag = tag.toLowerCase()
  for (const [key, category] of Object.entries(tagCategoryMap)) {
    if (lowerTag.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerTag)) {
      return category
    }
  }

  return 'other'
}

// タグの優先順位を取得（低いほど優先）
const categoryPriority: Record<TagCategory, number> = {
  gaming: 1,
  asmr: 2,
  music: 3,
  entertainment: 4,
  chat: 5,
  creative: 6,
  other: 10,
}

// タグをソート（カテゴリ優先順位順）
export function sortTags(tags: string[]): string[] {
  return [...tags].sort((a, b) => {
    const categoryA = getTagCategory(a)
    const categoryB = getTagCategory(b)
    const priorityA = categoryPriority[categoryA]
    const priorityB = categoryPriority[categoryB]

    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }

    // 同じカテゴリ内では文字列順
    return a.localeCompare(b, 'ja')
  })
}

// タグの説明を取得
export function getTagDescription(tag: string): string {
  const category = getTagCategory(tag)
  return categoryDescriptions[category]
}
