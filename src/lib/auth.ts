/**
 * Anonymous User Authentication Utilities
 * 匿名ユーザーの識別と管理
 */

import { v4 as uuidv4 } from 'uuid'
import { Context } from 'hono'
import { getOrCreateAnonymousUser, AnonymousUser } from './db'

const COOKIE_NAME = 'vt_anonymous_id'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1年

/**
 * Cookieから匿名IDを取得、なければ新規作成
 */
export function getOrCreateAnonymousId(c: Context): string {
  // Cookieから取得を試みる
  const existingId = c.req.header('cookie')
    ?.split(';')
    .find(cookie => cookie.trim().startsWith(`${COOKIE_NAME}=`))
    ?.split('=')[1]

  if (existingId) {
    return existingId
  }

  // 新規UUID生成
  return uuidv4()
}

/**
 * 匿名IDをCookieにセット
 */
export function setAnonymousIdCookie(c: Context, anonymousId: string) {
  c.header(
    'Set-Cookie',
    `${COOKIE_NAME}=${anonymousId}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly`
  )
}

/**
 * リクエストから匿名ユーザーを取得または作成
 */
export async function getOrCreateCurrentUser(c: Context): Promise<{
  user: AnonymousUser
  isNew: boolean
}> {
  const anonymousId = getOrCreateAnonymousId(c)

  // DBから取得または作成
  const user = await getOrCreateAnonymousUser(anonymousId)

  // 新規作成された場合はCookieをセット
  const isNew = user.created_at.getTime() === user.last_active_at.getTime()
  if (isNew) {
    setAnonymousIdCookie(c, anonymousId)
  }

  return { user, isNew }
}
