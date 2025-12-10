import { useState } from 'react'
import { quizQuestions } from './quizQuestions'

interface QuizStepProps {
  onComplete: (answers: Array<{ questionId: number; answer: string }>) => void
  onSkip: () => void
}

function QuizStep({ onComplete, onSkip }: QuizStepProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Array<{ questionId: number; answer: string }>>([])

  const currentQuestion = quizQuestions[currentQuestionIndex]
  const isLastQuestion = currentQuestionIndex === quizQuestions.length - 1

  const handleSelectOption = (optionValue: string) => {
    const newAnswers = [
      ...answers.filter(a => a.questionId !== currentQuestion.id),
      { questionId: currentQuestion.id, answer: optionValue }
    ]
    setAnswers(newAnswers)

    // 自動的に次の質問へ
    setTimeout(() => {
      if (isLastQuestion) {
        onComplete(newAnswers)
      } else {
        setCurrentQuestionIndex(prev => prev + 1)
      }
    }, 300)
  }

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
    }
  }

  const currentAnswer = answers.find(a => a.questionId === currentQuestion.id)?.answer

  return (
    <div className="quiz-step">
      <div className="quiz-progress">
        質問 {currentQuestionIndex + 1} / {quizQuestions.length}
      </div>

      <h2 className="quiz-question">{currentQuestion.question}</h2>

      <div className="quiz-options">
        {currentQuestion.options.map((option) => (
          <button
            key={option.value}
            className={`quiz-option ${currentAnswer === option.value ? 'selected' : ''}`}
            onClick={() => handleSelectOption(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="quiz-navigation">
        {currentQuestionIndex > 0 && (
          <button className="btn-secondary" onClick={handleBack}>
            戻る
          </button>
        )}
        <button className="btn-skip" onClick={onSkip}>
          スキップ
        </button>
      </div>
    </div>
  )
}

export default QuizStep
