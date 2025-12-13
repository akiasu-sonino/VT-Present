#!/usr/bin/env tsx
/**
 * データベース内のfollower_count値を確認するスクリプト
 */

import { sql } from '@vercel/postgres'

interface Streamer {
  id: number
  name: string
  follower_count: number
}

async function main() {
  console.log('🔍 フォロワー数データを確認中...\n')

  // 全配信者のフォロワー数を取得
  const result = await sql<Streamer>`
    SELECT id, name, follower_count
    FROM streamers
    ORDER BY follower_count DESC
  `

  const streamers = result.rows

  console.log(`📊 総配信者数: ${streamers.length}\n`)

  // 統計情報
  const followerCounts = streamers.map(s => s.follower_count)
  const min = Math.min(...followerCounts)
  const max = Math.max(...followerCounts)
  const avg = followerCounts.reduce((a, b) => a + b, 0) / followerCounts.length

  console.log('統計情報:')
  console.log(`  最小: ${min.toLocaleString()}`)
  console.log(`  最大: ${max.toLocaleString()}`)
  console.log(`  平均: ${Math.floor(avg).toLocaleString()}`)
  console.log()

  // フォロワー数の分布
  const ranges = [
    { label: '0', min: 0, max: 0 },
    { label: '1-999', min: 1, max: 999 },
    { label: '1K-9.9K', min: 1000, max: 9999 },
    { label: '10K-99.9K', min: 10000, max: 99999 },
    { label: '100K-999.9K', min: 100000, max: 999999 },
    { label: '1M+', min: 1000000, max: Number.MAX_SAFE_INTEGER }
  ]

  console.log('フォロワー数の分布:')
  ranges.forEach(range => {
    const count = streamers.filter(s =>
      s.follower_count >= range.min && s.follower_count <= range.max
    ).length
    const percentage = ((count / streamers.length) * 100).toFixed(1)
    console.log(`  ${range.label.padEnd(15)}: ${count.toString().padStart(4)} (${percentage}%)`)
  })
  console.log()

  // 上位10件
  console.log('フォロワー数 トップ10:')
  streamers.slice(0, 10).forEach((s, i) => {
    console.log(`  ${(i + 1).toString().padStart(2)}. ${s.name.padEnd(30)} - ${s.follower_count.toLocaleString()}`)
  })
  console.log()

  // 下位10件
  console.log('フォロワー数 ボトム10:')
  streamers.slice(-10).reverse().forEach((s, i) => {
    console.log(`  ${(10 - i).toString().padStart(2)}. ${s.name.padEnd(30)} - ${s.follower_count.toLocaleString()}`)
  })
  console.log()

  // フォロワー数が0の配信者
  const zeroFollowers = streamers.filter(s => s.follower_count === 0)
  if (zeroFollowers.length > 0) {
    console.log(`⚠️  フォロワー数が0の配信者: ${zeroFollowers.length}件`)
    console.log('   (これらはフィルタで表示されない可能性があります)')
    console.log()
  }

  // サンプルフィルタテスト
  console.log('フィルタテスト:')
  const testCases = [
    { min: 0, max: 1000, label: '1K未満' },
    { min: 1000, max: 10000, label: '1K-10K' },
    { min: 10000, max: 100000, label: '10K-100K' },
    { min: 100000, max: Number.MAX_SAFE_INTEGER, label: '100K以上' }
  ]

  testCases.forEach(test => {
    const filtered = streamers.filter(s =>
      s.follower_count >= test.min && s.follower_count <= test.max
    )
    console.log(`  ${test.label.padEnd(15)}: ${filtered.length}件`)
  })

  process.exit(0)
}

main().catch(error => {
  console.error('❌ エラー:', error)
  process.exit(1)
})
