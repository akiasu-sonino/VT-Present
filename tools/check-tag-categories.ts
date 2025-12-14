#!/usr/bin/env tsx
/**
 * タグカテゴリテーブルの状態を確認するスクリプト
 */

import { sql } from '@vercel/postgres'

async function main() {
  console.log('🔍 タグカテゴリの状態を確認中...\n')

  try {
    // テーブルが存在するか確認
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'tag_categories'
      )
    `

    if (!tableCheck.rows[0].exists) {
      console.log('❌ tag_categories テーブルが存在しません')
      console.log('\n本番環境でマイグレーションを実行してください:')
      console.log('  npm run migrate-tag-categories\n')
      process.exit(1)
    }

    console.log('✅ tag_categories テーブルが存在します\n')

    // カテゴリ別のタグ数を取得
    const result = await sql`
      SELECT category_name, COUNT(*) as tag_count
      FROM tag_categories
      GROUP BY category_name
      ORDER BY category_name
    `

    if (result.rows.length === 0) {
      console.log('⚠️  tag_categories テーブルは空です')
      console.log('\nマイグレーションを実行してデータを投入してください:')
      console.log('  npm run migrate-tag-categories\n')
      process.exit(1)
    }

    console.log('📊 カテゴリ別タグ数:')
    result.rows.forEach(row => {
      console.log(`  - ${row.category_name}: ${row.tag_count} tags`)
    })
    console.log()

    // 全タグを取得
    const allTags = await sql`
      SELECT category_name, tag_name
      FROM tag_categories
      ORDER BY category_name, sort_order, tag_name
    `

    console.log(`✅ 合計 ${allTags.rows.length} タグが登録されています\n`)

    // カテゴリごとに表示
    const categories: Record<string, string[]> = {}
    allTags.rows.forEach((row: { category_name: string; tag_name: string }) => {
      if (!categories[row.category_name]) {
        categories[row.category_name] = []
      }
      categories[row.category_name].push(row.tag_name)
    })

    console.log('カテゴリ詳細:')
    Object.entries(categories).forEach(([category, tags]) => {
      console.log(`\n${category}:`)
      tags.forEach(tag => console.log(`  - ${tag}`))
    })

    process.exit(0)

  } catch (error) {
    console.error('❌ エラー:', error)
    process.exit(1)
  }
}

main()
