import { useState } from 'react'

interface TutorialStepProps {
  onComplete: () => void
}

const tutorialSlides = [
  {
    title: "スワイプで好みを登録",
    description: "配信者カードの「好き」「普通」「スキップ」ボタンで好みを記録できます",
    icon: "👍",
    iconBg: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
  },
  {
    title: "タグでフィルター",
    description: "興味のあるタグを選んで、あなた好みの配信者を探せます",
    icon: "🏷️",
    iconBg: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
  },
  {
    title: "マイリストで管理",
    description: "お気に入りの配信者をマイリストで確認できます",
    icon: "⭐",
    iconBg: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
  },
  {
    title: "ログインのメリット",
    description: "ログインすると、コメント投稿やタグ編集が可能になります",
    icon: "🔐",
    iconBg: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"
  }
]

function TutorialStep({ onComplete }: TutorialStepProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)

  const currentSlide = tutorialSlides[currentSlideIndex]
  const isLastSlide = currentSlideIndex === tutorialSlides.length - 1

  const handleNext = () => {
    if (isLastSlide) {
      onComplete()
    } else {
      setCurrentSlideIndex(prev => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1)
    }
  }

  return (
    <div className="tutorial-step">
      <div className="tutorial-progress-dots">
        {tutorialSlides.map((_, index) => (
          <span
            key={index}
            className={`progress-dot ${index === currentSlideIndex ? 'active' : ''}`}
          />
        ))}
      </div>

      <div className="tutorial-slide">
        <div
          className="tutorial-icon"
          style={{ background: currentSlide.iconBg }}
        >
          <span className="icon-emoji">{currentSlide.icon}</span>
        </div>

        <h2 className="tutorial-title">{currentSlide.title}</h2>
        <p className="tutorial-description">{currentSlide.description}</p>
      </div>

      <div className="tutorial-navigation">
        {currentSlideIndex > 0 && (
          <button className="btn-secondary" onClick={handleBack}>
            戻る
          </button>
        )}
        <button className="btn-primary" onClick={handleNext}>
          {isLastSlide ? '始める' : '次へ'}
        </button>
      </div>
    </div>
  )
}

export default TutorialStep
