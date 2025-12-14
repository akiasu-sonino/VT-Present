/* eslint-disable no-console */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { setCookie } from 'hono/cookie'
import { getRandomStreamer, getRandomStreamers, getStreamerById, recordPreference, deletePreference, PreferenceAction, getActionedStreamerIds, getStreamersByAction, getAllTags, getTagCategories, getUserByGoogleId, createUser, updateUserLastLogin, getUserById, linkAnonymousUserToUser, getCommentsByStreamerId, addTagToStreamer, removeTagFromStreamer, getOnboardingProgress, getOnboardingProgressByUserId, saveQuizResults, saveTagSelection, completeOnboarding, migrateOnboardingProgress, addCommentReaction, removeCommentReaction, getUserReactionForComment, getRecommendationRanking, createShareLog, getShareCountByStreamerId } from './lib/db.js'
import { getOrCreateCurrentUser, getOrCreateAnonymousId } from './lib/auth.js'
import { cache } from './lib/cache.js'
import { writeCache } from './lib/write-cache.js'
import { createGoogleAuthorizationURL, validateGoogleAuthorizationCode, setSessionCookie, getSessionUserId, clearSession, isDevelopment, createMockUser } from './lib/oauth.js'
import { getLiveStreamStatus, type LiveStreamInfo } from './lib/youtube.js'
import { createAuditLog } from './lib/audit-log.js'
import { getCollaborativeRecommendations, getCollaborativeRecommendationsWithDebug } from './lib/collaborative-filtering.js'
import { mapAnswersToTags, determineCurrentStep } from './lib/onboarding.js'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// メインアプリケーション
const mainApp = new Hono()

// ========================================
// OGP生成ヘルパー関数
// ========================================

/**
 * 配信者ページ用の動的OGPを含むHTMLを生成
 */
function generateStreamerPageHTML(
  streamer: any,
  recommendationComment?: any,
  baseUrl: string = 'https://www.oshistream.jp'
): string {
  const title = recommendationComment
    ? `${streamer.name}をおすすめ！ - OshiStream`
    : `${streamer.name} - OshiStream`

  const description = recommendationComment
    ? recommendationComment.content.substring(0, 150)
    : streamer.description?.substring(0, 150) || `${streamer.name}の配信をチェック！`

  const ogImage = streamer.avatar_url || `${baseUrl}/ogp.png`
  const pageUrl = recommendationComment
    ? `${baseUrl}/streamer/${streamer.id}?comment=${recommendationComment.id}`
    : `${baseUrl}/streamer/${streamer.id}`

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>

  <!-- OGP Meta Tags -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:site_name" content="OshiStream">
  <meta property="og:locale" content="ja_JP">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${ogImage}">

  <!-- Redirect to React app -->
  <meta http-equiv="refresh" content="0;url=/?streamer=${streamer.id}${recommendationComment ? `&comment=${recommendationComment.id}` : ''}">

  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .loading {
      text-align: center;
    }
    .spinner {
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top: 4px solid white;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="loading">
    <div class="spinner"></div>
    <p>読み込み中...</p>
    <p><a href="/?streamer=${streamer.id}" style="color: white;">クリックして続行</a></p>
  </div>
</body>
</html>`
}

// ========================================
// 個別配信者ページ（動的OGP生成）
// ========================================

mainApp.get('/streamer/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const commentId = c.req.query('comment')

    if (isNaN(id)) {
      return c.text('Invalid streamer ID', 400)
    }

    const streamer = await getStreamerById(id)

    if (!streamer) {
      return c.text('Streamer not found', 404)
    }

    // おすすめコメントIDが指定されている場合、そのコメントを取得
    let recommendationComment = null
    if (commentId) {
      const comments = await getCommentsByStreamerId(id)
      recommendationComment = comments.find(
        (c: any) => c.id === parseInt(commentId) && c.comment_type === 'recommendation'
      )
    }

    const baseUrl = `${c.req.header('x-forwarded-proto') || 'https'}://${c.req.header('host')}`
    const html = generateStreamerPageHTML(streamer, recommendationComment, baseUrl)

    // TwitterクローラーやOGPクローラーがキャッシュしやすいように
    c.header('Cache-Control', 'public, max-age=3600')

    return c.html(html)
  } catch (error) {
    console.error('Error loading streamer page:', error)
    return c.text('Internal server error', 500)
  }
})

