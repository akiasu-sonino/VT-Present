import { useState, FormEvent } from 'react'
import '../styles/StreamerRequestForm.css'

interface RequestFormData {
  youtubeHandle: string
  requesterType: 'streamer' | 'supporter' | ''
  additionalNotes: string
}

interface User {
  id: number
  email: string
  name: string | null
  avatar_url: string | null
}

interface StreamerRequestFormProps {
  currentUser: User | null
  onLoginRequired?: () => void
  onSuccess?: () => void
}

function StreamerRequestForm({ currentUser, onLoginRequired, onSuccess }: StreamerRequestFormProps) {
  const [formData, setFormData] = useState<RequestFormData>({
    youtubeHandle: '',
    requesterType: '',
    additionalNotes: ''
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    // 未ログインチェック
    if (!currentUser) {
      setError('ログインが必要です')
      onLoginRequired?.()
      return
    }

    // バリデーション
    if (!formData.youtubeHandle.trim()) {
      setError('YouTubeハンドル名を入力してください')
      return
    }

    if (!formData.requesterType) {
      setError('申請者タイプを選択してください')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/streamers/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          youtubeHandle: formData.youtubeHandle,
          requesterType: formData.requesterType,
          additionalNotes: formData.additionalNotes || undefined
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '登録リクエストの送信に失敗しました')
      }

      if (data.success) {
        setSuccess(true)
        setFormData({
          youtubeHandle: '',
          requesterType: '',
          additionalNotes: ''
        })
        onSuccess?.()
      } else {
        throw new Error(data.error || '登録リクエストの処理に失敗しました')
      }
    } catch (err: any) {
      setError(err.message || '予期しないエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // 未ログイン時の表示
  if (!currentUser) {
    return (
      <div className="streamer-request-form-container">
        <div className="form-header">
          <h2>配信者・VTuber 登録申請</h2>
          <p className="form-description">
            配信者本人または応援者の方から、新しい配信者・VTuberの登録申請を受け付けています。
          </p>
        </div>

        <div className="login-required-message">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path
              d="M24 4C12.96 4 4 12.96 4 24s8.96 20 20 20 20-8.96 20-20S35.04 4 24 4zm0 6c3.32 0 6 2.68 6 6s-2.68 6-6 6-6-2.68-6-6 2.68-6 6-6zm0 28c-5 0-9.42-2.56-12-6.44.06-3.98 8-6.16 12-6.16 3.98 0 11.94 2.18 12 6.16C33.42 37.44 29 40 24 40z"
              fill="currentColor"
            />
          </svg>
          <h3>ログインが必要です</h3>
          <p>
            登録申請を行うには、Googleアカウントでログインする必要があります。
            <br />
            右上のメニューから「ログイン」を選択してください。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="streamer-request-form-container">
      <div className="form-header">
        <h2>配信者・VTuber 登録申請</h2>
        <p className="form-description">
          配信者本人または応援者の方から、新しい配信者・VTuberの登録申請を受け付けています。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="streamer-request-form">
        {/* YouTubeハンドル名 */}
        <div className="form-group">
          <label htmlFor="youtubeHandle" className="form-label required">
            YouTubeハンドル名
          </label>
          <input
            type="text"
            id="youtubeHandle"
            className="form-input"
            placeholder="例: @channel_name"
            value={formData.youtubeHandle}
            onChange={(e) => setFormData({ ...formData, youtubeHandle: e.target.value })}
            disabled={loading}
          />
          <p className="form-hint">
            YouTubeチャンネルのハンドル名を入力してください（@付きでも可）
          </p>
        </div>

        {/* 申請者タイプ */}
        <div className="form-group">
          <label className="form-label required">申請者タイプ</label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                name="requesterType"
                value="streamer"
                checked={formData.requesterType === 'streamer'}
                onChange={(e) => setFormData({ ...formData, requesterType: e.target.value as 'streamer' })}
                disabled={loading}
              />
              <span className="radio-text">
                <strong>配信者本人</strong>
                <span className="radio-description">自分のチャンネルを登録申請する</span>
              </span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="requesterType"
                value="supporter"
                checked={formData.requesterType === 'supporter'}
                onChange={(e) => setFormData({ ...formData, requesterType: e.target.value as 'supporter' })}
                disabled={loading}
              />
              <span className="radio-text">
                <strong>応援者</strong>
                <span className="radio-description">好きな配信者を推薦する</span>
              </span>
            </label>
          </div>
        </div>

        {/* 補足情報・推薦理由 */}
        <div className="form-group">
          <label htmlFor="additionalNotes" className="form-label">
            補足情報・推薦理由（任意）
          </label>
          <textarea
            id="additionalNotes"
            className="form-textarea"
            placeholder="応援者の方は推薦理由などを記入してください。本人の場合は登録してほしいタグや、紹介してほしい内容があれば記入してください。（任意）"
            rows={4}
            value={formData.additionalNotes}
            onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
            disabled={loading}
          />
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="form-error">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm1 15H9v-2h2v2zm0-4H9V5h2v6z"
                fill="currentColor"
              />
            </svg>
            {error}
          </div>
        )}

        {/* 成功メッセージ */}
        {success && (
          <div className="form-success">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-2 15l-5-5 1.41-1.41L8 12.17l7.59-7.59L17 6l-9 9z"
                fill="currentColor"
              />
            </svg>
            登録リクエストを受け付けました！データベースに配信者情報が追加されました。
          </div>
        )}

        {/* 送信ボタン */}
        <button
          type="submit"
          className="submit-btn"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              処理中...
            </>
          ) : (
            '登録申請を送信'
          )}
        </button>
      </form>
    </div>
  )
}

export default StreamerRequestForm
