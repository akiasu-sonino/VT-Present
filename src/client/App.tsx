import { useState, useEffect } from 'react'
import StreamerCard from './components/StreamerCard'
import PreferencesList from './components/PreferencesList'
import TagFilter from './components/TagFilter'
import UserMenu from './components/UserMenu'
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
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [liveStatus, setLiveStatus] = useState<Record<string, LiveInfo>>({})
  const [showLiveOnly, setShowLiveOnly] = useState(false)

  useEffect(() => {
    fetchStreamers()
  }, [selectedTags])

  useEffect(() => {
    fetchCurrentUser()
  }, [])

  useEffect(() => {
    if (selectedStreamer) {
      fetchComments(selectedStreamer.id)
    }
  }, [selectedStreamer])

  // ライブ状態を定期的に取得（15分ごと）
  // YouTube APIクォータ節約のため、ポーリング間隔を延長
  useEffect(() => {
    fetchLiveStatus()
    const interval = setInterval(fetchLiveStatus, 15 * 60 * 1000) // 15分
    return () => clearInterval(interval)
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

  const fetchStreamers = async () => {
    try {
      setLoading(true)
      // 複数の配信者を一度に取得（重複なし）
      const params = new URLSearchParams({ count: '12' })
      if (selectedTags.length > 0) {
        params.append('tags', selectedTags.join(','))
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

      <main className="main">
        {activeTab === 'discover' && (
          <>
            <div className="filters-container">
              <TagFilter selectedTags={selectedTags} onTagsChange={setSelectedTags} />
              <button
                className={`live-filter-btn ${showLiveOnly ? 'active' : ''}`}
                onClick={() => setShowLiveOnly(!showLiveOnly)}
              >
                {showLiveOnly ? '● ライブ中のみ表示' : 'ライブ中のみ表示'}
              </button>
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
                <p>選択したタグの配信者が見つかりませんでした</p>
                <button onClick={() => setSelectedTags([])}>フィルターをリセット</button>
              </div>
            )}

            {!loading && !error && streamers.length > 0 && (
              <div className="streamers-grid">
                {streamers
                  .filter(streamer => {
                    // ライブ中のみフィルタ
                    if (showLiveOnly && streamer.youtube_channel_id) {
                      return liveStatus[streamer.youtube_channel_id]?.isLive
                    }
                    return true
                  })
                  .map((streamer, index) => {
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
    </div>
  )
}

export default App
