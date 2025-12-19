import '../../styles/Onboarding.css'

interface BasicsFeaturesStepProps {
  onComplete: () => void
}

function BasicsFeaturesStep({ onComplete }: BasicsFeaturesStepProps) {
  return (
    <div className="onboarding-step basics-features-step">
      <h2 className="step-title">ゆとりぃま～ず へようこそ！</h2>
      <p className="step-description">
        ゆとりぃま～ずは、YouTubeやTwitchなどプラットフォームで配信・動画投稿する配信者を発見・共有できるサービスです。
      </p>

      <div className="features-grid">
        <div className="feature-card">
          <div className="feature-icon">🎥</div>
          <h3 className="feature-title">動画を視聴</h3>
          <p className="feature-text">
            配信者カードをクリックして、YouTubeやTwitchの動画を直接視聴できます
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">💬</div>
          <h3 className="feature-title">コメント投稿</h3>
          <p className="feature-text">
            配信者の魅力や推しポイントをコメントで共有しましょう
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">🏷️</div>
          <h3 className="feature-title">タグでフィルタ</h3>
          <p className="feature-text">
            「FPS」「歌枠」「ASMR」などのタグで好みの配信者を探せます
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">⭐</div>
          <h3 className="feature-title">パーソナライズド推薦</h3>
          <p className="feature-text">
            あなたの好みに合わせた配信者をAIが推薦します
          </p>
        </div>
      </div>

      <div className="step-actions">
        <button className="btn-primary btn-large" onClick={onComplete}>
          次へ：好みの診断
        </button>
      </div>
    </div>
  )
}

export default BasicsFeaturesStep
