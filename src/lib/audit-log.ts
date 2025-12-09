import { sql } from '@vercel/postgres'

export interface AuditLogEntry {
  userId: number
  action: string
  resourceType?: string
  resourceId?: number
  streamerId?: number
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

/**
 * 監査ログをデータベースに記録する
 * 荒らし対策のためにユーザーの行動を記録します
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await sql`
      INSERT INTO audit_logs (
        user_id,
        action,
        resource_type,
        resource_id,
        streamer_id,
        details,
        ip_address,
        user_agent,
        created_at
      ) VALUES (
        ${entry.userId},
        ${entry.action},
        ${entry.resourceType || null},
        ${entry.resourceId || null},
        ${entry.streamerId || null},
        ${entry.details ? JSON.stringify(entry.details) : null},
        ${entry.ipAddress || null},
        ${entry.userAgent || null},
        NOW()
      )
    `
    console.log(`[AuditLog] ${entry.action} by user ${entry.userId}`)
  } catch (error) {
    // ログ記録失敗はメイン処理に影響を与えないようにする
    console.error('[AuditLog] Failed to create audit log:', error)
  }
}

/**
 * 特定ユーザーの監査ログを取得する
 */
export async function getAuditLogsByUserId(
  userId: number,
  limit = 100
): Promise<unknown[]> {
  try {
    const result = await sql`
      SELECT
        id,
        user_id,
        action,
        resource_type,
        resource_id,
        streamer_id,
        details,
        ip_address,
        user_agent,
        created_at
      FROM audit_logs
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
    return result.rows
  } catch (error) {
    console.error('[AuditLog] Failed to get audit logs:', error)
    return []
  }
}

/**
 * 特定期間の監査ログを取得する
 */
export async function getAuditLogsByPeriod(
  startDate: Date,
  endDate: Date,
  limit = 1000
): Promise<unknown[]> {
  try {
    const result = await sql`
      SELECT
        id,
        user_id,
        action,
        resource_type,
        resource_id,
        streamer_id,
        details,
        ip_address,
        user_agent,
        created_at
      FROM audit_logs
      WHERE created_at BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
    return result.rows
  } catch (error) {
    console.error('[AuditLog] Failed to get audit logs by period:', error)
    return []
  }
}

/**
 * 特定アクションの監査ログを取得する
 */
export async function getAuditLogsByAction(
  action: string,
  limit = 100
): Promise<unknown[]> {
  try {
    const result = await sql`
      SELECT
        id,
        user_id,
        action,
        resource_type,
        resource_id,
        streamer_id,
        details,
        ip_address,
        user_agent,
        created_at
      FROM audit_logs
      WHERE action = ${action}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
    return result.rows
  } catch (error) {
    console.error('[AuditLog] Failed to get audit logs by action:', error)
    return []
  }
}
