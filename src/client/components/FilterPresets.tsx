import { useState, useEffect } from 'react'
import '../styles/FilterPresets.css'

export interface FilterPreset {
  id: string
  name: string
  tags: string[]
  tagOperator: 'OR' | 'AND'
  searchQuery: string
  minFollowers: number
  maxFollowers: number
  isBuiltIn?: boolean
}

interface FilterPresetsProps {
  onApplyPreset: (preset: FilterPreset) => void
  currentFilters: {
    tags: string[]
    tagOperator: 'OR' | 'AND'
    searchQuery: string
    minFollowers: number
    maxFollowers: number
  }
}

const BUILT_IN_PRESETS: FilterPreset[] = [
  {
    id: 'all',
    name: 'すべて',
    tags: [],
    tagOperator: 'OR',
    searchQuery: '',
    minFollowers: 0,
    maxFollowers: Number.MAX_SAFE_INTEGER,
    isBuiltIn: true
  }
]

function FilterPresets({ onApplyPreset, currentFilters }: FilterPresetsProps) {
  // 遅延初期化でlocalStorageから読み込む
  const [presets, setPresets] = useState<FilterPreset[]>(() => {
    const saved = localStorage.getItem('filterPresets')
    if (saved) {
      try {
        const userPresets = JSON.parse(saved) as FilterPreset[]
        return [...BUILT_IN_PRESETS, ...userPresets]
      } catch (err) {
        console.error('Failed to load presets:', err)
        return BUILT_IN_PRESETS
      }
    }
    return BUILT_IN_PRESETS
  })
  const [isOpen, setIsOpen] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [presetName, setPresetName] = useState('')

  // クリック外部でドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.filter-presets')) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const saveCurrentAsPreset = () => {
    if (!presetName.trim()) return

    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      ...currentFilters
    }

    const userPresets = presets.filter(p => !p.isBuiltIn)
    const updated = [...userPresets, newPreset]

    localStorage.setItem('filterPresets', JSON.stringify(updated))
    setPresets([...BUILT_IN_PRESETS, ...updated])
    setPresetName('')
    setShowSaveModal(false)
  }

  const deletePreset = (id: string) => {
    const updated = presets.filter(p => p.id !== id && !p.isBuiltIn)
    localStorage.setItem('filterPresets', JSON.stringify(updated))
    setPresets([...BUILT_IN_PRESETS, ...updated])
  }

  const hasActiveFilters =
    currentFilters.tags.length > 0 ||
    currentFilters.searchQuery.trim() !== '' ||
    currentFilters.minFollowers > 0 ||
    currentFilters.maxFollowers < Number.MAX_SAFE_INTEGER

  return (
    <div className="filter-presets">
      <button
        className={`filter-dropdown-button ${hasActiveFilters ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        プリセット {isOpen ? '▲' : '▼'}
        {hasActiveFilters && <span className="active-dot">●</span>}
      </button>

      {isOpen && (
        <div className="filter-dropdown-menu">
          <div className="presets-list">
            {presets.map(preset => (
              <div key={preset.id} className="preset-item">
                <button
                  className="preset-button"
                  onClick={() => {
                    onApplyPreset(preset)
                    setIsOpen(false)
                  }}
                >
                  {preset.name}
                </button>
                {!preset.isBuiltIn && (
                  <button
                    className="delete-button"
                    onClick={() => deletePreset(preset.id)}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              className="save-current-button"
              onClick={() => {
                setShowSaveModal(true)
                setIsOpen(false)
              }}
            >
              現在のフィルターを保存
            </button>
          )}
        </div>
      )}

      {showSaveModal && (
        <div className="save-modal" onClick={() => setShowSaveModal(false)}>
          <div className="save-modal-content" onClick={(e) => e.stopPropagation()}>
            <h4>フィルターを保存</h4>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="フィルター名を入力..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveCurrentAsPreset()
                if (e.key === 'Escape') setShowSaveModal(false)
              }}
              autoFocus
            />
            <div className="modal-buttons">
              <button onClick={saveCurrentAsPreset} disabled={!presetName.trim()}>
                保存
              </button>
              <button onClick={() => setShowSaveModal(false)}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FilterPresets
