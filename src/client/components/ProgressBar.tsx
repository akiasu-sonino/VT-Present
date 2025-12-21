import { useEffect, useState, useRef } from 'react'
import '../styles/ProgressBar.css'

interface ProgressBarProps {
  isLoading: boolean
}

function ProgressBar({ isLoading }: ProgressBarProps) {
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isLoading) {
      setVisible(true)
      setProgress(0)

      // NProgress風のインクリメント
      // 最初は速く、徐々に遅くなる
      intervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            return prev // 90%で停止、完了を待つ
          }
          // 進捗に応じて増加量を減らす
          const increment = Math.max(1, (90 - prev) * 0.1)
          return Math.min(90, prev + increment)
        })
      }, 200)
    } else {
      // ローディング完了
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      if (visible) {
        // 100%に到達してからフェードアウト
        setProgress(100)
        setTimeout(() => {
          setVisible(false)
          setProgress(0)
        }, 300)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isLoading, visible])

  if (!visible) return null

  return (
    <div className="progress-bar-container">
      <div
        className="progress-bar"
        style={{ width: `${progress}%` }}
      />
      <div className="progress-bar-glow" style={{ left: `${progress}%` }} />
    </div>
  )
}

export default ProgressBar
