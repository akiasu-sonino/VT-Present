import '../../styles/Onboarding.css'

interface LoginPromptModalProps {
  isOpen: boolean
  onLogin: () => void
  onContinueAnonymous: () => void
}

function LoginPromptModal({ isOpen, onLogin, onContinueAnonymous }: LoginPromptModalProps) {
  if (!isOpen) return null

  return (
    <div className="onboarding-overlay" onClick={onContinueAnonymous}>
      <div className="onboarding-modal login-prompt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="login-prompt-content">
          <div className="login-prompt-icon">👋</div>
          <h2 className="login-prompt-title">OshiStream へようこそ！</h2>
          <p className="login-prompt-description">
            ログインすると、好みの配信者をパーソナライズドおすすめで見つけやすくなります
          </p>

          <div className="login-prompt-features">
            <div className="feature-item">
              <span className="feature-icon">✓</span>
              <span>コメント投稿</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">✓</span>
              <span>タグ編集</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">✓</span>
              <span>パーソナライズド推薦</span>
            </div>
          </div>

          <div className="login-prompt-actions">
            <button className="btn-primary btn-large" onClick={onLogin}>
              ログインして始める
            </button>
            <button className="btn-secondary" onClick={onContinueAnonymous}>
              匿名で続ける
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPromptModal
