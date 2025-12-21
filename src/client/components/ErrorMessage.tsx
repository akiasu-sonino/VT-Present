import { useState } from 'react'
import '../styles/ErrorMessage.css'

// エラータイプ
export type ErrorType = 'network' | 'server' | 'validation' | 'unknown'

// エラー情報
export interface ErrorInfo {
  type: ErrorType
  message: string
  details?: string
  retryable?: boolean
}

// エラー解析ユーティリティ
export function parseError(error: unknown): ErrorInfo {
  // ネットワークエラー
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: 'network',
      message: 'ネットワークに接続できません',
      details: error.message,
      retryable: true,
    }
  }

  // Responseエラー
  if (error instanceof Response) {
    if (error.status >= 500) {
      return {
        type: 'server',
        message: 'サーバーでエラーが発生しました',
        details: `HTTP ${error.status}: ${error.statusText}`,
        retryable: true,
      }
    }
    if (error.status >= 400) {
      return {
        type: 'validation',
        message: 'リクエストが無効です',
        details: `HTTP ${error.status}: ${error.statusText}`,
        retryable: false,
      }
    }
  }

  // Errorオブジェクト
  if (error instanceof Error) {
    // ネットワーク関連のエラーメッセージをチェック
    if (
      error.message.includes('network') ||
      error.message.includes('Network') ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('net::')
    ) {
      return {
        type: 'network',
        message: 'ネットワークに接続できません',
        details: error.message,
        retryable: true,
      }
    }

    return {
      type: 'unknown',
      message: error.message || '予期しないエラーが発生しました',
      details: error.stack,
      retryable: true,
    }
  }

  // 文字列エラー
  if (typeof error === 'string') {
    return {
      type: 'unknown',
      message: error,
      retryable: true,
    }
  }

  // その他
  return {
    type: 'unknown',
    message: '予期しないエラーが発生しました',
    details: String(error),
    retryable: true,
  }
}

// アイコンコンポーネント
function NetworkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a5 5 0 01-7.072 0M3.757 5.636a9 9 0 0112.728 0" />
    </svg>
  )
}

function ServerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  )
}

function ValidationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
}

function UnknownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

interface ErrorMessageProps {
  error: ErrorInfo | string
  onRetry?: () => void
  className?: string
}

function ErrorMessage({ error, onRetry, className = '' }: ErrorMessageProps) {
  const [showDetails, setShowDetails] = useState(false)

  // 文字列の場合はErrorInfoに変換
  const errorInfo: ErrorInfo =
    typeof error === 'string'
      ? { type: 'unknown', message: error, retryable: true }
      : error

  const icons: Record<ErrorType, JSX.Element> = {
    network: <NetworkIcon />,
    server: <ServerIcon />,
    validation: <ValidationIcon />,
    unknown: <UnknownIcon />,
  }

  const titles: Record<ErrorType, string> = {
    network: 'ネットワークエラー',
    server: 'サーバーエラー',
    validation: '入力エラー',
    unknown: 'エラー',
  }

  return (
    <div className={`error-message error-${errorInfo.type} ${className}`}>
      <div className="error-icon">{icons[errorInfo.type]}</div>
      <div className="error-content">
        <div className="error-title">{titles[errorInfo.type]}</div>
        <div className="error-text">{errorInfo.message}</div>

        {errorInfo.details && (
          <div className="error-details-section">
            <button
              className="error-details-toggle"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? '詳細を隠す ▲' : '詳細を表示 ▼'}
            </button>
            {showDetails && (
              <pre className="error-details-content">{errorInfo.details}</pre>
            )}
          </div>
        )}
      </div>

      {errorInfo.retryable && onRetry && (
        <button className="error-retry-btn" onClick={onRetry}>
          <RefreshIcon />
          再試行
        </button>
      )}
    </div>
  )
}

export default ErrorMessage
