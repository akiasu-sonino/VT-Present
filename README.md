# VT-Present

**「埋もれた才能を見つけ出す、新時代のライブ配信キュレーションプラットフォーム」**

駆け出しVTuber・配信者と視聴者をマッチングするレコメンドプラットフォームのMVP実装です。

## 技術スタック

- **Framework**: Hono v4
- **Build Tool**: Vite
- **Platform**: Vercel
- **Database**: Vercel Postgres
- **Language**: TypeScript

## セットアップ手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Vercel Postgresの作成

1. [Vercel Dashboard](https://vercel.com/dashboard)にログイン
2. プロジェクトを選択
3. **Storage** → **Create Database** → **Postgres** を選択
4. データベースを作成

### 3. 環境変数の設定

1. Vercelダッシュボードの **Storage** → **Postgres** から接続情報をコピー
2. `.env.example` を `.env.local` にコピー
3. コピーした接続情報を `.env.local` に貼り付け

```bash
cp .env.example .env.local
```

`.env.local` の内容例:
```env
POSTGRES_URL="postgres://..."
POSTGRES_PRISMA_URL="postgres://..."
# ... (Vercelからコピーした全ての環境変数)
```

### 4. データベースのセットアップ

スキーマ作成とサンプルデータ投入:

```bash
npm run setup-db
```

これにより以下が実行されます:
- テーブル作成 (`streamers`, `anonymous_users`, `preferences`)
- サンプル配信者データ20件の投入

### 5. 開発サーバーの起動

```bash
npm run dev
```

サーバーが起動したら、ブラウザで http://localhost:5173 にアクセス

## API エンドポイント

### GET `/api/streams/random`
ランダムに配信者を1人取得

**レスポンス例:**
```json
{
  "id": 1,
  "name": "星空あかり",
  "platform": "YouTube",
  "avatar_url": "https://i.pravatar.cc/150?img=1",
  "description": "ゲーム配信とおしゃべりが好きな新人Vtuberです！",
  "tags": ["ゲーム", "雑談", "FPS"],
  "follower_count": 250,
  "created_at": "2025-01-15T12:00:00Z"
}
```

### POST `/api/preference/:action`
ユーザーの好みを記録（`LIKE`, `SOSO`, `DISLIKE`）

**リクエスト例:**
```bash
curl -X POST http://localhost:5173/api/preference/like \
  -H "Content-Type: application/json" \
  -d '{"streamerId": 1}'
```

**レスポンス例:**
```json
{
  "success": true,
  "preference": {
    "id": 1,
    "anonymous_user_id": 1,
    "streamer_id": 1,
    "action": "LIKE",
    "created_at": "2025-01-15T12:00:00Z"
  }
}
```

## プロジェクト構成

```
VT-Present/
├── api/
│   └── index.ts          # Vercelサーバーレス関数エントリポイント
├── src/
│   ├── index.ts          # Honoアプリケーションのメインファイル
│   └── lib/
│       ├── db.ts         # データベース関連の関数
│       └── auth.ts       # 匿名ユーザー認証
├── db/
│   ├── schema.sql        # データベーススキーマ定義
│   └── seed.sql          # サンプルデータ
├── scripts/
│   └── setup-db.ts       # DBセットアップスクリプト
├── vite.config.ts        # Vite設定
├── vercel.json           # Vercel設定
└── package.json
```

## デプロイ

### Vercelへのデプロイ

```bash
vercel --prod
```

または、GitHubリポジトリと連携して自動デプロイ:
1. Vercel Dashboardでプロジェクトを作成
2. GitHubリポジトリと連携
3. 環境変数を設定（Storage → Postgresから自動設定される）
4. デプロイ

## 次のステップ（RoadMap参照）

- [ ] フロントエンド実装（配信者カードUI）
- [ ] スワイプ機能の実装
- [ ] レコメンドロジックの実装
- [ ] Google認証の追加
- [ ] 匿名ユーザーから認証ユーザーへのマイグレーション

## ライセンス

MIT
