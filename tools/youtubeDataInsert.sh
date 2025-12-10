#!/bin/bash

# =================================================================
# 設定（本番では環境変数に置くのを推奨）
# =================================================================
YOUTUBE_API_KEY="AIzaSyBP-l2liHEs-4ys6zDUSMjmJxkHv5_VRSU"
GEMINI_API_KEY="AIzaSyAqC4ADw7-XFvWu3V8kwRe91iTYzej2RQA"
DB_CONN_STRING="postgresql://neondb_owner:npg_57hzmRBLTlcD@ep-shy-cloud-a1d938v2-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

export LC_ALL=C.UTF-8
export LANG=C.UTF-8

# =================================================================
# グローバル配列：INSERT VALUES を貯めて後で一括INSERTする
# =================================================================
INSERT_ROWS=()

# =================================================================
# 共通: API呼び出し時のHTTPエラーも含めたレスポンス取得
# =================================================================
fetch_json_or_error() {
    local url="$1"
    local response http_status body

    # curl失敗時もエラーを出す
    response=$(curl -sS -w "\n%{http_code}" "$url") || {
        echo "❌ curlエラー: $url"
        return 1
    }

    # 最終行にHTTPステータス、それ以外がボディ
    http_status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_status" -ge 400 ]; then
        echo "❌ HTTPエラー ($http_status) for: $url"
        echo "---- レスポンス ----"
        echo "$body"
        echo "-------------------"
        return 1
    fi

    echo "$body"
}

# =================================================================
# 個別 YouTuber 1人分の情報を API 取得し、INSERT ROW を組み立てる
# =================================================================
insert_youtube_streamer() {
    local youtube_handle="$1"
    local platform="YouTube"
    local channel_url="https://www.youtube.com/@${youtube_handle}"

    if [ -z "$youtube_handle" ]; then
        echo "❌ エラー: YouTubeハンドル名を入力してください"
        return 1
    fi

    echo "▶️ チャンネルID取得中: @$youtube_handle"

    CHANNEL_ID_OUTPUT=$(./tools/ChannelId.sh "$youtube_handle" 2>&1)
    CHANNEL_ID=$(echo "$CHANNEL_ID_OUTPUT" | tail -n1)

    if [ -z "$CHANNEL_ID" ] || [ "$CHANNEL_ID" == "null" ]; then
        echo "❌ チャンネルIDが取得できませんでした: @$youtube_handle"
        echo "---- 取得スクリプト出力 ----"
        echo "$CHANNEL_ID_OUTPUT"
        echo "---------------------------"
        return 1
    fi

    echo "  - チャンネルID: $CHANNEL_ID"

    echo "▶️ チャンネル情報取得中..."

    CHANNEL_API_URL="https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${CHANNEL_ID}&key=${YOUTUBE_API_KEY}"
    API_RESPONSE=$(fetch_json_or_error "$CHANNEL_API_URL") || {
        echo "❌ チャンネル情報取得APIでエラーが発生しました (@$youtube_handle, channel_id=$CHANNEL_ID)"
        echo "    URL: $CHANNEL_API_URL"
        echo "    上記にHTTPエラーやレスポンス本文を表示済みです"
        return 1
    }

    if [ "$(echo "$API_RESPONSE" | jq '.items | length')" -eq 0 ]; then
        echo "❌ チャンネル情報が見つかりませんでした"
        echo "---- APIレスポンス ----"
        echo "$API_RESPONSE"
        echo "----------------------"
        return 1
    fi

    # ---- JSON 抽出・安全エスケープ ----
    name="$(echo "$API_RESPONSE" | jq -r '.items[0].snippet.title       | @json' | sed 's/^"//; s/"$//' | sed "s/'/''/g" | sed "s/^/'/; s/$/'/")"
    avatar_url="$(echo "$API_RESPONSE" | jq -r '.items[0].snippet.thumbnails.medium.url | @json' | sed 's/^"//; s/"$//' | sed "s/'/''/g" | sed "s/^/'/; s/$/'/")"
    channel_description="$(echo "$API_RESPONSE" | jq -r '.items[0].snippet.description // ""')"
    follower_count=$(echo "$API_RESPONSE" | jq -r '.items[0].statistics.subscriberCount // 0')

    # =================================================================
    # 最新動画 (videoId) の取得
    # =================================================================
    echo "▶️ 最新動画ID取得中..."

    LATEST_VIDEO_RESPONSE=$(fetch_json_or_error \
        "https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${CHANNEL_ID}&part=snippet&order=date&maxResults=1&type=video") || {
        echo "❌ 最新動画取得APIでエラーが発生しました"
        return 1
    }

    video_id=$(echo "$LATEST_VIDEO_RESPONSE" | jq -r '.items[0].id.videoId // empty')
    latest_video_title=""
    latest_video_desc=""
    video_tags_json_array="[]"

    if [ -z "$video_id" ]; then
        echo "  ⚠️ 最新動画なし"
        echo "---- APIレスポンス ----"
        echo "$LATEST_VIDEO_RESPONSE"
        echo "----------------------"
        video_id=""
    else
        echo "  - 最新動画ID: $video_id"

        # 最新動画の詳細取得（タイトル/説明/タグ）
        VIDEO_DETAIL_RESPONSE=$(fetch_json_or_error \
            "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${video_id}&key=${YOUTUBE_API_KEY}") || {
            echo "⚠️ 最新動画詳細の取得に失敗しました（スキップ）"
            VIDEO_DETAIL_RESPONSE=""
        }

        if [ -n "$VIDEO_DETAIL_RESPONSE" ]; then
            latest_video_title="$(echo "$VIDEO_DETAIL_RESPONSE" | jq -r '.items[0].snippet.title // ""')"
            latest_video_desc="$(echo "$VIDEO_DETAIL_RESPONSE" | jq -r '.items[0].snippet.description // ""')"
            video_tags_json_array="$(echo "$VIDEO_DETAIL_RESPONSE" | jq -c '.items[0].snippet.tags // []')"
        fi
    fi

    # =================================================================
    # AI生成: 説明文とタグ
    # =================================================================
    payload=$(jq -n \
        --arg name "$youtube_handle" \
        --arg channel_desc "$channel_description" \
        --arg latest_video_title "$latest_video_title" \
        --arg latest_video_desc "$latest_video_desc" \
        --argjson video_tags "$video_tags_json_array" \
        '{name:$name, channel_desc:$channel_desc, latest_video_title:$latest_video_title, latest_video_desc:$latest_video_desc, video_tags:$video_tags}')

    AI_OUTPUT=$(echo "$payload" | GEMINI_API_KEY="$GEMINI_API_KEY" python3 tools/generate_description_tags.py)
    if [ -n "$AI_OUTPUT" ]; then
        ai_description=$(echo "$AI_OUTPUT" | jq -r '.description // ""' | tr '\n' ' ')
        ai_tags_json=$(echo "$AI_OUTPUT" | jq -c '.tags // []')
    else
        ai_description=""
        ai_tags_json="[]"
    fi

    # SQL用にサニタイズ
    if [ -z "$ai_description" ]; then
        description_sql=$name  # 既存の名前(単一引用符済み)を代用
    else
        escaped_desc=$(printf "%s" "$ai_description" | sed "s/'/''/g")
        description_sql="'${escaped_desc}'"
    fi

    if [ -z "$ai_tags_json" ]; then
        tags_sql="'[]'"
    else
        tags_sql="'${ai_tags_json}'"
    fi

    # =================================================================
    # INSERT ROW を配列に貯める
    # =================================================================
    local row="(
        $name,
        '${platform}',
        $avatar_url,
        ${description_sql},
        ${tags_sql},
        ${follower_count},
        '${channel_url}',
        '${CHANNEL_ID}',
        NULL,
        '${video_id}'
    )"

    INSERT_ROWS+=("$row")

    echo "✨ データ準備完了: @$youtube_handle"
}