// 静的ページルート
mainApp.get('/terms', async (c) => {
  try {
    const html = await readFile(join(__dirname, 'views', 'terms.html'), 'utf-8')
    // 静的ページは1時間キャッシュ
    c.header('Cache-Control', 'public, max-age=3600')
    return c.html(html)
  } catch (error) {
    console.error('Error loading terms page:', error)
    return c.html('<h1>ページが見つかりません</h1>', 404)
  }
})

mainApp.get('/privacy', async (c) => {
  try {
    const html = await readFile(join(__dirname, 'views', 'privacy.html'), 'utf-8')
    // 静的ページは1時間キャッシュ
    c.header('Cache-Control', 'public, max-age=3600')
    return c.html(html)
  } catch (error) {
    console.error('Error loading privacy page:', error)
    return c.html('<h1>ページが見つかりません</h1>', 404)
  }
})

// APIルート
const app = new Hono()

// CORS設定（フロントエンドからのアクセスを許可）
app.use('*', cors())

// APIヘルスチェック
app.get('/health', (c) => {
  return c.json({
    message: 'OshiStream API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      random: '/api/streams/random',
      preference: '/api/preference/:action',
      cacheStats: '/api/cache/stats'
    }
  })
})

// キャッシュ統計情報（デバッグ用）
app.get('/cache/stats', (c) => {
  const stats = cache.getStats()
  const writeStats = writeCache.getStats()
  return c.json({
    cache: stats,
    writeCache: writeStats,
    description: {
      streamers: 'All streamer data cached for 1 hour',
      userActions: 'User action history cached per user',
      users: 'Anonymous user data cached',
      ttl: 'Time to live in milliseconds',
      writeCache: 'Pending writes buffered in memory'
    }
  })
})

