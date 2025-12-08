import '../styles/StreamerCard.css'

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

interface StreamerCardProps {
  streamer: Streamer
  liveInfo?: LiveInfo
  onClick?: () => void
  onAction?: (streamerId: number, action: 'LIKE' | 'SOSO' | 'DISLIKE') => void
  onRemove?: (streamerId: number) => void
  showRemoveButton?: boolean
}

function StreamerCard({ streamer, liveInfo, onClick, onAction, onRemove, showRemoveButton = false }: StreamerCardProps) {
  const handleAction = (e: React.MouseEvent, action: 'LIKE' | 'SOSO' | 'DISLIKE') => {
    e.stopPropagation()
    onAction?.(streamer.id, action)
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    onRemove?.(streamer.id)
  }

  const formatViewerCount = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`
    }
    return count.toString()
  }

  return (
    <div className="streamer-card">
      <div className="card-image" onClick={onClick}>
        <img src={streamer.avatar_url} alt={streamer.name} />
        <span className="platform-badge">{streamer.platform}</span>
        {liveInfo?.isLive && (
          <div className="live-badge">
            <span className="live-indicator">●</span>
            <span className="live-text">LIVE</span>
            {liveInfo.viewerCount !== undefined && (
              <span className="viewer-count">{formatViewerCount(liveInfo.viewerCount)}</span>
            )}
          </div>
        )}
      </div>

      <div className="card-content" onClick={onClick}>
        <h3 className="streamer-name">{streamer.name}</h3>
        <p className="streamer-description">{streamer.description}</p>

        <div className="tags">
          {streamer.tags.map((tag, index) => (
            <span key={index} className="tag">
              #{tag}
            </span>
          ))}
        </div>

        <div className="follower-count">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 8a3 3 0 100-6 3 3 0 000 6zm-5 6a5 5 0 0110 0H3z" fill="currentColor"/>
          </svg>
          <span>{streamer.follower_count.toLocaleString()} フォロワー</span>
        </div>
      </div>

      {showRemoveButton ? (
        <div className="card-actions">
          <button
            className="action-btn action-remove"
            onClick={handleRemove}
          >
            選択を解除
          </button>
        </div>
      ) : (
        <div className="card-actions">
          <button
            className="action-btn action-like"
            onClick={(e) => handleAction(e, 'LIKE')}
          >
            好き
          </button>
          <button
            className="action-btn action-soso"
            onClick={(e) => handleAction(e, 'SOSO')}
          >
            普通
          </button>
        </div>
      )}
    </div>
  )
}

export default StreamerCard
