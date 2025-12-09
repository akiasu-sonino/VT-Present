-- VT-Present Database Schema
-- このファイルはVercel Postgresで実行してテーブルを作成します

-- 既存のテーブルと型を削除（再セットアップ用）
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS contact_messages CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS preferences CASCADE;
DROP TABLE IF EXISTS anonymous_users CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS streamers CASCADE;
DROP TYPE IF EXISTS preference_action CASCADE;

-- アクションの種類を定義
CREATE TYPE preference_action AS ENUM ('LIKE', 'SOSO', 'DISLIKE');

-- 配信者テーブル
CREATE TABLE streamers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  platform VARCHAR(50),
  avatar_url VARCHAR(255),
  description TEXT,
  tags TEXT[],
  follower_count INTEGER DEFAULT 0,
  channel_url TEXT,
  youtube_channel_id VARCHAR(24) UNIQUE,
  twitch_user_id VARCHAR(15) UNIQUE,
  video_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 認証済みユーザーテーブル（Google OAuth）
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  google_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP DEFAULT NOW()
);

-- 匿名ユーザー管理テーブル
CREATE TABLE anonymous_users (
  id SERIAL PRIMARY KEY,
  anonymous_id UUID UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id),  -- 認証済みユーザーへの紐付け（オプショナル）
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

-- コメントテーブル（ログインユーザーのみ）
CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  streamer_id INTEGER REFERENCES streamers(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- お問い合わせメッセージテーブル（ログインユーザーのみ）
CREATE TABLE contact_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255),
  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 監査ログテーブル（荒らし対策のためのユーザー行動記録）
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,  -- 'comment_posted', 'tag_added', 'tag_removed'
  resource_type VARCHAR(50),     -- 'comment', 'tag', 'streamer'
  resource_id INTEGER,           -- 対象リソースのID
  streamer_id INTEGER REFERENCES streamers(id) ON DELETE SET NULL,  -- 対象配信者
  details JSONB,                 -- 追加情報（コメント内容、タグ名など）
  ip_address INET,               -- IPアドレス（オプション）
  user_agent TEXT,               -- ブラウザ情報（オプション）
  created_at TIMESTAMP DEFAULT NOW()
);

-- インデックス作成（検索高速化）
CREATE INDEX idx_preferences_user ON preferences(anonymous_user_id);
CREATE INDEX idx_preferences_streamer ON preferences(streamer_id);
CREATE INDEX idx_anonymous_users_id ON anonymous_users(anonymous_id);
CREATE INDEX idx_anonymous_users_user_id ON anonymous_users(user_id);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_comments_streamer ON comments(streamer_id);
CREATE INDEX idx_comments_user ON comments(user_id);
CREATE INDEX idx_contact_messages_user ON contact_messages(user_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_streamer ON audit_logs(streamer_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
