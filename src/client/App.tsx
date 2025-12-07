import { useState, useEffect } from 'react'
import StreamerCard from './components/StreamerCard'
import PreferencesList from './components/PreferencesList'
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
  video_id?: string
}

type TabType = 'discover' | 'preferences'

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('discover')
  const [streamers, setStreamers] = useState<Streamer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStreamer, setSelectedStreamer] = useState<Streamer | null>(null)

  useEffect(() => {
    fetchStreamers()
  }, [])

  const fetchStreamers = async () => {
    try {
      setLoading(true)
      // 複数の配信者を一度に取得（重複なし）
      const response = await fetch('/api/streams/random-multiple?count=12')
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
        <h1 className="title">OshiStream</h1>
        <p className="subtitle">新たな推しと出会う</p>

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

            {!loading && !error && (
              <div className="streamers-grid">
                {streamers.map((streamer, index) => (
                  <StreamerCard
                    key={`${streamer.id}-${index}`}
                    streamer={streamer}
                    onClick={() => setSelectedStreamer(streamer)}
                    onAction={handleAction}
                  />
                ))}
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
          </div>
        </div>
      )}
    </div>
  )
}

export default App
