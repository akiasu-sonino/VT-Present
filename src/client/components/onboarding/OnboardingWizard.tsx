import { useState } from 'react'
import QuizStep from './QuizStep'
import TagSelectionStep from './TagSelectionStep'
import TutorialStep from './TutorialStep'
import '../../styles/Onboarding.css'

interface OnboardingWizardProps {
  isOpen: boolean
  onComplete: (selectedTags: string[]) => void
  onSkip: () => void
}

type Step = 'quiz' | 'tags' | 'tutorial'

interface QuizAnswer {
  questionId: number
  answer: string
}

function OnboardingWizard({ isOpen, onComplete, onSkip }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>('quiz')
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer[]>([])
  const [recommendedTags, setRecommendedTags] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleQuizComplete = async (answers: QuizAnswer[]) => {
    setQuizAnswers(answers)
    setLoading(true)

    try {
      // 診断結果をAPIに送信
      const response = await fetch('/api/onboarding/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers })
      })

      if (response.ok) {
        const data = await response.json()
        setRecommendedTags(data.recommendedTags || [])
        setCurrentStep('tags')
      } else {
        console.error('Failed to save quiz results')
        // エラーの場合もタグ選択に進む
        setCurrentStep('tags')
      }
    } catch (error) {
      console.error('Error saving quiz results:', error)
      // エラーの場合もタグ選択に進む
      setCurrentStep('tags')
    } finally {
      setLoading(false)
    }
  }

  const handleTagSelectionComplete = async (tags: string[]) => {
    setSelectedTags(tags)
    setLoading(true)

    try {
      // タグ選択をAPIに送信
      const response = await fetch('/api/onboarding/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedTags: tags })
      })

      if (response.ok) {
        setCurrentStep('tutorial')
      } else {
        console.error('Failed to save tag selection')
        // エラーの場合もチュートリアルに進む
        setCurrentStep('tutorial')
      }
    } catch (error) {
      console.error('Error saving tag selection:', error)
      // エラーの場合もチュートリアルに進む
      setCurrentStep('tutorial')
    } finally {
      setLoading(false)
    }
  }

  const handleTutorialComplete = async () => {
    setLoading(true)

    try {
      // チュートリアル完了をAPIに送信
      const response = await fetch('/api/onboarding/tutorial-complete', {
        method: 'POST'
      })

      if (response.ok) {
        onComplete(selectedTags)
      } else {
        console.error('Failed to complete onboarding')
        // エラーの場合も完了扱いにする
        onComplete(selectedTags)
      }
    } catch (error) {
      console.error('Error completing onboarding:', error)
      // エラーの場合も完了扱いにする
      onComplete(selectedTags)
    } finally {
      setLoading(false)
    }
  }

  const handleQuizSkip = () => {
    setCurrentStep('tags')
  }

  const handleTagSkip = () => {
    setCurrentStep('tutorial')
  }

  const handleBackToQuiz = () => {
    setCurrentStep('quiz')
  }

  const getStepNumber = () => {
    switch (currentStep) {
      case 'quiz':
        return 1
      case 'tags':
        return 2
      case 'tutorial':
        return 3
      default:
        return 1
    }
  }

  return (
    <div className="onboarding-overlay" onClick={onSkip}>
      <div className="onboarding-modal" onClick={(e) => e.stopPropagation()}>
        {loading && (
          <div className="onboarding-loading">
            <div className="loading-spinner"></div>
          </div>
        )}

        <div className="onboarding-header">
          <h1 className="onboarding-title">ようこそ OshiStream へ</h1>
          <div className="step-indicator">
            ステップ {getStepNumber()} / 3
          </div>
        </div>

        <div className="onboarding-content">
          {currentStep === 'quiz' && (
            <QuizStep
              onComplete={handleQuizComplete}
              onSkip={handleQuizSkip}
            />
          )}

          {currentStep === 'tags' && (
            <TagSelectionStep
              recommendedTags={recommendedTags}
              onComplete={handleTagSelectionComplete}
              onSkip={handleTagSkip}
              onBack={handleBackToQuiz}
            />
          )}

          {currentStep === 'tutorial' && (
            <TutorialStep
              onComplete={handleTutorialComplete}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default OnboardingWizard
