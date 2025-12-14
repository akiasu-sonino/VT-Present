/* eslint-disable no-console */
/**
 * Write Cache Layer
 * コメントとお問い合わせをメモリにバッファリングし、定期的にまとめてDBに書き込む
 */

import { sql } from '@vercel/postgres'
import { cache } from './cache.js'

// バッファリングするコメントの型
interface PendingComment {
  streamerId: number
  userId: number
  content: string
  commentType: 'normal' | 'recommendation'
  timestamp: number
}

// バッファリングするお問い合わせの型
interface PendingContactMessage {
  userId: number
  subject: string | null
  message: string
  timestamp: number
}

/**
 * 書き込みキャッシュマネージャー
 * 一定時間ごとにまとめてDBに書き込む
 */
class WriteCache {
  private commentBuffer: PendingComment[] = []
  private contactBuffer: PendingContactMessage[] = []
  private flushInterval: ReturnType<typeof setInterval> | null = null
  private readonly FLUSH_INTERVAL_MS = 30000 // 30秒ごとに書き込み

  constructor() {
    this.startAutoFlush()
  }

  /**
   * 自動フラッシュを開始
   */
  private startAutoFlush(): void {
    if (this.flushInterval) {
      return // 既に開始済み
    }

    this.flushInterval = setInterval(async () => {
      await this.flush()
    }, this.FLUSH_INTERVAL_MS)

    console.log(`[WriteCache] Auto-flush started (interval: ${this.FLUSH_INTERVAL_MS}ms)`)
  }

  /**
   * 自動フラッシュを停止（通常は不要だが、テスト用）
   */
  stopAutoFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
      console.log('[WriteCache] Auto-flush stopped')
    }
  }

  /**
   * コメントをバッファに追加
   */
  addComment(
    streamerId: number,
    userId: number,
    content: string,
    commentType: 'normal' | 'recommendation' = 'normal'
  ): void {
    this.commentBuffer.push({
      streamerId,
      userId,
      content,
      commentType,
      timestamp: Date.now()
    })
    console.log(`[WriteCache] Comment (${commentType}) added to buffer (total: ${this.commentBuffer.length})`)
  }

  /**
   * お問い合わせをバッファに追加
   */
  addContactMessage(userId: number, subject: string | null, message: string): void {
    this.contactBuffer.push({
      userId,
      subject,
      message,
      timestamp: Date.now()
    })
    console.log(`[WriteCache] Contact message added to buffer (total: ${this.contactBuffer.length})`)
  }

  /**
   * バッファ内のデータをすべてDBに書き込む
   */
  async flush(): Promise<void> {
    const commentsToWrite = [...this.commentBuffer]
    const contactsToWrite = [...this.contactBuffer]

    // バッファをクリア（書き込み中に新しいデータが追加される可能性があるため先にクリア）
    this.commentBuffer = []
    this.contactBuffer = []

    if (commentsToWrite.length === 0 && contactsToWrite.length === 0) {
      return // 書き込むデータがない
    }

    console.log(`[WriteCache] Flushing ${commentsToWrite.length} comments and ${contactsToWrite.length} contact messages...`)

    try {
      // コメントを一括挿入
      if (commentsToWrite.length > 0) {
        await this.flushComments(commentsToWrite)
      }

      // お問い合わせを一括挿入
      if (contactsToWrite.length > 0) {
        await this.flushContactMessages(contactsToWrite)
      }

      console.log('[WriteCache] Flush completed successfully')
    } catch (error) {
      console.error('[WriteCache] Flush failed:', error)

      // エラーが発生した場合、データをバッファに戻す
      this.commentBuffer.unshift(...commentsToWrite)
      this.contactBuffer.unshift(...contactsToWrite)

      throw error
    }
  }

  /**
   * コメントをDBに一括挿入
   */
  private async flushComments(comments: PendingComment[]): Promise<void> {
    if (comments.length === 0) return

    // VALUES句を動的に生成
    const values = comments.map((comment, index) => {
      const base = index * 4
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`
    }).join(', ')

    // パラメータ配列を生成
    const params = comments.flatMap(c => [c.streamerId, c.userId, c.content, c.commentType])

    const query = `
      INSERT INTO comments (streamer_id, user_id, content, comment_type)
      VALUES ${values}
    `

    await sql.query(query, params)
    console.log(`[WriteCache] Inserted ${comments.length} comments`)

    // 影響を受けたストリーマーのコメントキャッシュを無効化
    const affectedStreamerIds = new Set(comments.map(c => c.streamerId))
    affectedStreamerIds.forEach(streamerId => {
      cache.invalidateComments(streamerId)
    })
  }

  /**
   * お問い合わせをDBに一括挿入
   */
  private async flushContactMessages(messages: PendingContactMessage[]): Promise<void> {
    if (messages.length === 0) return

    // VALUES句を動的に生成
    const values = messages.map((_, index) => {
      const base = index * 3
      return `($${base + 1}, $${base + 2}, $${base + 3})`
    }).join(', ')

    // パラメータ配列を生成
    const params = messages.flatMap(m => [m.userId, m.subject, m.message])

    const query = `
      INSERT INTO contact_messages (user_id, subject, message)
      VALUES ${values}
    `

    await sql.query(query, params)
    console.log(`[WriteCache] Inserted ${messages.length} contact messages`)
  }

  /**
   * 統計情報を取得（デバッグ用）
   */
  getStats(): {
    commentBufferSize: number
    contactBufferSize: number
    autoFlushEnabled: boolean
    flushIntervalMs: number
  } {
    return {
      commentBufferSize: this.commentBuffer.length,
      contactBufferSize: this.contactBuffer.length,
      autoFlushEnabled: this.flushInterval !== null,
      flushIntervalMs: this.FLUSH_INTERVAL_MS
    }
  }
}

// シングルトンインスタンスをエクスポート
export const writeCache = new WriteCache()
