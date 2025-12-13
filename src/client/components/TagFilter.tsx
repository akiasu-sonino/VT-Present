import { useState, useEffect } from 'react'
import '../styles/TagFilter.css'

interface TagFilterProps {
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  tagOperator?: 'OR' | 'AND'
  onTagOperatorChange?: (operator: 'OR' | 'AND') => void
}

// タグのカテゴリ定義
const TAG_CATEGORIES: Record<string, string[]> = {
  'ゲーム配信': ['ゲーム', 'FPS', 'RPG', 'アクション', '格ゲー', 'ホラゲー', 'マイクラ', 'APEX', 'Valorant'],
  'エンタメ': ['歌ってみた', '雑談', 'ASMR', '料理', 'お絵描き', '踊ってみた', '楽器演奏'],
  '学習・教養': ['プログラミング', '勉強', '英語', '読書', '解説'],
  'その他': []  // マッチしないタグはその他に
}

function categorizeTag(tag: string): string {
  for (const [category, tags] of Object.entries(TAG_CATEGORIES)) {
    if (tags.includes(tag)) {
      return category
    }
  }
  return 'その他'
}

function TagFilter({
  selectedTags,
  onTagsChange,
  tagOperator = 'OR',
  onTagOperatorChange
}: TagFilterProps) {
  const [allTags, setAllTags] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchTags()
  }, [])

  // クリック外部でドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.tag-filter')) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const fetchTags = async () => {
    // (タグの取得ロジックは変更なし)
    try {
      setLoading(true)
      const response = await fetch('/api/tags')
      const data = await response.json()

      if (response.ok) {
        setAllTags(data.tags)
        setError(null)
      } else {
        setError('タグの取得に失敗しました')
      }
    } catch (err) {
      setError('タグの取得に失敗しました')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleTagClick = (tag: string) => {
    // (タグの選択・解除ロジックは変更なし)
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag))
    } else {
      onTagsChange([...selectedTags, tag])
    }
  }

  const handleClearAll = () => {
    onTagsChange([])
  }

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  // 検索フィルタリング
  const filteredTags = allTags.filter(tag =>
    tag.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // カテゴリごとにタグを分類
  const categorizedTags: Record<string, string[]> = {}
  filteredTags.forEach(tag => {
    const category = categorizeTag(tag)
    if (!categorizedTags[category]) {
      categorizedTags[category] = []
    }
    categorizedTags[category].push(tag)
  })

  // 未選択タグのみを抽出
  const unselectedTags = filteredTags.filter(tag => !selectedTags.includes(tag))

  // 検索中は全カテゴリを展開
  const isSearching = searchQuery.trim().length > 0

  if (loading) {
    return (
      <div className="tag-filter">
        <button className="filter-dropdown-button" disabled>
          タグ (読込中...)
        </button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="tag-filter">
        <button className="filter-dropdown-button" disabled>
          タグ (エラー)
        </button>
      </div>
    )
  }

  return (
    <div className="tag-filter">
      <button
        className={`filter-dropdown-button ${selectedTags.length > 0 ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        タグ {isOpen ? '▲' : '▼'}
        {selectedTags.length > 0 && (
          <span className="active-badge">{selectedTags.length}</span>
        )}
      </button>

      {isOpen && (
        <div className="filter-dropdown-menu tag-filter-wide">
          {/* 検索ボックス */}
          <div className="tag-search-box">
            <input
              type="text"
              placeholder="タグを検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="tag-search-input"
            />
          </div>

          {/* 選択済みタグ */}
          {selectedTags.length > 0 && (
            <div className="selected-tags-section">
              <div className="tag-section-header">
                <span>選択中</span>
                <button className="clear-tags-button" onClick={handleClearAll}>
                  すべて解除
                </button>
              </div>
              <div className="tag-list">
                {selectedTags.map(tag => (
                  <button
                    key={tag}
                    className="tag-button selected"
                    onClick={() => handleTagClick(tag)}
                  >
                    {tag} ×
                  </button>
                ))}
              </div>
              {selectedTags.length > 1 && onTagOperatorChange && (
                <div className="tag-operator-toggle">
                  <label>
                    <input
                      type="radio"
                      name="tagOperator"
                      value="OR"
                      checked={tagOperator === 'OR'}
                      onChange={() => onTagOperatorChange('OR')}
                    />
                    <span>OR</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="tagOperator"
                      value="AND"
                      checked={tagOperator === 'AND'}
                      onChange={() => onTagOperatorChange('AND')}
                    />
                    <span>AND</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* カテゴリ別タグ一覧（アコーディオン形式） */}
          <div className="tags-by-category">
            {Object.entries(categorizedTags).map(([category, tags]) => {
              // 選択済みタグを除外
              const categoryUnselectedTags = tags.filter(tag => !selectedTags.includes(tag))
              if (categoryUnselectedTags.length === 0) return null

              const isExpanded = isSearching || expandedCategories.has(category)
              const tagCount = categoryUnselectedTags.length

              return (
                <div key={category} className="tag-category">
                  <div
                    className="tag-category-header clickable"
                    onClick={() => toggleCategory(category)}
                  >
                    <span className="category-title">
                      {category}
                      <span className="category-count">({tagCount})</span>
                    </span>
                    <span className="category-arrow">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                  {isExpanded && (
                    <div className="tag-list">
                      {categoryUnselectedTags.map(tag => (
                        <button
                          key={tag}
                          className="tag-button"
                          onClick={() => handleTagClick(tag)}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {unselectedTags.length === 0 && searchQuery && (
            <div className="no-results">「{searchQuery}」に一致するタグが見つかりません</div>
          )}
        </div>
      )}
    </div>
  )
}

export default TagFilter