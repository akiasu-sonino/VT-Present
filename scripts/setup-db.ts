/**
 * Database Setup Script
 * Vercel Postgresにスキーマとサンプルデータを投入します
 *
 * 実行方法:
 * 1. Vercel Postgresを作成
 * 2. .env.localファイルに接続情報を追加 (Vercelダッシュボードからコピー)
 * 3. npm run setup-db を実行
 */

import { config } from 'dotenv'
import { sql } from '@vercel/postgres'
import fs from 'fs'
import path from 'path'

// .env.localを読み込み
config({ path: '.env.local' })

async function setupDatabase() {
  console.log('🚀 Starting database setup...\n')

  try {
    // スキーマファイルを読み込み
    const schemaPath = path.join(process.cwd(), 'db', 'schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf-8')

    console.log('📋 Creating tables...')
    await sql.query(schema)
    console.log('✅ Tables created successfully\n')

    // シードデータを読み込み
    const seedPath = path.join(process.cwd(), 'db', 'seed.sql')
    const seed = fs.readFileSync(seedPath, 'utf-8')

    console.log('🌱 Inserting sample data...')
    await sql.query(seed)
    console.log('✅ Sample data inserted successfully\n')

    // 確認
    const result = await sql`SELECT COUNT(*) as count FROM streamers`
    console.log(`✨ Setup complete! ${result.rows[0].count} streamers loaded.\n`)

  } catch (error) {
    console.error('❌ Error setting up database:', error)
    process.exit(1)
  }
}

setupDatabase()
