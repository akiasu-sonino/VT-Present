import { useState } from 'react'

interface TagSelectionStepProps {
  recommendedTags: string[]
  onComplete: (selectedTags: string[]) => void
  onSkip: () => void
  onBack: () => void
}

function TagSelectionStep({ recommendedTags, onComplete, onSkip, onBack }: TagSelectionStepProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag))
    } else {
      setSelectedTags([...selectedTags, tag])
    }
  }

  const handleNext = () => {
    if (selectedTags.length > 0) {
      onComplete(selectedTags)
    }
  }

  return (
    <div className="tag-selection-step">
      <h2>おすすめのタグを選択</h2>
      <p className="tag-selection-description">
        あなたの好みに合った配信者を見つけやすくなります
      </p>

      <div className="recommended-tags">
        {recommendedTags.map((tag) => (
          <button
            key={tag}
            className={`tag-option ${selectedTags.includes(tag) ? 'selected' : ''}`}
            onClick={() => handleToggleTag(tag)}
          >
            #{tag}
            {selectedTags.includes(tag) && <span className="check-mark">✓</span>}
          </button>
        ))}
      </div>

      {selectedTags.length === 0 && (
        <p className="tag-selection-hint">
          ※ 最低1つ以上のタグを選択してください
        </p>
      )}

      <div className="tag-selection-navigation">
        <button className="btn-secondary" onClick={onBack}>
          戻る
        </button>
        <button className="btn-skip" onClick={onSkip}>
          スキップ
        </button>
        <button
          className="btn-primary"
          onClick={handleNext}
          disabled={selectedTags.length === 0}
        >
          次へ ({selectedTags.length}個選択中)
        </button>
      </div>
    </div>
  )
}

export default TagSelectionStep
