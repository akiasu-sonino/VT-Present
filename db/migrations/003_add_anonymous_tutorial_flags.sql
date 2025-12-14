-- マイグレーション: 匿名ユーザー向けチュートリアルフラグを追加
-- 作成日: 2025-12-14

ALTER TABLE user_onboarding_progress
ADD COLUMN IF NOT EXISTS anonymous_tutorial_shown BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS anonymous_tutorial_skipped BOOLEAN DEFAULT FALSE;

-- コメント追加
COMMENT ON COLUMN user_onboarding_progress.anonymous_tutorial_shown IS '匿名ユーザー向けログイン誘導モーダルを表示したかどうか';
COMMENT ON COLUMN user_onboarding_progress.anonymous_tutorial_skipped IS 'ユーザーがログイン誘導をスキップしたかどうか';
