import { useState, useEffect } from 'react'
import StreamerCard from './components/StreamerCard'
import './styles/App.css'

interface Streamer {
  id: number
  name: string
  platform: string
  avatar_url: string
  description: string
  tags: string[]
  follower_count: number
}

function App() {
  const [streamers, setStreamers] = useState<Streamer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStreamers()
  }, [])

  const fetchStreamers = async () => {
    try {
      setLoading(true)
      // 複数の配信者を取得（ランダムAPIを複数回呼ぶ）
      const promises = Array.from({ length: 12 }, () =>
        fetch('/api/streams/random').then(res => res.json())
      )
      const results = await Promise.all(promises)
      setStreamers(results)
      setError(null)
    } catch (err) {
      setError('配信者の取得に失敗しました')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">VT-Present</h1>
        <p className="subtitle">埋もれた才能を見つけ出す</p>
      </header>

      <main className="main">
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
              <StreamerCard key={`${streamer.id}-${index}`} streamer={streamer} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