# =================================================================
# メイン処理
# =================================================================
if [ $# -eq 0 ]; then
    echo "使い方: ./insert_youtube_streamer.sh handle1 handle2 handle3 ..."
    exit 1
fi

echo "============================="
echo "▶️ 複数Youtuber情報を一括取得"
echo "============================="

for handle in "$@"; do
    echo "-------------------------------------"
    echo "▶️ 処理開始: @$handle"
    echo "-------------------------------------"
    insert_youtube_streamer "$handle"
    echo ""
done

# =================================================================
# まとめて1回だけ DB に INSERT / UPDATE
# =================================================================
if [ ${#INSERT_ROWS[@]} -eq 0 ]; then
    echo "❌ 挿入できるデータがありません"
    exit 1
fi

echo "============================="
echo "▶️ DBへ一括INSERT実行開始"
echo "  件数: ${#INSERT_ROWS[@]}"
echo "============================="

# 1つの INSERT 文にまとめる
VALUES_SQL=$(printf ",\n%s" "${INSERT_ROWS[@]}")
VALUES_SQL=${VALUES_SQL:2}  # 先頭のカンマを削除

FINAL_QUERY="
INSERT INTO streamers (
    name, platform, avatar_url, description, tags,
    follower_count, channel_url, youtube_channel_id,
    twitch_user_id, video_id
) VALUES
${VALUES_SQL}
ON CONFLICT (youtube_channel_id) DO UPDATE SET
    name = EXCLUDED.name,
    avatar_url = EXCLUDED.avatar_url,
    follower_count = EXCLUDED.follower_count,
    channel_url = EXCLUDED.channel_url,
    video_id = EXCLUDED.video_id;
"

# 実行
psql -c "$FINAL_QUERY" -d "$DB_CONN_STRING"

if [ $? -eq 0 ]; then
    echo "✨ 成功: DBに一括挿入/更新完了！"
else
    echo "❌ 失敗: DB挿入エラー"
fi
