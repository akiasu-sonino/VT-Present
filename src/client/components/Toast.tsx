import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import '../styles/Toast.css'

// トーストの種類
type ToastType = 'success' | 'error' | 'warning' | 'info'

// トーストデータ
interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  details?: string // 開発者向け詳細
  duration?: number // ミリ秒
  exiting?: boolean
}

// コンテキスト型
interface ToastContextType {
  showToast: (toast: Omit<Toast, 'id' | 'exiting'>) => void
  showSuccess: (title: string, message?: string) => void
  showError: (title: string, message?: string, details?: string) => void
  showWarning: (title: string, message?: string) => void
  showInfo: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

// アイコンコンポーネント
function SuccessIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

// 個別トーストコンポーネント
function ToastItem({ toast, onClose }: { toast: Toast; onClose: (id: string) => void }) {
  const [showDetails, setShowDetails] = useState(false)

  const icons = {
    success: <SuccessIcon />,
    error: <ErrorIcon />,
    warning: <WarningIcon />,
    info: <InfoIcon />,
  }

  return (
    <div className={`toast toast-${toast.type} ${toast.exiting ? 'exiting' : ''}`}>
      <div className="toast-icon">{icons[toast.type]}</div>
      <div className="toast-content">
        <div className="toast-title">{toast.title}</div>
        {toast.message && <div className="toast-message">{toast.message}</div>}
        {toast.details && (
          <div className="toast-details">
            <button
              className="toast-details-toggle"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? '詳細を隠す' : '詳細を表示'}
            </button>
            {showDetails && (
              <div className="toast-details-content">{toast.details}</div>
            )}
          </div>
        )}
      </div>
      <button className="toast-close" onClick={() => onClose(toast.id)}>
        <CloseIcon />
      </button>
      <div className="toast-progress" style={{ animationDuration: `${toast.duration || 3000}ms` }} />
    </div>
  )
}

// トーストプロバイダー
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    // まず exiting 状態に
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    )
    // アニメーション後に削除
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 200)
  }, [])

  const showToast = useCallback(
    (toast: Omit<Toast, 'id' | 'exiting'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const duration = toast.duration || 3000

      setToasts((prev) => [...prev, { ...toast, id, exiting: false }])

      // 自動削除
      setTimeout(() => {
        removeToast(id)
      }, duration)
    },
    [removeToast]
  )

  const showSuccess = useCallback(
    (title: string, message?: string) => {
      showToast({ type: 'success', title, message })
    },
    [showToast]
  )

  const showError = useCallback(
    (title: string, message?: string, details?: string) => {
      showToast({ type: 'error', title, message, details, duration: 5000 })
    },
    [showToast]
  )

  const showWarning = useCallback(
    (title: string, message?: string) => {
      showToast({ type: 'warning', title, message })
    },
    [showToast]
  )

  const showInfo = useCallback(
    (title: string, message?: string) => {
      showToast({ type: 'info', title, message })
    },
    [showToast]
  )

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning, showInfo }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// カスタムフック
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
