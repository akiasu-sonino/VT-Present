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
            Googleログインすると以下の機能が使えます。是非ログインして使ってください。
          </p>

          <div className="login-prompt-features">
            <div className="feature-item">
              <span className="feature-icon">✓</span>
              <span>コメント投稿・交流</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">✓</span>
              <span>タグの追加・編集</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">✓</span>
              <span>おすすめ配信者の推薦</span>
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
