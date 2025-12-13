import { useState, useEffect } from 'react'
import '../styles/FollowerFilter.css'

interface FollowerFilterProps {
  minFollowers: number
  maxFollowers: number
  onMinFollowersChange: (value: number) => void
  onMaxFollowersChange: (value: number) => void
}

function FollowerFilter({
  minFollowers,
  maxFollowers,
  onMinFollowersChange,
  onMaxFollowersChange
}: FollowerFilterProps) {
  const [isOpen, setIsOpen] = useState(false)

  // クリック外部でドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.follower-filter')) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleClear = () => {
    onMinFollowersChange(0)
    onMaxFollowersChange(Number.MAX_SAFE_INTEGER)
  }

  const hasFilter = minFollowers > 0 || maxFollowers < Number.MAX_SAFE_INTEGER

  // プリセット値
  const presets = [
    { label: '1K未満', min: 0, max: 1000 },
    { label: '1K-10K', min: 1000, max: 10000 },
    { label: '10K-100K', min: 10000, max: 100000 },
    { label: '100K以上', min: 100000, max: Number.MAX_SAFE_INTEGER }
  ]

  const handlePresetClick = (min: number, max: number) => {
    onMinFollowersChange(min)
    onMaxFollowersChange(max)
  }

  return (
    <div className="follower-filter">
      <button
        className={`filter-dropdown-button ${hasFilter ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        フォロワー {isOpen ? '▲' : '▼'}
        {hasFilter && <span className="active-dot">●</span>}
      </button>

      {isOpen && (
        <div className="filter-dropdown-menu">
          <div className="follower-presets">
            {presets.map((preset, index) => (
              <button
                key={index}
                className={`preset-button ${
                  minFollowers === preset.min && maxFollowers === preset.max ? 'selected' : ''
                }`}
                onClick={() => handlePresetClick(preset.min, preset.max)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="follower-range-inputs">
            <div className="input-group">
              <label>最小</label>
              <input
                type="number"
                min="0"
                value={minFollowers === 0 ? '' : minFollowers}
                onChange={(e) => onMinFollowersChange(Number(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            <span className="range-separator">〜</span>
            <div className="input-group">
              <label>最大</label>
              <input
                type="number"
                min="0"
                value={maxFollowers === Number.MAX_SAFE_INTEGER ? '' : maxFollowers}
                onChange={(e) => onMaxFollowersChange(Number(e.target.value) || Number.MAX_SAFE_INTEGER)}
                placeholder="無制限"
              />
            </div>
          </div>

          {hasFilter && (
            <div className="clear-button-container">
              <button className="clear-button" onClick={handleClear}>
                クリア
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default FollowerFilter
