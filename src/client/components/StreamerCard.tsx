import { MouseEvent } from 'react'
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
  created_at?: string
  channel_created_at?: string
  recommendation_score?: number
  latest_video_published_at?: string
  recent_like_count?: number
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
  const handleAction = (e: MouseEvent, action: 'LIKE' | 'SOSO' | 'DISLIKE') => {
    e.stopPropagation()
    onAction?.(streamer.id, action)
  }

  const handleRemove = (e: MouseEvent) => {
    e.stopPropagation()
    onRemove?.(streamer.id)
  }

  const formatViewerCount = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`
    }
    return count.toString()
  }

  // バッジ判定ロジック
  const getBadges = () => {
    const badges: Array<{ type: string; label: string; icon: string }> = []

    // 新人配信者バッジ（チャンネル開設から1年以内）
    if (streamer.channel_created_at) {
      const channelCreatedDate = new Date(streamer.channel_created_at)
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

      if (channelCreatedDate > oneYearAgo) {
        badges.push({ type: 'newcomer', label: '新人', icon: '🌱' })
      }
    }

    // 隠れた逸材バッジ（フォロワー数1000人以下 + 一週間以内に最新動画がある）
    if (streamer.follower_count <= 1000 && streamer.latest_video_published_at) {
      const latestVideoDate = new Date(streamer.latest_video_published_at)
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

      if (latestVideoDate > oneWeekAgo) {
        badges.push({ type: 'hidden-gem', label: '隠れた逸材', icon: '💎' })
      }
    }

    // Hotバッジ（直近一週間に ceil(フォロワー数/10000) 件以上のLike）
    const recentLikeCount = streamer.recent_like_count || 0
    const requiredLikes = Math.ceil(streamer.follower_count / 10000)
    if (recentLikeCount >= requiredLikes && requiredLikes > 0) {
      badges.push({ type: 'hot', label: 'Hot', icon: '🔥' })
    }

    // Matchバッジ（推薦スコア0.8以上）
    if (streamer.recommendation_score && streamer.recommendation_score >= 0.8) {
      badges.push({ type: 'match', label: 'Match', icon: '⭐' })
    }

    return badges
  }

  const badges = getBadges()

  return (
    <div className={`streamer-card ${liveInfo?.isLive ? 'is-live' : ''}`}>
      <div className="card-image" onClick={onClick}>
        <img src={streamer.avatar_url} alt={streamer.name} loading="lazy" />
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

        {/* バッジ表示 */}
        {badges.length > 0 && (
          <div className="badges-container">
            {badges.map((badge, index) => (
              <span key={index} className={`badge badge-${badge.type}`} title={badge.label}>
                <span className="badge-icon">{badge.icon}</span>
                <span className="badge-label">{badge.label}</span>
              </span>
            ))}
          </div>
        )}

        <div className="tags">
          {(streamer.tags || []).map((tag, index) => (
            <span key={index} className="tag">
              #{tag}
            </span>
          ))}
        </div>

        <div className="follower-count">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 8a3 3 0 100-6 3 3 0 000 6zm-5 6a5 5 0 0110 0H3z" fill="currentColor" />
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
