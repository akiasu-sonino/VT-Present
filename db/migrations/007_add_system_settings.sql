-- システム設定テーブル（自動更新などの状態管理用）
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 初期値: 配信者統計の最終更新日時
INSERT INTO system_settings (key, value, updated_at)
VALUES ('streamer_stats_last_update', NULL, NOW())
ON CONFLICT (key) DO NOTHING;
