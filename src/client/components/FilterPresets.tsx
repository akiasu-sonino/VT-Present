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
  const [presets, setPresets] = useState<FilterPreset[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [presetName, setPresetName] = useState('')

  useEffect(() => {
    loadPresets()
  }, [])

  const loadPresets = () => {
    const saved = localStorage.getItem('filterPresets')
    if (saved) {
      try {
        const userPresets = JSON.parse(saved) as FilterPreset[]
        setPresets([...BUILT_IN_PRESETS, ...userPresets])
      } catch (err) {
        console.error('Failed to load presets:', err)
        setPresets(BUILT_IN_PRESETS)
      }
    } else {
      setPresets(BUILT_IN_PRESETS)
    }
  }

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
    <div className={`filter-presets ${isOpen ? 'open' : 'closed'}`}>
      <div className="filter-presets-header" onClick={() => setIsOpen(!isOpen)}>
        <h3>
          保存済みフィルター
          {hasActiveFilters && <span className="active-indicator">●</span>}
        </h3>
        <span className="toggle-icon">{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <div className="filter-presets-content">
          <div className="presets-list">
            {presets.map(preset => (
              <div key={preset.id} className="preset-item">
                <button
                  className="preset-button"
                  onClick={() => onApplyPreset(preset)}
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
              onClick={() => setShowSaveModal(true)}
            >
              現在のフィルターを保存
            </button>
          )}

          {showSaveModal && (
            <div className="save-modal">
              <div className="save-modal-content">
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
      )}
    </div>
  )
}

export default FilterPresets
