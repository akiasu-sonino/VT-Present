#!/usr/bin/env node

/**
 * データベースマイグレーション実行スクリプト
 * Usage: node db/run-migration.js <migration-file>
 * Example: node db/run-migration.js db/migrations/002_add_social_features.sql
 */

import { sql } from '@vercel/postgres'
import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function runMigration(migrationFile) {
  try {
    console.log(`\n📦 Reading migration file: ${migrationFile}`)
    const migrationSQL = await readFile(migrationFile, 'utf-8')

    console.log(`\n🔄 Executing migration...`)
    console.log('─'.repeat(60))

    // マイグレーションSQLを実行
    await sql.query(migrationSQL)

    console.log('─'.repeat(60))
    console.log('✅ Migration completed successfully!')

    // 接続を終了
    await sql.end()
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    await sql.end()
    process.exit(1)
  }
}

// コマンドライン引数から migrate ファイルパスを取得
const args = process.argv.slice(2)

if (args.length === 0) {
  console.error('❌ Usage: node db/run-migration.js <migration-file>')
  console.error('   Example: node db/run-migration.js db/migrations/002_add_social_features.sql')
  process.exit(1)
}

const migrationFile = args[0]

// マイグレーション実行
runMigration(migrationFile)
