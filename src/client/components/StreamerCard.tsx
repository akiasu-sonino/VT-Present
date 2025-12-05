import '../styles/StreamerCard.css'

interface Streamer {
  id: number
  name: string
  platform: string
  avatar_url: string
  description: string
  tags: string[]
  follower_count: number
}

interface StreamerCardProps {
  streamer: Streamer
}

function StreamerCard({ streamer }: StreamerCardProps) {
  return (
    <div className="streamer-card">
      <div className="card-image">
        <img src={streamer.avatar_url} alt={streamer.name} />
        <span className="platform-badge">{streamer.platform}</span>
      </div>

      <div className="card-content">
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
    </div>
  )
}

export default StreamerCard
