-- タグカテゴリテーブルを追加
-- このマイグレーションはタグをカテゴリ別に管理するためのテーブルを作成します

-- タグカテゴリテーブル
CREATE TABLE IF NOT EXISTS tag_categories (
  id SERIAL PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL,
  tag_name VARCHAR(100) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(category_name, tag_name)
);

-- カテゴリ名でのインデックス（検索高速化）
CREATE INDEX IF NOT EXISTS idx_tag_categories_category ON tag_categories(category_name);
CREATE INDEX IF NOT EXISTS idx_tag_categories_tag ON tag_categories(tag_name);

-- 既存のカテゴリ定義を投入
-- ゲーム配信
INSERT INTO tag_categories (category_name, tag_name, sort_order) VALUES
  ('ゲーム配信', 'ゲーム', 1),
  ('ゲーム配信', 'FPS', 2),
  ('ゲーム配信', 'RPG', 3),
  ('ゲーム配信', 'アクション', 4),
  ('ゲーム配信', '格ゲー', 5),
  ('ゲーム配信', 'ホラゲー', 6),
  ('ゲーム配信', 'マイクラ', 7),
  ('ゲーム配信', 'APEX', 8),
  ('ゲーム配信', 'Valorant', 9)
ON CONFLICT (category_name, tag_name) DO NOTHING;

-- エンタメ
INSERT INTO tag_categories (category_name, tag_name, sort_order) VALUES
  ('エンタメ', '歌ってみた', 1),
  ('エンタメ', '雑談', 2),
  ('エンタメ', 'ASMR', 3),
  ('エンタメ', '料理', 4),
  ('エンタメ', 'お絵描き', 5),
  ('エンタメ', '踊ってみた', 6),
  ('エンタメ', '楽器演奏', 7)
ON CONFLICT (category_name, tag_name) DO NOTHING;

-- 学習・教養
INSERT INTO tag_categories (category_name, tag_name, sort_order) VALUES
  ('学習・教養', 'プログラミング', 1),
  ('学習・教養', '勉強', 2),
  ('学習・教養', '英語', 3),
  ('学習・教養', '読書', 4),
  ('学習・教養', '解説', 5)
ON CONFLICT (category_name, tag_name) DO NOTHING;
