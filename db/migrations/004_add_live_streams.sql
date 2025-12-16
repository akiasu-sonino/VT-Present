-- ライブ配信状態を保存するテーブル
-- Vercel Cronで5分間隔で更新される

CREATE TABLE IF NOT EXISTS live_streams (
  channel_id VARCHAR(24) PRIMARY KEY,
  is_live BOOLEAN NOT NULL DEFAULT false,
  viewer_count INTEGER,
  video_id VARCHAR(50),
  title TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- インデックス: 最終更新時刻でのクエリ最適化
CREATE INDEX IF NOT EXISTS idx_live_streams_updated_at ON live_streams(updated_at);

-- インデックス: ライブ中のチャンネル検索最適化
CREATE INDEX IF NOT EXISTS idx_live_streams_is_live ON live_streams(is_live) WHERE is_live = true;

-- コメント
COMMENT ON TABLE live_streams IS 'YouTubeライブ配信状態を保存（Vercel Cronで5分間隔更新）';
COMMENT ON COLUMN live_streams.channel_id IS 'YouTubeチャンネルID';
COMMENT ON COLUMN live_streams.is_live IS 'ライブ配信中かどうか';
COMMENT ON COLUMN live_streams.viewer_count IS '現在の視聴者数';
COMMENT ON COLUMN live_streams.video_id IS 'ライブ配信の動画ID';
COMMENT ON COLUMN live_streams.title IS 'ライブ配信のタイトル';
COMMENT ON COLUMN live_streams.updated_at IS '最終更新時刻（Cron実行時刻）';
