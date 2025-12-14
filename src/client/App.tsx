import { useState, useEffect, useCallback } from 'react'
import StreamerCard from './components/StreamerCard'
import PreferencesList from './components/PreferencesList'
import TagFilter from './components/TagFilter'
import SearchBox from './components/SearchBox'
import FollowerFilter from './components/FollowerFilter'
import FilterPresets, { type FilterPreset } from './components/FilterPresets'
import UserMenu from './components/UserMenu'
import { AdBanner } from './components/AdBanner'
import { AdMaxBanner } from './components/AdMaxBanner'
import OnboardingWizard from './components/onboarding/OnboardingWizard'
import LoginPromptModal from './components/onboarding/LoginPromptModal'
import './styles/App.css'

interface Streamer {
  id: number
  name: string
  platform: string
  avatar_url: string
  description: string
  tags: string[]
  follower_count: number
  channel_url?: string
  youtube_channel_id?: string
  twitch_user_id?: string
  video_id?: string
}

interface User {
  id: number
  email: string
  name: string | null
  avatar_url: string | null
}

interface Comment {
  id: number
  streamer_id: number
  user_id: number
  content: string
  created_at: string
  user?: User
}

interface LiveInfo {
  isLive: boolean
  viewerCount?: number
  videoId?: string
  title?: string
}

