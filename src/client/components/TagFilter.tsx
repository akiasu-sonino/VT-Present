import { useState, useEffect } from 'react'
import '../styles/TagFilter.css'
// 必要に応じてアイコンライブラリをインポート
// 例: import { ChevronDown, ChevronUp } from 'lucide-react'; 
// (ここでは便宜上、HTMLエンティティ '▼' と '▲' を使います)

interface TagFilterProps {
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  tagOperator?: 'OR' | 'AND'
  onTagOperatorChange?: (operator: 'OR' | 'AND') => void
}

function TagFilter({
  selectedTags,
  onTagsChange,
  tagOperator = 'OR',
  onTagOperatorChange
}: TagFilterProps) {
  const [allTags, setAllTags] = useState<string[]>([])
  // ★ 1. 展開状態を管理するステートを追加 (デフォルトで閉じている)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTags()
  }, [])

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

  // ★ 2. 開閉を切り替えるハンドラ
  const handleToggle = () => {
    setIsOpen(prev => !prev)
  }

  if (loading) {
    return (
      <div className="tag-filter loading">
        <p>タグを読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="tag-filter error">
        <p>{error}</p>
      </div>
    )
  }

  return (
    // ★ 展開状態に応じてクラスを追加 (CSSでのスタイリング用)
    <div className={`tag-filter ${isOpen ? 'open' : 'closed'}`}>

      {/* ★ 3. ヘッダーをクリック可能にし、開閉を切り替える */}
      <div className="tag-filter-header-toggle" onClick={handleToggle}>
        <h3>
          タグでフィルター
          {selectedTags.length > 0 && (
            <span className="selected-count">{selectedTags.length}</span>
          )}
        </h3>
        {/* 開閉インジケーター */}
        <span className="toggle-icon">
          {isOpen ? '▲' : '▼'}
        </span>
      </div>

      {/* ★ 4. タグのクリアボタンとタグリストを isOpen の時だけ表示 */}
      {isOpen && (
        <div className="tag-filter-content">
          <div className="tag-filter-controls">
            {selectedTags.length > 0 && (
              <div className="clear-button-container">
                <button className="clear-tags-button" onClick={handleClearAll}>
                  すべて解除
                </button>
              </div>
            )}
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
                  <span>いずれか (OR)</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="tagOperator"
                    value="AND"
                    checked={tagOperator === 'AND'}
                    onChange={() => onTagOperatorChange('AND')}
                  />
                  <span>すべて (AND)</span>
                </label>
              </div>
            )}
          </div>
          <div className="tag-list">
            {(allTags || []).map(tag => (
              <button
                key={tag}
                className={`tag-button ${selectedTags.includes(tag) ? 'selected' : ''}`}
                onClick={() => handleTagClick(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default TagFilter