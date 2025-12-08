import { useState, useEffect } from 'react'
import StreamerCard from './StreamerCard'
import '../styles/PreferencesList.css'

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

interface LiveInfo {
  isLive: boolean
  viewerCount?: number
  videoId?: string
  title?: string
}

type FilterType = 'all' | 'LIKE' | 'SOSO'

function PreferencesList() {
  const [streamers, setStreamers] = useState<Streamer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedStreamer, setSelectedStreamer] = useState<Streamer | null>(null)
  const [liveStatus, setLiveStatus] = useState<Record<string, LiveInfo>>({})

  useEffect(() => {
    fetchPreferences()
  }, [filter])

  // ライブ状態を定期的に取得（5分ごと）
  useEffect(() => {
    fetchLiveStatus()
    const interval = setInterval(fetchLiveStatus, 5 * 60 * 1000) // 5分
    return () => clearInterval(interval)
  }, [])

  const fetchPreferences = async () => {
    try {
      setLoading(true)
      const url = filter === 'all'
        ? '/api/preferences/streamers'
        : `/api/preferences/streamers?action=${filter}`

      const response = await fetch(url)
      const data = await response.json()

      if (response.ok) {
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

  const handleRemovePreference = async (streamerId: number) => {
    try {
      const response = await fetch(`/api/preference/${streamerId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // リストから削除
        setStreamers(prevStreamers => prevStreamers.filter(s => s.id !== streamerId))
      } else {
        setError('選択の解除に失敗しました')
      }
    } catch (err) {
      setError('選択の解除に失敗しました')
      console.error(err)
    }
  }

  const getFilterLabel = (filterType: FilterType) => {
    switch (filterType) {
      case 'LIKE': return '好き'
      case 'SOSO': return '普通'
      default: return '全て'
    }
  }

  return (
    <div className="preferences-list">
      <div className="filter-tabs">
        <button
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          全て
        </button>
        <button
          className={`filter-tab ${filter === 'LIKE' ? 'active' : ''}`}
          onClick={() => setFilter('LIKE')}
        >
          好き
        </button>
        <button
          className={`filter-tab ${filter === 'SOSO' ? 'active' : ''}`}
          onClick={() => setFilter('SOSO')}
        >
          普通
        </button>
      </div>

      <div className="preferences-content">
        {loading && (
          <div className="loading">
            <p>読み込み中...</p>
          </div>
        )}

        {error && (
          <div className="error">
            <p>{error}</p>
            <button onClick={fetchPreferences}>再読み込み</button>
          </div>
        )}

        {!loading && !error && streamers.length === 0 && (
          <div className="empty-state">
            <p>{getFilterLabel(filter)} の配信者がいません</p>
          </div>
        )}

        {!loading && !error && streamers.length > 0 && (
          <div className="streamers-grid">
            {streamers.map((streamer) => {
              const liveInfo = streamer.youtube_channel_id
                ? liveStatus[streamer.youtube_channel_id]
                : undefined
              return (
                <StreamerCard
                  key={streamer.id}
                  streamer={streamer}
                  liveInfo={liveInfo}
                  onClick={() => setSelectedStreamer(streamer)}
                  onRemove={handleRemovePreference}
                  showRemoveButton={true}
                />
              )
            })}
          </div>
        )}
      </div>

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

export default PreferencesList
