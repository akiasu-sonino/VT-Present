import { useState, MouseEvent } from 'react'
import { getTagCategory, categoryColors, getTagDescription, type TagCategory } from '../utils/tagUtils'
import '../styles/Tag.css'

interface TagProps {
  tag: string
  onClick?: (tag: string) => void
  showTooltip?: boolean
  size?: 'small' | 'medium'
  interactive?: boolean
}

function Tag({ tag, onClick, showTooltip = true, size = 'small', interactive = true }: TagProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false)

  const category = getTagCategory(tag)
  const colors = categoryColors[category]
  const description = getTagDescription(tag)

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation()
    if (interactive && onClick) {
      onClick(tag)
    }
  }

  const handleMouseEnter = () => {
    if (showTooltip) {
      setTooltipVisible(true)
    }
  }

  const handleMouseLeave = () => {
    setTooltipVisible(false)
  }

  return (
    <span
      className={`tag-enhanced tag-${category} tag-${size} ${interactive && onClick ? 'tag-clickable' : ''}`}
      style={{
        background: colors.bg,
        color: colors.text,
        borderColor: colors.border,
      }}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role={interactive && onClick ? 'button' : undefined}
      tabIndex={interactive && onClick ? 0 : undefined}
    >
      <span className="tag-icon">{getCategoryIcon(category)}</span>
      <span className="tag-text">#{tag}</span>
      {showTooltip && tooltipVisible && (
        <span className="tag-tooltip">
          <span className="tooltip-category">{description}</span>
          {interactive && onClick && (
            <span className="tooltip-action">クリックでフィルター</span>
          )}
        </span>
      )}
    </span>
  )
}

// カテゴリごとのアイコンを取得
function getCategoryIcon(category: TagCategory): string {
  const icons: Record<TagCategory, string> = {
    gaming: '🎮',
    asmr: '🎧',
    chat: '💬',
    entertainment: '🎪',
    music: '🎵',
    creative: '🎨',
    other: '📌',
  }
  return icons[category]
}

export default Tag
