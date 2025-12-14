import { useState, useEffect, useCallback } from 'react'
import '../styles/UserMenu.css'

interface User {
  id: number
  email: string
  name: string | null
  avatar_url: string | null
}

interface UserMenuProps {
  onUserChange?: (user: User | null) => void
}

function UserMenu({ onUserChange }: UserMenuProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [loggingIn, setLoggingIn] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [contactSubject, setContactSubject] = useState('')
  const [contactMessage, setContactMessage] = useState('')
  const [submittingContact, setSubmittingContact] = useState(false)

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me')
      const data = await response.json()

      if (data.authenticated && data.user) {
        setUser(data.user)
        onUserChange?.(data.user)
      } else {
        setUser(null)
        onUserChange?.(null)
      }
    } catch (error) {
      console.error('Error fetching current user:', error)
      setUser(null)
      onUserChange?.(null)
    } finally {
      setLoading(false)
    }
  }, [onUserChange])

  useEffect(() => {
    fetchCurrentUser()
  }, [fetchCurrentUser])

  const handleMockLogin = async () => {
    try {
      setLoggingIn(true)
      const response = await fetch('/api/auth/mock', { method: 'POST' })
      const data = await response.json()

      if (data.success && data.user) {
        setUser(data.user)
        onUserChange?.(data.user)
      } else {
        alert('ログインに失敗しました')
      }
    } catch (error) {
      console.error('Error logging in:', error)
      alert('ログインに失敗しました')
    } finally {
      setLoggingIn(false)
    }
  }

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google'
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
      onUserChange?.(null)
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  const handleSubmitContact = async () => {
    if (!contactMessage.trim()) return

    try {
      setSubmittingContact(true)
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: contactSubject.trim() || null,
          message: contactMessage.trim()
        })
      })

      if (response.ok) {
        alert('お問い合わせを送信しました。30秒以内に記録されます。')
        setContactSubject('')
        setContactMessage('')
        setShowContactModal(false)
      } else {
        const data = await response.json()
        alert(data.error || 'お問い合わせの送信に失敗しました')
      }
    } catch (error) {
      console.error('Error submitting contact:', error)
      alert('お問い合わせの送信に失敗しました')
    } finally {
      setSubmittingContact(false)
    }
  }

  if (loading) {
    return <div className="user-menu loading">...</div>
  }

  if (!user) {
    // 開発環境ではモックログイン、本番環境ではGoogleログイン
    const isDevelopment = import.meta.env.DEV

    return (
      <div className="user-menu">
        <button
          className="login-button"
          onClick={isDevelopment ? handleMockLogin : handleGoogleLogin}
          disabled={loggingIn}
        >
          {loggingIn ? 'ログイン中...' : '👤 Googleログイン'}
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="user-menu">
        <div className="user-info">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.name || 'User'} className="user-avatar" loading="lazy" />
          ) : (
            <div className="user-avatar-placeholder">
              {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
            </div>
          )}
          <div className="user-details">
            <span className="user-name">{user.name || user.email}</span>
          </div>
          <button className="contact-button" onClick={() => setShowContactModal(true)}>
            お問い合わせ
          </button>
          <button className="logout-button" onClick={handleLogout}>
            ログアウト
          </button>
        </div>
      </div>

      {showContactModal && (
        <div className="modal-overlay" onClick={() => setShowContactModal(false)}>
          <div className="modal-content contact-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowContactModal(false)}>
              ×
            </button>
            <h2>お問い合わせ</h2>
            <div className="contact-form">
              <div className="form-group">
                <label htmlFor="contact-subject">件名（任意）</label>
                <input
                  id="contact-subject"
                  type="text"
                  value={contactSubject}
                  onChange={(e) => setContactSubject(e.target.value)}
                  placeholder="件名を入力..."
                  maxLength={255}
                  disabled={submittingContact}
                />
              </div>
              <div className="form-group">
                <label htmlFor="contact-message">メッセージ</label>
                <textarea
                  id="contact-message"
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="お問い合わせ内容を入力..."
                  maxLength={5000}
                  disabled={submittingContact}
                  rows={8}
                />
              </div>
              <button
                className="submit-button"
                onClick={handleSubmitContact}
                disabled={!contactMessage.trim() || submittingContact}
              >
                {submittingContact ? '送信中...' : '送信'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default UserMenu
