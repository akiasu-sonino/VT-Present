import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getRandomStreamer, getRandomStreamers, getStreamerById, recordPreference, PreferenceAction, getActionedStreamerIds, getStreamersByAction } from './lib/db.js'
import { getOrCreateCurrentUser } from './lib/auth.js'

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
    // 匿名ユーザーを取得
    const { user } = await getOrCreateCurrentUser(c)

    // アクション済み配信者IDを取得
    const excludeIds = await getActionedStreamerIds(user.id)

    // 除外IDを考慮してランダム配信者を取得
    const streamer = await getRandomStreamer(excludeIds)

    if (!streamer) {
      return c.json({ error: 'No streamers found' }, 404)
    }

    return c.json(streamer)
  } catch (error) {
    console.error('Error fetching random streamer:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ランダムに複数の配信者を取得（重複なし）
app.get('/streams/random-multiple', async (c) => {
  try {
    // 匿名ユーザーを取得
    const { user } = await getOrCreateCurrentUser(c)

    // クエリパラメータから取得数を取得（デフォルト12）
    const count = parseInt(c.req.query('count') || '12', 10)

    // 取得数のバリデーション（最大50）
    if (count < 1 || count > 50) {
      return c.json({ error: 'Count must be between 1 and 50' }, 400)
    }

    // アクション済み配信者IDを取得
    const excludeIds = await getActionedStreamerIds(user.id)

    // 除外IDを考慮してランダム配信者を複数取得
    const streamers = await getRandomStreamers(count, excludeIds)

    return c.json({ streamers, count: streamers.length })
  } catch (error) {
    console.error('Error fetching random streamers:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// IDで配信者を取得
app.get('/streamers/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))

    if (isNaN(id)) {
      return c.json({ error: 'Invalid ID' }, 400)
    }

    const streamer = await getStreamerById(id)

    if (!streamer) {
      return c.json({ error: 'Streamer not found' }, 404)
    }

    return c.json(streamer)
  } catch (error) {
    console.error('Error fetching streamer:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// アクション済み配信者IDリストを取得
app.get('/preferences/excluded', async (c) => {
  try {
    // 匿名ユーザーを取得
    const { user } = await getOrCreateCurrentUser(c)

    // アクション済み配信者IDを取得
    const excludedIds = await getActionedStreamerIds(user.id)

    return c.json({
      excludedIds
    })
  } catch (error) {
    console.error('Error fetching excluded IDs:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// アクション別に配信者リストを取得
app.get('/preferences/streamers', async (c) => {
  try {
    // 匿名ユーザーを取得
    const { user } = await getOrCreateCurrentUser(c)

    // クエリパラメータからアクションを取得
    const action = c.req.query('action')?.toUpperCase() as PreferenceAction | undefined

    // アクションが指定されている場合はバリデーション
    if (action && !['LIKE', 'SOSO', 'DISLIKE'].includes(action)) {
      return c.json({ error: 'Invalid action. Must be LIKE, SOSO, or DISLIKE' }, 400)
    }

    // アクション別に配信者を取得
    const streamers = await getStreamersByAction(user.id, action)

    return c.json({
      streamers,
      action: action || 'all'
    })
  } catch (error) {
    console.error('Error fetching preferences:', error)
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
