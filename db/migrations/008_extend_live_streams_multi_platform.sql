-- live_streamsテーブルをマルチプラットフォーム対応に拡張
-- YouTube/Twitch両方のライブ配信状態を管理可能にする

-- platformカラム追加（デフォルト'youtube'で既存データとの互換性維持）
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS platform VARCHAR(20) NOT NULL DEFAULT 'youtube';

-- Twitch固有フィールド追加
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS stream_id VARCHAR(50);
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS game_name VARCHAR(255);
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- 主キーを複合キー（channel_id, platform）に変更
-- まず既存の主キー制約を削除
ALTER TABLE live_streams DROP CONSTRAINT IF EXISTS live_streams_pkey;

-- 新しい複合主キーを追加
ALTER TABLE live_streams ADD PRIMARY KEY (channel_id, platform);

-- platformでのクエリ最適化用インデックス
CREATE INDEX IF NOT EXISTS idx_live_streams_platform ON live_streams(platform);

-- コメント更新
COMMENT ON TABLE live_streams IS 'ライブ配信状態を保存（YouTube/Twitch対応）';
COMMENT ON COLUMN live_streams.platform IS 'プラットフォーム: youtube または twitch';
COMMENT ON COLUMN live_streams.channel_id IS 'YouTubeチャンネルID または TwitchユーザーID';
COMMENT ON COLUMN live_streams.stream_id IS 'Twitchストリーム固有ID（YouTubeではNULL）';
COMMENT ON COLUMN live_streams.game_name IS 'Twitchゲーム/カテゴリ名（YouTubeではNULL）';
COMMENT ON COLUMN live_streams.thumbnail_url IS 'Twitchサムネイル画像URL（YouTubeではNULL）';
