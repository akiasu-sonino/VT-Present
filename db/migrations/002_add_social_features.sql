-- ソーシャル機能追加マイグレーション
-- 「この配信者をおすすめする理由」コメント共有機能、いいね/反応機能、シェア機能を追加

-- 1. commentsテーブルを拡張（おすすめ理由コメント対応）
ALTER TABLE comments
ADD COLUMN IF NOT EXISTS comment_type VARCHAR(20) DEFAULT 'normal' CHECK (comment_type IN ('normal', 'recommendation'));

ALTER TABLE comments
ADD COLUMN IF NOT EXISTS reaction_count INTEGER DEFAULT 0;

-- 既存のcommentsインデックスに加えて、おすすめコメント検索用インデックスを追加
CREATE INDEX IF NOT EXISTS idx_comments_type ON comments(comment_type);
CREATE INDEX IF NOT EXISTS idx_comments_streamer_type ON comments(streamer_id, comment_type);

-- 2. comment_reactionsテーブル（コメントへのいいね/反応機能）
CREATE TABLE IF NOT EXISTS comment_reactions (
  id SERIAL PRIMARY KEY,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type VARCHAR(20) DEFAULT 'like' CHECK (reaction_type IN ('like', 'helpful', 'heart', 'fire')),
  created_at TIMESTAMP DEFAULT NOW(),

  -- 同じユーザーは1つのコメントに1回のみ反応可能
  CONSTRAINT unique_comment_user_reaction UNIQUE(comment_id, user_id)
);

-- comment_reactionsテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user ON comment_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_created_at ON comment_reactions(created_at DESC);

-- 3. share_logsテーブル（SNSシェア機能のKPI計測）
CREATE TABLE IF NOT EXISTS share_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- オプショナル（匿名ユーザーの場合NULL）
  streamer_id INTEGER NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
  comment_id INTEGER REFERENCES comments(id) ON DELETE SET NULL,  -- おすすめコメント付きシェアの場合
  platform VARCHAR(20) DEFAULT 'twitter' CHECK (platform IN ('twitter', 'facebook', 'line', 'other')),

  -- UTMパラメータ（流入元追跡用）
  utm_source VARCHAR(50),      -- 例: 'twitter', 'facebook'
  utm_medium VARCHAR(50),       -- 例: 'social', 'share_button'
  utm_campaign VARCHAR(50),     -- 例: 'recommendation_share', 'streamer_share'

  shared_at TIMESTAMP DEFAULT NOW()
);

-- share_logsテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_share_logs_user ON share_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_share_logs_streamer ON share_logs(streamer_id);
CREATE INDEX IF NOT EXISTS idx_share_logs_comment ON share_logs(comment_id);
CREATE INDEX IF NOT EXISTS idx_share_logs_platform ON share_logs(platform);
CREATE INDEX IF NOT EXISTS idx_share_logs_shared_at ON share_logs(shared_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_logs_utm_source ON share_logs(utm_source);

-- 4. リアクション数を自動更新するトリガー関数
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

-- リアクション追加・削除時に自動でreaction_countを更新
CREATE TRIGGER trigger_update_reaction_count
AFTER INSERT OR DELETE ON comment_reactions
FOR EACH ROW
EXECUTE FUNCTION update_comment_reaction_count();