// 全タグ一覧を取得（カテゴリ情報付き）
app.get('/tags', async (c) => {
  try {
    const tags = await getAllTags()
    const categories = await getTagCategories()
    // メモリキャッシュがあるため短いHTTPキャッシュでOK
    c.header('Cache-Control', 'public, max-age=30, s-maxage=30')
    return c.json({ tags, categories })
  } catch (error) {
    console.error('Error fetching tags:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ========================================
// 認証関連エンドポイント
// ========================================

// 現在のユーザー情報を取得
app.get('/auth/me', async (c) => {
  try {
    const userId = getSessionUserId(c)

    if (!userId) {
      // 認証情報はキャッシュしない
      c.header('Cache-Control', 'no-store')
      return c.json({ authenticated: false, user: null })
    }

    const user = await getUserById(userId)

    if (!user) {
      c.header('Cache-Control', 'no-store')
      return c.json({ authenticated: false, user: null })
    }

    // ユーザー情報は短時間のプライベートキャッシュ
    c.header('Cache-Control', 'private, max-age=300')
    return c.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url
      }
    })
  } catch (error) {
    console.error('Error fetching current user:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Google OAuthログイン開始（本番環境用）
app.get('/auth/google', async (c) => {
  try {
    if (isDevelopment()) {
      return c.json({ error: 'Use /api/auth/mock for local development' }, 400)
    }

    const { url, state, codeVerifier } = createGoogleAuthorizationURL()

    // state と codeVerifier をCookieに保存
    setCookie(c, 'google_oauth_state', state, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 60 * 10 // 10分
    })

    setCookie(c, 'google_code_verifier', codeVerifier, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 60 * 10 // 10分
    })

    return c.redirect(url.toString())
  } catch (error) {
    console.error('Error starting Google OAuth:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Google OAuthコールバック
app.get('/auth/callback/google', async (c) => {
  try {
    const code = c.req.query('code')
    const state = c.req.query('state')

    if (!code || !state) {
      return c.json({ error: 'Invalid callback' }, 400)
    }

    // stateとcodeVerifierを検証
    const storedState = c.req.header('cookie')?.match(/google_oauth_state=([^;]+)/)?.[1]
    const storedCodeVerifier = c.req.header('cookie')?.match(/google_code_verifier=([^;]+)/)?.[1]

    if (!storedState || !storedCodeVerifier || storedState !== state) {
      return c.json({ error: 'Invalid state' }, 400)
    }

    // Googleからユーザー情報を取得
    const googleUser = await validateGoogleAuthorizationCode(code, storedCodeVerifier)

    // ユーザーを取得または作成
    let user = await getUserByGoogleId(googleUser.id)

    if (!user) {
      user = await createUser(
        googleUser.id,
        googleUser.email,
        googleUser.name || null,
        googleUser.picture || null
      )
    } else {
      await updateUserLastLogin(user.id)
    }

    // 匿名ユーザーを紐付け
    const anonymousId = getOrCreateAnonymousId(c)
    await linkAnonymousUserToUser(anonymousId, user.id)

    // オンボーディング進捗を移行
    await migrateOnboardingProgress(anonymousId, user.id)

    // セッションを作成
    setSessionCookie(c, user.id)

    // オンボーディング状態をチェック
    const progress = await getOnboardingProgressByUserId(user.id)
    const needsOnboarding = !progress || !progress.tutorial_completed

    // リダイレクト先を決定
    if (needsOnboarding) {
      return c.redirect('/?onboarding=true')
    } else {
      return c.redirect('/')
    }
  } catch (error) {
    console.error('Error in Google OAuth callback:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// モックログイン（開発環境のみ）
app.post('/auth/mock', async (c) => {
  try {
    if (!isDevelopment()) {
      return c.json({ error: 'Mock login is only available in development' }, 403)
    }

    const mockUser = createMockUser()

    // モックユーザーを取得または作成
    let user = await getUserByGoogleId(mockUser.id)

    if (!user) {
      user = await createUser(
        mockUser.id,
        mockUser.email,
        mockUser.name || null,
        mockUser.picture || null
      )
    } else {
      await updateUserLastLogin(user.id)
    }

    // 匿名ユーザーを紐付け
    const anonymousId = getOrCreateAnonymousId(c)
    await linkAnonymousUserToUser(anonymousId, user.id)

    // セッションを作成
    setSessionCookie(c, user.id)

    return c.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url
      }
    })
  } catch (error) {
    console.error('Error in mock login:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ログアウト
app.post('/auth/logout', (c) => {
  clearSession(c)
  return c.json({ success: true })
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
// 協調フィルタリングにも対応（algorithm=collaborative）
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

    // クエリパラメータからタグを取得（カンマ区切り）
    const tagsParam = c.req.query('tags')
    const tags = tagsParam ? tagsParam.split(',').map(t => t.trim()).filter(t => t.length > 0) : []

    // タグ演算子を取得（AND/OR）
    const tagOperator = (c.req.query('tagOperator') === 'AND' ? 'AND' : 'OR') as 'OR' | 'AND'

    // フリーワード検索クエリを取得
    const query = c.req.query('query')

    // フォロワー数フィルターを取得
    const minFollowersParam = c.req.query('minFollowers')
    const maxFollowersParam = c.req.query('maxFollowers')
    const minFollowers = minFollowersParam ? parseInt(minFollowersParam, 10) : undefined
    const maxFollowers = maxFollowersParam ? parseInt(maxFollowersParam, 10) : undefined

    // デバッグ: フォロワー数フィルタのパラメータをログ出力
    if (minFollowers !== undefined || maxFollowers !== undefined) {
      console.log(`[API] Follower filter params: min=${minFollowers}, max=${maxFollowers}`)
    }

    // ライブ中のみフィルター
    const liveOnly = c.req.query('liveOnly') === 'true'

    // アルゴリズム選択（random / collaborative）
    const algorithm = c.req.query('algorithm') || 'random'

    // ランダム混入比率（デフォルト: 0.3）
    const randomRatio = parseFloat(c.req.query('randomRatio') || '0.3')

    // デバッグモード
    const debug = c.req.query('debug') === 'true'

    // アクション済み配信者IDを取得
    const excludeIds = await getActionedStreamerIds(user.id)

    // ライブ中のみフィルターが有効な場合、ライブ中のチャンネルIDを取得
    let liveChannelIds: string[] | undefined
    if (liveOnly) {
      let liveStatusMap = cache.getLiveStatus()

      // キャッシュがない場合、Stale版を試す（TTL切れでもOK）
      if (!liveStatusMap) {
        liveStatusMap = cache.getLiveStatusStale()
        if (liveStatusMap) {
          console.log('[LiveFilter] Using stale cache for live filter')
        }
      }

      if (liveStatusMap) {
        liveChannelIds = Array.from(liveStatusMap.entries())
          .filter(([, status]) => status.isLive)
          .map(([channelId]) => channelId)
        console.log(`[LiveFilter] Found ${liveChannelIds.length} live channels`)
      } else {
        // ライブステータスが全くない場合は空配列を返す
        console.log('[LiveFilter] No live status cache available (not even stale)')
        liveChannelIds = []
      }
    }

    if (algorithm === 'collaborative') {
      // 協調フィルタリング
      if (debug) {
        // デバッグ情報付き
        const result = await getCollaborativeRecommendationsWithDebug(
          user.id,
          excludeIds,
          tags,
          count,
          randomRatio,
          query,
          tagOperator,
          minFollowers,
          maxFollowers,
          liveChannelIds
        )
        // レコメンデーションはユーザー固有なのでプライベートキャッシュ（5分）
        c.header('Cache-Control', 'private, max-age=300')
        return c.json({
          ...result,
          count: result.streamers.length,
          filters: { tags, query, tagOperator, minFollowers, maxFollowers, liveOnly },
          algorithm: 'collaborative'
        })
      } else {
        // 通常モード
        const streamers = await getCollaborativeRecommendations(
          user.id,
          excludeIds,
          tags,
          count,
          randomRatio,
          query,
          tagOperator,
          minFollowers,
          maxFollowers,
          liveChannelIds
        )
        // レコメンデーションはユーザー固有なのでプライベートキャッシュ（5分）
        c.header('Cache-Control', 'private, max-age=300')
        return c.json({
          streamers,
          count: streamers.length,
          filters: { tags, query, tagOperator, minFollowers, maxFollowers, liveOnly },
          algorithm: 'collaborative'
        })
      }
    } else {
      // 既存のランダムロジック
      const streamers = await getRandomStreamers(count, excludeIds, tags, query, tagOperator, minFollowers, maxFollowers, liveChannelIds)
      // ストリーマーデータはユーザー固有なのでプライベートキャッシュ（5分）
      c.header('Cache-Control', 'private, max-age=300')
      return c.json({
        streamers,
        count: streamers.length,
        filters: { tags, query, tagOperator, minFollowers, maxFollowers, liveOnly },
        algorithm: 'random'
      })
    }
  } catch (error) {
    console.error('Error fetching streamers:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ライブ配信状態を取得
app.get('/streamers/live-status', async (c) => {
  try {
    // 開発環境ではライブ状態を取得しない
    const isDevelopment = process.env.NODE_ENV !== 'production'
    if (isDevelopment) {
      console.log('[LiveStatus] Development mode - skipping live status fetch')
      return c.json({ liveStatus: {} })
    }

    const apiKey = process.env.YOUTUBE_API_KEY

    if (!apiKey) {
      console.error('[LiveStatus] YOUTUBE_API_KEY is not configured')
      return c.json({ error: 'YouTube API is not configured' }, 503)
    }

    console.log('[LiveStatus] API Key present:', !!apiKey, 'Length:', apiKey?.length || 0)

    // キャッシュから取得を試みる
    let liveStatusMap = cache.getLiveStatus()

    if (!liveStatusMap) {
      // キャッシュミスまたはTTL切れ: 全配信者を取得
      const streamers = await cache.getStreamers()

      // YouTubeチャンネルIDを持つ配信者のみをフィルタ
      // TODO: is_live_streamerフラグでさらに絞り込み（200チャンネル程度）
      const channelIds = streamers
        .filter(s => s.youtube_channel_id)
        .map(s => s.youtube_channel_id as string)

      if (channelIds.length === 0) {
        return c.json({ liveStatus: {} })
      }

      // RSS + Videos API方式でライブ状態を取得（低コスト）
      console.log(`[LiveStatus] Fetching live status for ${channelIds.length} channels (RSS + Videos API)`)
      try {
        const liveStatusList = await getLiveStreamStatus(channelIds, apiKey)

        // Map形式に変換
        liveStatusMap = new Map(liveStatusList.map(info => [info.channelId, info]))

        // キャッシュに保存（5分）
        cache.setLiveStatus(liveStatusMap)
      } catch (youtubeError) {
        console.error('[LiveStatus] YouTube API error:', youtubeError)

        // エラー時のフォールバック: 古いキャッシュデータを使う（Stale-While-Revalidate）
        const staleLiveStatus = cache.getLiveStatusStale()
        if (staleLiveStatus) {
          console.log('[LiveStatus] Falling back to stale cache data due to API error')
          liveStatusMap = staleLiveStatus
        } else {
          console.error('[LiveStatus] No stale cache available, returning empty')
          return c.json({ liveStatus: {} })
        }
      }
    }

    // オブジェクト形式に変換してレスポンス
    const liveStatus: Record<string, LiveStreamInfo> = {}
    if (liveStatusMap) {
      liveStatusMap.forEach((info, channelId) => {
        liveStatus[channelId] = info
      })
    }

    // ライブステータスは5分キャッシュ（頻繁に変わる可能性がある）
    c.header('Cache-Control', 'public, max-age=300')
    return c.json({ liveStatus })
  } catch (error) {
    console.error('Error fetching live status:', error)
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

// 好みを削除（選択を取り消す）
app.delete('/preference/:streamerId', async (c) => {
  try {
    const streamerId = parseInt(c.req.param('streamerId'))

    if (isNaN(streamerId)) {
      return c.json({ error: 'Invalid streamer ID' }, 400)
    }

    // 匿名ユーザーを取得または作成
    const { user } = await getOrCreateCurrentUser(c)

    // 好みを削除
    await deletePreference(user.id, streamerId)

    return c.json({
      success: true,
      message: 'Preference deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting preference:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ========================================
// コメント機能（ログインユーザー限定）
// ========================================

// 配信者のコメント一覧を取得
app.get('/comments/:streamerId', async (c) => {
  try {
    const streamerId = parseInt(c.req.param('streamerId'))

    if (isNaN(streamerId)) {
      return c.json({ error: 'Invalid streamer ID' }, 400)
    }

    const comments = await getCommentsByStreamerId(streamerId)

    return c.json({ comments })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// コメントを投稿（ログインユーザー限定）
app.post('/comments', async (c) => {
  try {
    const userId = getSessionUserId(c)

    if (!userId) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const body = await c.req.json<{
      streamerId: number
      content: string
      commentType?: 'normal' | 'recommendation'
    }>()
    const { streamerId, content, commentType = 'normal' } = body

    if (!streamerId || !content) {
      return c.json({ error: 'streamerId and content are required' }, 400)
    }

    if (content.trim().length === 0) {
      return c.json({ error: 'Comment cannot be empty' }, 400)
    }

    if (content.length > 1000) {
      return c.json({ error: 'Comment is too long (max 1000 characters)' }, 400)
    }

    // キャッシュに追加（定期的にDBに書き込まれる）
    writeCache.addComment(streamerId, userId, content.trim(), commentType)

    // 監査ログを記録（荒らし対策）
    const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
    const userAgent = c.req.header('user-agent')
    await createAuditLog({
      userId,
      action: commentType === 'recommendation' ? 'recommendation_posted' : 'comment_posted',
      resourceType: 'comment',
      streamerId,
      details: {
        commentType,
        contentLength: content.trim().length,
        contentPreview: content.trim().substring(0, 100)
      },
      ipAddress,
      userAgent
    })

    return c.json({
      success: true,
      message: commentType === 'recommendation'
        ? 'Recommendation will be posted shortly'
        : 'Comment will be posted shortly'
    })
  } catch (error) {
    console.error('Error posting comment:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ========================================
// コメントリアクション機能（ログインユーザー限定）
// ========================================

// コメントにリアクション（いいね）を追加
app.post('/comments/:commentId/reactions', async (c) => {
  try {
    const userId = getSessionUserId(c)

    if (!userId) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const commentId = parseInt(c.req.param('commentId'))

    if (isNaN(commentId)) {
      return c.json({ error: 'Invalid comment ID' }, 400)
    }

    const body = await c.req.json<{ reactionType?: 'like' | 'helpful' | 'heart' | 'fire' }>().catch(() => ({}))
    const reactionType = body.reactionType || 'like'

    const reaction = await addCommentReaction(commentId, userId, reactionType)

    if (!reaction) {
      return c.json({ error: 'Failed to add reaction' }, 500)
    }

    return c.json({ success: true, reaction })
  } catch (error) {
    console.error('Error adding reaction:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// コメントからリアクションを削除
app.delete('/comments/:commentId/reactions', async (c) => {
  try {
    const userId = getSessionUserId(c)

    if (!userId) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const commentId = parseInt(c.req.param('commentId'))

    if (isNaN(commentId)) {
      return c.json({ error: 'Invalid comment ID' }, 400)
    }

    const success = await removeCommentReaction(commentId, userId)

    return c.json({ success })
  } catch (error) {
    console.error('Error removing reaction:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ========================================
// おすすめランキング機能
// ========================================

// おすすめランキングを取得
app.get('/recommendations/ranking', async (c) => {
  try {
    const limitParam = c.req.query('limit')
    const sortBy = c.req.query('sortBy') as 'popular' | 'recent' | undefined

    const limit = limitParam ? parseInt(limitParam) : 20
    const ranking = await getRecommendationRanking(limit, sortBy || 'popular')

    return c.json(ranking, 200, {
      'Cache-Control': 'public, max-age=300' // 5分キャッシュ
    })
  } catch (error) {
    console.error('Error getting recommendation ranking:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ========================================
// シェア機能
// ========================================

// シェアログを記録
app.post('/share', async (c) => {
  try {
    const userId = getSessionUserId(c) // オプショナル（未ログインでもシェア可）

    const body = await c.req.json<{
      streamerId: number
      commentId?: number
      platform: 'twitter' | 'facebook' | 'line' | 'other'
      utmSource?: string
      utmMedium?: string
      utmCampaign?: string
    }>()

    const { streamerId, commentId, platform, utmSource, utmMedium, utmCampaign } = body

    if (!streamerId || !platform) {
      return c.json({ error: 'streamerId and platform are required' }, 400)
    }

    const shareLog = await createShareLog({
      userId,
      streamerId,
      commentId,
      platform,
      utmSource,
      utmMedium,
      utmCampaign
    })

    return c.json({ success: true, shareLog })
  } catch (error) {
    console.error('Error creating share log:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// 配信者のシェア用データを取得（OGP生成用）
app.get('/streamers/:id/share-data', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))

    if (isNaN(id)) {
      return c.json({ error: 'Invalid streamer ID' }, 400)
    }

    const streamer = await getStreamerById(id)

    if (!streamer) {
      return c.json({ error: 'Streamer not found' }, 404)
    }

    const shareCount = await getShareCountByStreamerId(id)

    return c.json({
      streamer,
      shareCount,
      shareUrl: `${c.req.url.split('/api')[0]}/streamer/${id}`,
      ogImage: streamer.avatar_url || `${c.req.url.split('/api')[0]}/ogp.png`
    }, 200, {
      'Cache-Control': 'public, max-age=300' // 5分キャッシュ
    })
  } catch (error) {
    console.error('Error getting share data:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ========================================
// お問い合わせ機能（ログインユーザー限定）
// ========================================

// お問い合わせを送信（ログインユーザー限定）
app.post('/contact', async (c) => {
  try {
    const userId = getSessionUserId(c)

    if (!userId) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const body = await c.req.json<{ subject?: string; message: string }>()
    const { subject, message } = body

    if (!message) {
      return c.json({ error: 'message is required' }, 400)
    }

    if (message.trim().length === 0) {
      return c.json({ error: 'Message cannot be empty' }, 400)
    }

    if (message.length > 5000) {
      return c.json({ error: 'Message is too long (max 5000 characters)' }, 400)
    }

    // キャッシュに追加（定期的にDBに書き込まれる）
    writeCache.addContactMessage(userId, subject?.trim() || null, message.trim())

    return c.json({
      success: true,
      message: 'Your message will be sent shortly'
    })
  } catch (error) {
    console.error('Error sending contact message:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ========================================
// タグ管理機能（ログインユーザー限定）
// ========================================

// 配信者にタグを追加（ログインユーザー限定）
app.post('/streamers/:id/tags', async (c) => {
  try {
    const userId = getSessionUserId(c)

    if (!userId) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const streamerId = parseInt(c.req.param('id'))

    if (isNaN(streamerId)) {
      return c.json({ error: 'Invalid streamer ID' }, 400)
    }

    const body = await c.req.json<{ tag: string }>()
    const { tag } = body

    if (!tag || tag.trim().length === 0) {
      return c.json({ error: 'Tag is required' }, 400)
    }

    if (tag.length > 50) {
      return c.json({ error: 'Tag is too long (max 50 characters)' }, 400)
    }

    const updatedStreamer = await addTagToStreamer(streamerId, tag)

    if (!updatedStreamer) {
      return c.json({ error: 'Streamer not found' }, 404)
    }

    // 監査ログを記録（荒らし対策）
    const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
    const userAgent = c.req.header('user-agent')
    await createAuditLog({
      userId,
      action: 'tag_added',
      resourceType: 'tag',
      streamerId,
      details: {
        tag: tag.trim(),
        streamerName: updatedStreamer.name
      },
      ipAddress,
      userAgent
    })

    return c.json({
      success: true,
      streamer: updatedStreamer
    })
  } catch (error) {
    console.error('Error adding tag:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// 配信者からタグを削除（ログインユーザー限定）
app.delete('/streamers/:id/tags/:tag', async (c) => {
  try {
    const userId = getSessionUserId(c)

    if (!userId) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const streamerId = parseInt(c.req.param('id'))
    const tag = c.req.param('tag')

    if (isNaN(streamerId)) {
      return c.json({ error: 'Invalid streamer ID' }, 400)
    }

    if (!tag) {
      return c.json({ error: 'Tag is required' }, 400)
    }

    const updatedStreamer = await removeTagFromStreamer(streamerId, tag)

    if (!updatedStreamer) {
      return c.json({ error: 'Streamer not found' }, 404)
    }

    // 監査ログを記録（荒らし対策）
    const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
    const userAgent = c.req.header('user-agent')
    await createAuditLog({
      userId,
      action: 'tag_removed',
      resourceType: 'tag',
      streamerId,
      details: {
        tag,
        streamerName: updatedStreamer.name
      },
      ipAddress,
      userAgent
    })

    return c.json({
      success: true,
      streamer: updatedStreamer
    })
  } catch (error) {
    console.error('Error removing tag:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ========================================
// オンボーディング関連エンドポイント
// ========================================

// オンボーディング状態取得
app.get('/onboarding/status', async (c) => {
  try {
    // 匿名ユーザーを取得
    const { user } = await getOrCreateCurrentUser(c)

    // オンボーディング進捗を取得
    const progress = await getOnboardingProgress(user.id)

    return c.json({
      hasCompletedOnboarding: progress?.tutorial_completed || false,
      currentStep: determineCurrentStep(progress),
      progress: progress || null,
      recommendedTags: progress?.quiz_results?.recommendedTags || []
    })
  } catch (error) {
    console.error('Error fetching onboarding status:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// 診断結果の保存
app.post('/onboarding/quiz', async (c) => {
  try {
    // 匿名ユーザーを取得
    const { user } = await getOrCreateCurrentUser(c)

    // リクエストボディから回答を取得
    const body = await c.req.json<{ answers: Array<{ questionId: number; answer: string }> }>()
    const { answers } = body

    if (!answers || !Array.isArray(answers)) {
      return c.json({ error: 'answers is required' }, 400)
    }

    // タグマッピングロジックで推奨タグを計算
    const recommendedTags = mapAnswersToTags(answers)

    // 診断結果を保存
    await saveQuizResults(user.id, { answers }, recommendedTags)

    return c.json({
      recommendedTags,
      nextStep: 'tags'
    })
  } catch (error) {
    console.error('Error saving quiz results:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// タグ選択の保存
app.post('/onboarding/tags', async (c) => {
  try {
    // 匿名ユーザーを取得
    const { user } = await getOrCreateCurrentUser(c)

    // リクエストボディから選択タグを取得
    const body = await c.req.json<{ selectedTags: string[] }>()
    const { selectedTags } = body

    if (!selectedTags || !Array.isArray(selectedTags)) {
      return c.json({ error: 'selectedTags is required' }, 400)
    }

    // タグ選択を保存
    await saveTagSelection(user.id, selectedTags)

    return c.json({
      success: true,
      nextStep: 'tutorial'
    })
  } catch (error) {
    console.error('Error saving tag selection:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// チュートリアル完了
app.post('/onboarding/tutorial-complete', async (c) => {
  try {
    // 匿名ユーザーを取得
    const { user } = await getOrCreateCurrentUser(c)

    // チュートリアル完了を記録
    const progress = await completeOnboarding(user.id)

    return c.json({
      success: true,
      completedAt: progress.completed_at?.toISOString() || new Date().toISOString()
    })
  } catch (error) {
    console.error('Error completing onboarding:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// APIをメインアプリにマウント
mainApp.route('/api', app)

export default mainApp
