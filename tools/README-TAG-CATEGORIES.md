# タグカテゴリマイグレーション ガイド

## 問題: 本番環境でタグが全部「その他」になる

### 原因

本番環境で `tag_categories` テーブルのマイグレーションが実行されていないため、タグカテゴリデータが存在しません。

---

## 解決方法

### ステップ1: 現在の状態を確認

```bash
npm run check:tag-categories
```

**期待される出力（正常時）:**
```
✅ tag_categories テーブルが存在します

📊 カテゴリ別タグ数:
  - ゲーム配信: 9 tags
  - エンタメ: 7 tags
  - 学習・教養: 5 tags
```

**問題がある場合の出力:**
```
❌ tag_categories テーブルが存在しません
または
⚠️  tag_categories テーブルは空です
```

---

### ステップ2: 本番環境でマイグレーションを実行

#### 方法A: Vercelダッシュボード経由（推奨）

1. **Vercelダッシュボードにアクセス**
   - プロジェクトの Settings > Environment Variables
   - `POSTGRES_URL` の値をコピー

2. **ローカルでマイグレーションを実行**

   **Windows (PowerShell):**
   ```powershell
   $env:POSTGRES_URL="your_postgres_url_from_vercel"
   npm run migrate-tag-categories
   ```

   **macOS/Linux:**
   ```bash
   POSTGRES_URL="your_postgres_url_from_vercel" npm run migrate-tag-categories
   ```

#### 方法B: PowerShellスクリプト使用（Windows）

```powershell
# 1. 環境変数を設定
$env:POSTGRES_URL="your_postgres_url_from_vercel"

# 2. スクリプトを実行
.\tools\migrate-production.ps1
```

#### 方法C: Bashスクリプト使用（macOS/Linux）

```bash
# 実行権限を付与（初回のみ）
chmod +x tools/migrate-production.sh

# スクリプトを実行
./tools/migrate-production.sh
```

#### 方法D: Vercel CLI経由（上級者向け）

```bash
# Vercelにログイン
vercel login

# 本番環境の環境変数をプル
vercel env pull .env.production --environment production

# マイグレーション実行
source .env.production && npm run migrate-tag-categories
```

---

### ステップ3: 結果を確認

マイグレーション実行後、以下が表示されればOK:

```
✅ Migration completed successfully

📊 Tag categories summary:
  - ゲーム配信: 9 tags
  - エンタメ: 7 tags
  - 学習・教養: 5 tags
```

---

### ステップ4: アプリで確認

1. 本番環境のアプリをリロード
2. タグフィルターを開く
3. タグが以下のようにカテゴリ分けされていることを確認:
   - ゲーム配信
   - エンタメ
   - 学習・教養
   - その他

---

## トラブルシューティング

### エラー: `POSTGRES_URL is not defined`

**原因:** 環境変数が設定されていない

**解決策:**
1. Vercelダッシュボードで `POSTGRES_URL` を確認
2. 環境変数を正しく設定して再実行

---

### エラー: `Connection refused`

**原因:** データベースへの接続が拒否された

**解決策:**
1. `POSTGRES_URL` が正しいか確認
2. データベースが起動しているか確認
3. IPアドレス制限がある場合は、許可リストに追加

---

### エラー: `Table already exists`

**原因:** テーブルは存在するがデータが空

**解決策:**
```sql
-- 既存のデータを確認
SELECT COUNT(*) FROM tag_categories;

-- 0件の場合、マイグレーションを再実行するとINSERT文が実行される
-- （ON CONFLICT DO NOTHINGなので安全）
```

---

## 技術詳細

### マイグレーションの内容

1. **テーブル作成**
   ```sql
   CREATE TABLE IF NOT EXISTS tag_categories (
     id SERIAL PRIMARY KEY,
     category_name VARCHAR(100) NOT NULL,
     tag_name VARCHAR(100) NOT NULL,
     sort_order INTEGER DEFAULT 0,
     created_at TIMESTAMP DEFAULT NOW(),
     UNIQUE(category_name, tag_name)
   );
   ```

2. **インデックス作成**
   - `category_name` でのインデックス（検索高速化）
   - `tag_name` でのインデックス（逆引き用）

3. **初期データ投入**
   - ゲーム配信: 9タグ
   - エンタメ: 7タグ
   - 学習・教養: 5タグ

### データ取得API

**エンドポイント:** `GET /api/tags`

**レスポンス:**
```json
{
  "tags": ["ゲーム", "FPS", "歌ってみた", ...],
  "categories": {
    "ゲーム配信": ["ゲーム", "FPS", "RPG", ...],
    "エンタメ": ["歌ってみた", "雑談", ...],
    "学習・教養": ["プログラミング", "勉強", ...]
  }
}
```

---

## 定期メンテナンス

### 新しいタグカテゴリを追加

```sql
INSERT INTO tag_categories (category_name, tag_name, sort_order) VALUES
  ('新カテゴリ', '新タグ', 1)
ON CONFLICT (category_name, tag_name) DO NOTHING;
```

### タグのカテゴリを変更

```sql
UPDATE tag_categories
SET category_name = '新しいカテゴリ名'
WHERE tag_name = '変更したいタグ名';
```

### 不要なタグを削除

```sql
DELETE FROM tag_categories
WHERE tag_name = '削除したいタグ名';
```

---

## よくある質問

**Q: 開発環境では動いているのに本番環境で動かない理由は？**

A: `migrate-tag-categories.ts` が `.env.local` を読み込むため、本番環境（Vercel）では環境変数が読み込まれません。本ガイドの手順で手動実行が必要です。

**Q: マイグレーションは何度実行しても安全？**

A: はい。`CREATE TABLE IF NOT EXISTS` と `ON CONFLICT DO NOTHING` を使用しているため、冪等性が保証されています。

**Q: 既存のタグデータは影響を受ける？**

A: いいえ。`streamers` テーブルの `tags` カラムはそのままで、`tag_categories` は表示用のカテゴリ情報のみを管理します。

---

## 参考リンク

- マイグレーションSQL: `db/migrations/001_add_tag_categories.sql`
- マイグレーションスクリプト: `scripts/migrate-tag-categories.ts`
- 確認スクリプト: `tools/check-tag-categories.ts`
