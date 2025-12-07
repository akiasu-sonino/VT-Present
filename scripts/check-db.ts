/**
 * データベース接続チェックスクリプト
 * usersテーブルが存在するか確認
 */

import { sql } from '@vercel/postgres'
import { config } from 'dotenv'

// .env.localを読み込み
config({ path: '.env.local' })

async function checkDatabase() {
  try {
    console.log('🔍 Checking database connection...')

    // usersテーブルの存在確認
    const tablesResult = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `

    console.log('\n📊 Existing tables:')
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`)
    })

    // usersテーブルが存在するかチェック
    const hasUsersTable = tablesResult.rows.some(row => row.table_name === 'users')

    if (hasUsersTable) {
      console.log('\n✅ users table exists')

      // usersテーブルのレコード数確認
      const countResult = await sql`SELECT COUNT(*) as count FROM users`
      console.log(`   Records: ${countResult.rows[0].count}`)
    } else {
      console.log('\n❌ users table does NOT exist')
      console.log('\nPlease run the schema from db/schema.sql in your database:')
      console.log('1. Go to Vercel Dashboard → Storage → Your Postgres')
      console.log('2. Open SQL Editor')
      console.log('3. Copy and paste the contents of db/schema.sql')
      console.log('4. Execute the SQL')
    }

    // anonymous_usersテーブルの構造確認
    const hasAnonymousUsersTable = tablesResult.rows.some(row => row.table_name === 'anonymous_users')

    if (hasAnonymousUsersTable) {
      const columnsResult = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'anonymous_users'
        ORDER BY ordinal_position
      `

      console.log('\n📋 anonymous_users table structure:')
      columnsResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}`)
      })

      // user_idカラムが存在するかチェック
      const hasUserIdColumn = columnsResult.rows.some(row => row.column_name === 'user_id')

      if (!hasUserIdColumn) {
        console.log('\n⚠️  WARNING: user_id column is missing in anonymous_users table')
        console.log('   Please update your schema by running db/schema.sql')
      }
    }

    console.log('\n✅ Database check complete')

  } catch (error) {
    console.error('\n❌ Database check failed:')
    console.error(error)
    process.exit(1)
  }
}

checkDatabase()
