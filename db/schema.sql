-- VT-Present Database Schema
-- このファイルはVercel Postgresで実行してテーブルを作成します

-- 既存のテーブルと型を削除（再セットアップ用）
DROP TABLE IF EXISTS preferences CASCADE;
DROP TABLE IF EXISTS anonymous_users CASCADE;
DROP TABLE IF EXISTS streamers CASCADE;
DROP TYPE IF EXISTS preference_action CASCADE;

-- アクションの種類を定義
CREATE TYPE preference_action AS ENUM ('LIKE', 'SOSO', 'DISLIKE');

-- 配信者テーブル
CREATE TABLE streamers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  platform VARCHAR(50),
  avatar_url TEXT,
  description TEXT,
  tags TEXT[],
  follower_count INTEGER DEFAULT 0,
  channel_url TEXT,
  video_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 匿名ユーザー管理テーブル
CREATE TABLE anonymous_users (
  id SERIAL PRIMARY KEY,
  anonymous_id UUID UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_active_at TIMESTAMP DEFAULT NOW()
);

-- 好みの蓄積テーブル（いいね/普通/スキップ履歴）
CREATE TABLE preferences (
  id SERIAL PRIMARY KEY,
  anonymous_user_id INTEGER REFERENCES anonymous_users(id),
  streamer_id INTEGER REFERENCES streamers(id),
  action preference_action NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- インデックス作成（検索高速化）
CREATE INDEX idx_preferences_user ON preferences(anonymous_user_id);
CREATE INDEX idx_preferences_streamer ON preferences(streamer_id);
CREATE INDEX idx_anonymous_users_id ON anonymous_users(anonymous_id);
