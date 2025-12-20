-- 006: Add latest_video_published_at column to streamers table
-- This column stores the publish date of the streamer's most recent video
-- Used for the "Hidden Gem" badge: followers <= 1000 AND video published within 7 days

ALTER TABLE streamers
ADD COLUMN IF NOT EXISTS latest_video_published_at TIMESTAMP WITH TIME ZONE;

-- Add comment for documentation
COMMENT ON COLUMN streamers.latest_video_published_at IS 'Publish date of the most recent video';
