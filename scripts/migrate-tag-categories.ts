/* eslint-disable no-console */
/**
 * Tag Categories Migration Script
 * タグカテゴリテーブルを作成し、初期データを投入します
 *
 * 実行方法:
 * ローカル: npm run migrate-tag-categories
 * 本番: POSTGRES_URL=... npm run migrate-tag-categories
 */

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'
import fs from 'fs'
import path from 'path'

// 環境変数を読み込み（.env.local があれば優先）
config({ path: '.env.local' })

// 本番環境チェック
const isProd = process.env.NODE_ENV === 'production' || !process.env.POSTGRES_URL?.includes('localhost')
console.log(`Environment: ${isProd ? 'Production' : 'Development'}`)
console.log(`Database: ${process.env.POSTGRES_URL ? 'Connected' : 'Not configured'}\n`)

async function migrateTagCategories() {
  console.log('🚀 Starting tag categories migration...\n')

  try {
    // マイグレーションファイルを読み込み
    const migrationPath = path.join(process.cwd(), 'db', 'migrations', '001_add_tag_categories.sql')
    const migration = fs.readFileSync(migrationPath, 'utf-8')

    console.log('📋 Creating tag_categories table and inserting initial data...')
    await sql.query(migration)
    console.log('✅ Migration completed successfully\n')

    // 確認のため、データを取得
    const result = await sql`
      SELECT category_name, COUNT(*) as tag_count
      FROM tag_categories
      GROUP BY category_name
      ORDER BY category_name
    `

    console.log('📊 Tag categories summary:')
    result.rows.forEach(row => {
      console.log(`  - ${row.category_name}: ${row.tag_count} tags`)
    })

    process.exit(0)

  } catch (error) {
    console.error('❌ Error during migration:', error)
    process.exit(1)
  }
}

migrateTagCategories()
