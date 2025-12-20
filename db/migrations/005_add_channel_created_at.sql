-- Add channel_created_at column to streamers table
-- YouTubeチャンネル開設日を記録するカラムを追加（新人判定用）

ALTER TABLE streamers
ADD COLUMN IF NOT EXISTS channel_created_at TIMESTAMP;

-- コメント追加
COMMENT ON COLUMN streamers.channel_created_at IS 'YouTubeチャンネル開設日（新人配信者判定に使用）';