type TabType = 'discover' | 'preferences'

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('discover')
  const [streamers, setStreamers] = useState<Streamer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStreamer, setSelectedStreamer] = useState<Streamer | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagOperator, setTagOperator] = useState<'OR' | 'AND'>('OR')
  const [searchQuery, setSearchQuery] = useState('')
  const [minFollowers, setMinFollowers] = useState(0)
  const [maxFollowers, setMaxFollowers] = useState(Number.MAX_SAFE_INTEGER)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [liveStatus, setLiveStatus] = useState<Record<string, LiveInfo>>({})
  const [showLiveOnly, setShowLiveOnly] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [addingTag, setAddingTag] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)

  const fetchStreamers = useCallback(async () => {
    try {
      setLoading(true)
      // 複数の配信者を一度に取得（重複なし）
      const params = new URLSearchParams({ count: '12' })
      if (selectedTags.length > 0) {
        params.append('tags', selectedTags.join(','))
        if (selectedTags.length > 1) {
          params.append('tagOperator', tagOperator)
        }
      }
      if (searchQuery.trim()) {
        params.append('query', searchQuery.trim())
      }
      if (minFollowers > 0) {
        params.append('minFollowers', minFollowers.toString())
      }
      if (maxFollowers < Number.MAX_SAFE_INTEGER) {
        params.append('maxFollowers', maxFollowers.toString())
      }
      // ライブ中のみフィルター（第一段階フィルタとして適用）
      if (showLiveOnly) {
        params.append('liveOnly', 'true')
      }

      const response = await fetch(`/api/streams/random-multiple?${params.toString()}`)
      const data = await response.json()

      if (response.ok && data.streamers) {
        setStreamers(data.streamers)
        setError(null)
      } else {
        setError('配信者の取得に失敗しました')
      }
    } catch (err) {
      setError('配信者の取得に失敗しました')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedTags, tagOperator, searchQuery, minFollowers, maxFollowers, showLiveOnly])

  useEffect(() => {
    fetchStreamers()
  }, [fetchStreamers])

  useEffect(() => {
    fetchCurrentUser()
    checkOnboarding()
    checkAnonymousModal()
  }, [])

  // currentUserが変更されたらオンボーディングをチェック
  useEffect(() => {
    if (currentUser) {
      checkOnboardingAfterLogin()
    }
  }, [currentUser])

  useEffect(() => {
    if (selectedStreamer) {
      fetchComments(selectedStreamer.id)
    }
  }, [selectedStreamer])

  // ライブ状態を定期的に取得（本番環境のみ5分ごと）
  // RSS + Videos API方式で低コスト検知（RSS無料 + 1 unit/50動画）
  useEffect(() => {
    // 本番環境のみライブ状態を取得
    if (import.meta.env.PROD) {
      fetchLiveStatus()
      const interval = setInterval(fetchLiveStatus, 5 * 60 * 1000) // 5分
      return () => clearInterval(interval)
    }
  }, [])

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me')
      const data = await response.json()
      if (data.authenticated && data.user) {
        setCurrentUser(data.user)
      }
    } catch (err) {
      console.error('Error fetching current user:', err)
    }
  }

  const checkOnboarding = async () => {
    // URLパラメータをチェック
    const urlParams = new URLSearchParams(window.location.search)
    const shouldShowOnboarding = urlParams.get('onboarding') === 'true'

    if (shouldShowOnboarding) {
      // オンボーディング状態をチェック
      try {
        const response = await fetch('/api/onboarding/status')
        const data = await response.json()

        if (!data.hasCompletedOnboarding) {
          setShowOnboarding(true)
        }
      } catch (err) {
        console.error('Error checking onboarding status:', err)
      }
    }
  }

  const checkAnonymousModal = async () => {
    // 匿名ユーザー向けログイン誘導モーダル表示判定
    try {
      const response = await fetch('/api/onboarding/should-show-anonymous-modal')
      const data = await response.json()

      if (data.shouldShow) {
        setShowLoginPrompt(true)
      }
    } catch (err) {
      console.error('Error checking anonymous modal status:', err)
    }
  }

  const checkOnboardingAfterLogin = async () => {
    // ログイン後のオンボーディングチェック
    const urlParams = new URLSearchParams(window.location.search)
    const shouldShowOnboarding = urlParams.get('onboarding') === 'true'

    if (shouldShowOnboarding) {
      try {
        const response = await fetch('/api/onboarding/status')
        const data = await response.json()

        if (!data.hasCompletedOnboarding) {
          setShowOnboarding(true)
        }
      } catch (err) {
        console.error('Error checking onboarding status:', err)
      }
    }
  }

  const handleOnboardingComplete = (selectedOnboardingTags: string[]) => {
    setShowOnboarding(false)

    // 選択されたタグをフィルターに適用
    if (selectedOnboardingTags.length > 0) {
      setSelectedTags(selectedOnboardingTags)
    }

    // URLパラメータをクリア
    window.history.replaceState({}, '', '/')

    // 配信者を再取得
    fetchStreamers()
  }

  const handleOnboardingSkip = () => {
    setShowOnboarding(false)
    // URLパラメータをクリア
    window.history.replaceState({}, '', '/')
  }

  const handleLoginPromptLogin = async () => {
    setShowLoginPrompt(false)

    // モーダル表示済みフラグを設定
    try {
      await fetch('/api/onboarding/mark-anonymous-modal-shown', { method: 'POST' })
    } catch (err) {
      console.error('Error marking anonymous modal as shown:', err)
    }

    // ログインページへリダイレクト
    const isDevelopment = import.meta.env.DEV
    if (isDevelopment) {
      // 開発環境ではモックログイン
      fetch('/api/auth/mock', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.user) {
            setCurrentUser(data.user)
            window.location.reload()
          }
        })
        .catch(err => console.error('Error in mock login:', err))
    } else {
      // 本番環境ではGoogle OAuth
      window.location.href = '/api/auth/google'
    }
  }

  const handleLoginPromptContinue = async () => {
    setShowLoginPrompt(false)

    // スキップフラグを設定
    try {
      await fetch('/api/onboarding/skip-anonymous-modal', { method: 'POST' })
    } catch (err) {
      console.error('Error skipping anonymous modal:', err)
    }
  }

  const fetchLiveStatus = async () => {
    try {
      const response = await fetch('/api/streamers/live-status')
      const data = await response.json()
      if (response.ok && data.liveStatus) {
        setLiveStatus(data.liveStatus)
      }
    } catch (err) {
      console.error('Error fetching live status:', err)
    }
  }

  const fetchComments = async (streamerId: number) => {
    try {
      const response = await fetch(`/api/comments/${streamerId}`)
      const data = await response.json()
      if (response.ok && data.comments) {
        setComments(data.comments)
      }
    } catch (err) {
      console.error('Error fetching comments:', err)
    }
  }

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !selectedStreamer || !currentUser) return

    const newComment: Comment = {
      id: Date.now(), // 一時的なID
      streamer_id: selectedStreamer.id,
      user_id: currentUser.id,
      content: commentText.trim(),
      created_at: new Date().toISOString(),
      user: currentUser
    }

    try {
      setSubmittingComment(true)

      // 楽観的UI更新: すぐにローカル状態に追加
      setComments(prev => [newComment, ...prev])
      setCommentText('')

      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamerId: selectedStreamer.id,
          content: newComment.content
        })
      })

      if (!response.ok) {
        // エラーの場合は追加したコメントを削除
        setComments(prev => prev.filter(c => c.id !== newComment.id))
        const data = await response.json()
        alert(data.error || 'コメント投稿に失敗しました')
        setCommentText(newComment.content) // テキストを戻す
      }
    } catch (err) {
      console.error('Error submitting comment:', err)
      // エラーの場合は追加したコメントを削除
      setComments(prev => prev.filter(c => c.id !== newComment.id))
      alert('コメント投稿に失敗しました')
      setCommentText(newComment.content) // テキストを戻す
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleAddTag = async () => {
    if (!newTag.trim() || !selectedStreamer || !currentUser) return

    try {
      setAddingTag(true)

      const response = await fetch(`/api/streamers/${selectedStreamer.id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: newTag.trim() })
      })

      if (response.ok) {
        const data = await response.json()
        // 楽観的UI更新
        setSelectedStreamer(prev => prev ? { ...prev, tags: data.streamer.tags } : null)
        // streamersリストも更新
        setStreamers(prev => prev.map(s => s.id === selectedStreamer.id ? { ...s, tags: data.streamer.tags } : s))
        setNewTag('')
      } else {
        const data = await response.json()
        alert(data.error || 'タグの追加に失敗しました')
      }
    } catch (err) {
      console.error('Error adding tag:', err)
      alert('タグの追加に失敗しました')
    } finally {
      setAddingTag(false)
    }
  }

  const handleRemoveTag = async (tag: string) => {
    if (!selectedStreamer || !currentUser) return

    if (!confirm(`タグ「${tag}」を削除しますか？`)) return

    try {
      const response = await fetch(`/api/streamers/${selectedStreamer.id}/tags/${encodeURIComponent(tag)}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const data = await response.json()
        // 楽観的UI更新
        setSelectedStreamer(prev => prev ? { ...prev, tags: data.streamer.tags } : null)
        // streamersリストも更新
        setStreamers(prev => prev.map(s => s.id === selectedStreamer.id ? { ...s, tags: data.streamer.tags } : s))
      } else {
        const data = await response.json()
        alert(data.error || 'タグの削除に失敗しました')
      }
    } catch (err) {
      console.error('Error removing tag:', err)
      alert('タグの削除に失敗しました')
    }
  }

  const handleAction = async (streamerId: number, action: 'LIKE' | 'SOSO' | 'DISLIKE') => {
    try {
      // アクションを記録
      const response = await fetch(`/api/preference/${action.toLowerCase()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ streamerId }),
      })

      if (!response.ok) {
        throw new Error('Failed to record preference')
      }

      // アクション済み配信者を一覧から削除
      setStreamers(prev => {
        const updated = prev.filter(s => s.id !== streamerId)

        // 配信者数が少なくなったら新しい配信者を追加
        if (updated.length <= 6) {
          fetch('/api/streams/random')
            .then(res => res.json())
            .then(newStreamer => {
              if (newStreamer && !newStreamer.error) {
                setStreamers(current => [...current, newStreamer])
              }
            })
            .catch(err => console.error('Error fetching new streamer:', err))
        }

        return updated
      })
    } catch (err) {
      console.error('Error recording action:', err)
      setError('アクションの記録に失敗しました')
    }
  }

  return (
    <div className="app">
      {/* AdMax サイドバー固定広告 */}
      <AdMaxBanner
        adId="629a281b9d6e718ee7676471ecea6b17"
        className="admax-sidebar-fixed"
      />

      <header className="header">
        <div className="header-top">
          <div className="header-branding">
            <h1 className="title">OshiStream</h1>
            <p className="subtitle">新たな推しと出会うプラットフォーム</p>
          </div>
          <UserMenu onUserChange={setCurrentUser} />
        </div>

        <nav className="tab-navigation">
          <button
            className={`tab-button ${activeTab === 'discover' ? 'active' : ''}`}
            onClick={() => setActiveTab('discover')}
          >
            探す
          </button>
          <button
            className={`tab-button ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            マイリスト
          </button>
        </nav>
      </header>

      {/* 広告バナー - ヘッダー下 */}
      {/* GoogleAdSense審査中のため一時的に非表示
      <AdBanner
        adClient="ca-pub-2390171962684817"
        adSlot="YOUR_AD_SLOT_ID_HERE"
      />
      */}
      {/*
      <div>
        <div className="recommended-devices-title">おすすめデバイス</div>
        <HorizontalLayout
          items={[
            {
              content: <AdBannerAmazon url="https://amzn.to/48r6qld" imageSrc="https://m.media-amazon.com/images/I/61Sy-86P2FL._AC_SL1500_.jpg" alt="おすすめの入門用キーボード。キー入力がなめらか。" />,
              width: '20%' // col-5相当 (5/12)
            },
            {
              content: <AdBannerAmazon url="https://amzn.to/3MqZUCv" imageSrc="https://m.media-amazon.com/images/I/51PesoBHTQL._AC_SL1500_.jpg" alt="おすすめの入門用マウス。無線で軽くて使いやすい。" />,
              width: '20%' // col-4相当 (4/12)
            },
            {
              content: <AdBannerAmazon url="https://amzn.to/44imOlH" imageSrc="https://m.media-amazon.com/images/I/61kTEwDIwbL._AC_SL1500_.jpg" alt="おすすめの入門用マイク。通話相手に聞こえやすい。" />,
              width: '20%' // col-4相当 (4/12)
            },
            {
              content: <AdBannerAmazon url="https://amzn.to/4rIMt0H" imageSrc="https://m.media-amazon.com/images/I/51XQa8rzYYL._AC_SL1000_.jpg" alt="おすすめの入門用スピーカー。耳がイヤホンで疲れたときに。" />,
              width: '20%' // col-4相当 (4/12)
            },
          ]}
          containerClassName="mt-4"
          gap="1rem"
        />
      </div>
      */}
      <main className="main">
        {activeTab === 'discover' && (
          <>
            <div className="filters-container">
              <div className="filters-row">
                <FilterPresets
                  onApplyPreset={(preset: FilterPreset) => {
                    setSelectedTags(preset.tags)
                    setTagOperator(preset.tagOperator)
                    setSearchQuery(preset.searchQuery)
                    setMinFollowers(preset.minFollowers)
                    setMaxFollowers(preset.maxFollowers)
                  }}
                  currentFilters={{
                    tags: selectedTags,
                    tagOperator,
                    searchQuery,
                    minFollowers,
                    maxFollowers
                  }}
                />
                <TagFilter
                  selectedTags={selectedTags}
                  onTagsChange={setSelectedTags}
                  tagOperator={tagOperator}
                  onTagOperatorChange={setTagOperator}
                />
                <FollowerFilter
                  minFollowers={minFollowers}
                  maxFollowers={maxFollowers}
                  onMinFollowersChange={setMinFollowers}
                  onMaxFollowersChange={setMaxFollowers}
                />
                <button
                  className={`live-filter-btn ${showLiveOnly ? 'active' : ''}`}
                  onClick={() => setShowLiveOnly(!showLiveOnly)}
                >
                  {showLiveOnly ? 'ライブ中 ●' : 'ライブ中のみ'}
                </button>
              </div>
              <div className="search-row">
                <SearchBox
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="配信者名や説明で検索..."
                />
              </div>
            </div>

            {loading && (
              <div className="loading">
                <p>配信者を読み込み中...</p>
              </div>
            )}

            {error && (
              <div className="error">
                <p>{error}</p>
                <button onClick={fetchStreamers}>再読み込み</button>
              </div>
            )}

            {!loading && !error && streamers.length === 0 && (
              <div className="empty-state">
                <p>条件に合う配信者が見つかりませんでした</p>
                <button onClick={() => {
                  setSelectedTags([])
                  setTagOperator('OR')
                  setSearchQuery('')
                  setMinFollowers(0)
                  setMaxFollowers(Number.MAX_SAFE_INTEGER)
                }}>フィルターをリセット</button>
              </div>
            )}

            {!loading && !error && streamers.length > 0 && (
              <div className="streamers-grid">
                {streamers.map((streamer, index) => {
                    const liveInfo = streamer.youtube_channel_id
                      ? liveStatus[streamer.youtube_channel_id]
                      : undefined
                    return (
                      <StreamerCard
                        key={`${streamer.id}-${index}`}
                        streamer={streamer}
                        liveInfo={liveInfo}
                        onClick={() => setSelectedStreamer(streamer)}
                        onAction={handleAction}
                      />
                    )
                  })}
              </div>
            )}
          </>
        )}

        {activeTab === 'preferences' && <PreferencesList />}
      </main>

      {selectedStreamer && (
        <div className="modal-overlay" onClick={() => setSelectedStreamer(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedStreamer(null)}>
              ×
            </button>
            <h2>{selectedStreamer.name}</h2>
            <p>{selectedStreamer.description}</p>

            {/* タグセクション */}
            <div className="modal-tags-section">
              <h3>タグ</h3>
              <div className="tags">
                {(selectedStreamer.tags || []).map((tag, index) => (
                  <span key={index} className="tag modal-tag">
                    #{tag}
                    {currentUser && (
                      <button
                        className="tag-remove-btn"
                        onClick={() => handleRemoveTag(tag)}
                        title="タグを削除"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>

              {currentUser && (
                <div className="tag-add-form">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="新しいタグを追加..."
                    maxLength={50}
                    disabled={addingTag}
                  />
                  <button
                    onClick={handleAddTag}
                    disabled={!newTag.trim() || addingTag}
                  >
                    {addingTag ? '追加中...' : '追加'}
                  </button>
                </div>
              )}
            </div>

            {selectedStreamer.video_id && (
              <div className="video-container">
                <iframe
                  width="100%"
                  height="400"
                  src={`https://www.youtube.com/embed/${selectedStreamer.video_id}`}
                  title={selectedStreamer.name}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}

            {selectedStreamer.channel_url && (
              <a
                href={selectedStreamer.channel_url}
                target="_blank"
                rel="noopener noreferrer"
                className="channel-link"
              >
                チャンネルを見る →
              </a>
            )}

            <div className="comments-section">
              <h3>コメント</h3>

              {currentUser ? (
                <div className="comment-form">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="コメントを入力..."
                    maxLength={1000}
                    disabled={submittingComment}
                  />
                  <button
                    onClick={handleSubmitComment}
                    disabled={!commentText.trim() || submittingComment}
                  >
                    {submittingComment ? '送信中...' : '投稿'}
                  </button>
                </div>
              ) : (
                <p className="login-prompt">コメントするにはログインが必要です</p>
              )}

              <div className="comments-list">
                {comments.length === 0 ? (
                  <p className="no-comments">まだコメントがありません</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="comment">
                      <div className="comment-header">
                        {comment.user?.avatar_url && (
                          <img
                            src={comment.user.avatar_url}
                            alt={comment.user.name || 'User'}
                            className="comment-avatar"
                            loading="lazy"
                          />
                        )}
                        <span className="comment-author">
                          {comment.user?.name || comment.user?.email || 'Unknown'}
                        </span>
                        <span className="comment-date">
                          {new Date(comment.created_at).toLocaleDateString('ja-JP')}
                        </span>
                      </div>
                      <p className="comment-content">{comment.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* オンボーディングウィザード */}
      {showOnboarding && (
        <OnboardingWizard
          isOpen={showOnboarding}
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}

      {/* ログイン促進モーダル（匿名ユーザー向け） */}
      {showLoginPrompt && (
        <LoginPromptModal
          isOpen={showLoginPrompt}
          onLogin={handleLoginPromptLogin}
          onContinueAnonymous={handleLoginPromptContinue}
        />
      )}

      <footer className="footer">
        <div className="footer-content">
          <p className="footer-copyright">&copy; 2025 OshiStream. All rights reserved.</p>
          <div className="footer-links">
            <a href="/terms" className="footer-link">
              利用規約
            </a>
            <span className="footer-separator">|</span>
            <a href="/privacy" className="footer-link">
              プライバシーポリシー
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
