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
  video_id?: string
}

interface StreamerCardProps {
  streamer: Streamer
  onClick?: () => void
  onAction?: (streamerId: number, action: 'LIKE' | 'SOSO' | 'DISLIKE') => void
}

function StreamerCard({ streamer, onClick, onAction }: StreamerCardProps) {
  const handleAction = (e: React.MouseEvent, action: 'LIKE' | 'SOSO' | 'DISLIKE') => {
    e.stopPropagation()
    onAction?.(streamer.id, action)
  }

  return (
    <div className="streamer-card">
      <div className="card-image" onClick={onClick}>
        <img src={streamer.avatar_url} alt={streamer.name} />
        <span className="platform-badge">{streamer.platform}</span>
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
    </div>
  )
}

export default StreamerCard
