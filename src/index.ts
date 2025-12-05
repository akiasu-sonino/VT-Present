import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getRandomStreamer, recordPreference, PreferenceAction } from './lib/db'
import { getOrCreateCurrentUser } from './lib/auth'

const app = new Hono().basePath('/api')

// CORS設定（フロントエンドからのアクセスを許可）
app.use('*', cors())

// APIヘルスチェック
app.get('/health', (c) => {
  return c.json({
    message: 'VT-Present API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      random: '/api/streams/random',
      preference: '/api/preference/:action'
    }
  })
})

// ランダムに配信者を取得
app.get('/streams/random', async (c) => {
  try {
    const streamer = await getRandomStreamer()

    if (!streamer) {
      return c.json({ error: 'No streamers found' }, 404)
    }

    return c.json(streamer)
  } catch (error) {
    console.error('Error fetching random streamer:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// 好みを記録（LIKE, SOSO, DISLIKE）
app.post('/preference/:action', async (c) => {
  try {
    const action = c.req.param('action')?.toUpperCase() as PreferenceAction

    // アクションのバリデーション
    if (!['LIKE', 'SOSO', 'DISLIKE'].includes(action)) {
      return c.json({ error: 'Invalid action. Must be LIKE, SOSO, or DISLIKE' }, 400)
    }

    // リクエストボディから配信者IDを取得
    const body = await c.req.json<{ streamerId: number }>()
    const { streamerId } = body

    if (!streamerId) {
      return c.json({ error: 'streamerId is required' }, 400)
    }

    // 匿名ユーザーを取得または作成
    const { user } = await getOrCreateCurrentUser(c)

    // 好みを記録
    const preference = await recordPreference(user.id, streamerId, action)

    return c.json({
      success: true,
      preference
    })
  } catch (error) {
    console.error('Error recording preference:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default app
