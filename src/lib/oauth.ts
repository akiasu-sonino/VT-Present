/**
 * OAuth Authentication Utilities
 * Google OAuthによる認証処理
 */

import { Google, generateState, generateCodeVerifier } from 'arctic'
import { Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const APP_URL = process.env.APP_URL || 'http://localhost:5173'
const NODE_ENV = process.env.NODE_ENV || 'development'

// Google OAuth クライアント
export const google = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
  ? new Google(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      `${APP_URL}/api/auth/callback/google`
    )
  : null

/**
 * Google OAuth認証URLを生成
 */
export function createGoogleAuthorizationURL(): { url: URL; state: string; codeVerifier: string } {
  if (!google) {
    throw new Error('Google OAuth is not configured')
  }

  const state = generateState()
  const codeVerifier = generateCodeVerifier()

  const url = google.createAuthorizationURL(state, codeVerifier, [
    'openid',
    'profile',
    'email'
  ])

  return { url, state, codeVerifier }
}

/**
 * 認証コードからトークンを取得し、ユーザー情報を取得
 */
export async function validateGoogleAuthorizationCode(
  code: string,
  codeVerifier: string
): Promise<GoogleUser> {
  if (!google) {
    throw new Error('Google OAuth is not configured')
  }

  const tokens = await google.validateAuthorizationCode(code, codeVerifier)

  // Google UserInfo APIからユーザー情報を取得
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${tokens.accessToken()}`
    }
  })

  if (!response.ok) {
    throw new Error('Failed to fetch user info from Google')
  }

  const user: GoogleUser = await response.json()
  return user
}

/**
 * 開発環境用：モックログイン
 */
export function createMockUser(): GoogleUser {
  return {
    id: 'mock-user-123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://via.placeholder.com/150',
    verified_email: true
  }
}

/**
 * セッションCookieを設定
 */
export function setSessionCookie(c: Context, userId: number) {
  // 簡易的なセッションID（本番環境ではJWTなど使用を推奨）
  const sessionData = JSON.stringify({ userId, createdAt: Date.now() })
  const sessionToken = Buffer.from(sessionData).toString('base64')

  setCookie(c, 'session', sessionToken, {
    path: '/',
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 30 // 30日間
  })
}

/**
 * セッションCookieからユーザーIDを取得
 */
export function getSessionUserId(c: Context): number | null {
  const sessionToken = getCookie(c, 'session')

  if (!sessionToken) {
    return null
  }

  try {
    const sessionData = JSON.parse(Buffer.from(sessionToken, 'base64').toString())
    return sessionData.userId || null
  } catch {
    return null
  }
}

/**
 * セッションを削除（ログアウト）
 */
export function clearSession(c: Context) {
  setCookie(c, 'session', '', {
    path: '/',
    maxAge: 0
  })
}

/**
 * 開発環境かどうかを判定
 */
export function isDevelopment(): boolean {
  return NODE_ENV === 'development'
}

// Google User型定義
export interface GoogleUser {
  id: string
  email: string
  verified_email?: boolean
  name?: string
  given_name?: string
  family_name?: string
  picture?: string
  locale?: string
}
