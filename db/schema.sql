-- VT-Present Database Schema
-- このファイルはVercel Postgresで実行してテーブルを作成します

-- 既存のテーブルと型を削除（再セットアップ用）
DROP TABLE IF EXISTS comment_reactions CASCADE;
DROP TABLE IF EXISTS share_logs CASCADE;
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
  created_at TIMESTAMP DEFAULT NOW(),
  channel_created_at TIMESTAMP  -- YouTubeチャンネル開設日（新人判定用）
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
  comment_type VARCHAR(20) DEFAULT 'normal' CHECK (comment_type IN ('normal', 'recommendation')),
  reaction_count INTEGER DEFAULT 0,
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

-- オンボーディング進捗管理テーブル（ユーザーの初回訪問時の診断・チュートリアル進捗）
CREATE TABLE user_onboarding_progress (
  id SERIAL PRIMARY KEY,
  anonymous_user_id INTEGER REFERENCES anonymous_users(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

  -- オンボーディング完了フラグ
  quiz_completed BOOLEAN DEFAULT FALSE,
  tags_selected BOOLEAN DEFAULT FALSE,
  tutorial_completed BOOLEAN DEFAULT FALSE,

  -- 診断結果（JSONB形式）
  quiz_results JSONB,  -- { "answers": [...], "recommendedTags": [...] }

  -- 選択されたタグ
  selected_tags TEXT[],

  -- タイムスタンプ
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,

  CONSTRAINT unique_anonymous_user UNIQUE (anonymous_user_id),
  CONSTRAINT unique_user UNIQUE (user_id)
);

CREATE INDEX idx_onboarding_anonymous_user ON user_onboarding_progress(anonymous_user_id);
CREATE INDEX idx_onboarding_user ON user_onboarding_progress(user_id);

-- ========================================
-- ソーシャル機能テーブル
-- ========================================

-- コメントへのリアクションテーブル（いいね/反応機能）
CREATE TABLE comment_reactions (
  id SERIAL PRIMARY KEY,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type VARCHAR(20) DEFAULT 'like' CHECK (reaction_type IN ('like', 'helpful', 'heart', 'fire')),
  created_at TIMESTAMP DEFAULT NOW(),

  -- 同じユーザーは1つのコメントに1回のみ反応可能
  CONSTRAINT unique_comment_user_reaction UNIQUE(comment_id, user_id)
);

CREATE INDEX idx_comment_reactions_comment ON comment_reactions(comment_id);
CREATE INDEX idx_comment_reactions_user ON comment_reactions(user_id);
CREATE INDEX idx_comment_reactions_created_at ON comment_reactions(created_at DESC);

-- SNSシェアログテーブル（KPI計測用）
CREATE TABLE share_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  streamer_id INTEGER NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
  comment_id INTEGER REFERENCES comments(id) ON DELETE SET NULL,
  platform VARCHAR(20) DEFAULT 'twitter' CHECK (platform IN ('twitter', 'facebook', 'line', 'other')),
  utm_source VARCHAR(50),
  utm_medium VARCHAR(50),
  utm_campaign VARCHAR(50),
  shared_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_share_logs_user ON share_logs(user_id);
CREATE INDEX idx_share_logs_streamer ON share_logs(streamer_id);
CREATE INDEX idx_share_logs_comment ON share_logs(comment_id);
CREATE INDEX idx_share_logs_platform ON share_logs(platform);
CREATE INDEX idx_share_logs_shared_at ON share_logs(shared_at DESC);
CREATE INDEX idx_share_logs_utm_source ON share_logs(utm_source);

-- リアクション数を自動更新するトリガー関数
CREATE OR REPLACE FUNCTION update_comment_reaction_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE comments
    SET reaction_count = reaction_count + 1
    WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE comments
    SET reaction_count = GREATEST(reaction_count - 1, 0)
    WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reaction_count
AFTER INSERT OR DELETE ON comment_reactions
FOR EACH ROW
EXECUTE FUNCTION update_comment_reaction_count();

-- comments テーブルのおすすめコメント検索用インデックス
CREATE INDEX idx_comments_type ON comments(comment_type);
CREATE INDEX idx_comments_streamer_type ON comments(streamer_id, comment_type);
