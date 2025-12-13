# RSS + Videos API ライブ配信検証ツール

## 概要

YouTubeのRSSフィード + videos:list APIでライブ配信を検出できるか検証するスクリプトです。

## 前提条件

1. **YOUTUBE_API_KEY** 環境変数が設定されている
2. **.env** ファイルまたは環境変数でAPIキーを設定

```bash
# .env に追加
YOUTUBE_API_KEY=your_api_key_here
```

## スクリプト一覧

### 1. `test-rss-live-detection.ts`

特定のチャンネルIDを指定してライブ配信を検出します。

#### 使い方

```bash
# 単一チャンネル
npm run test:rss-live UCxxxxxxxxxxxxxxxxxxxxxx

# 複数チャンネル
npm run test:rss-live UCxxxxxxxx UCyyyyyyyy UCzzzzzzzz
```

または直接実行：

```bash
tsx tools/test-rss-live-detection.ts UCxxxxxxxxxxxxxxxxxxxxxx
```

#### 出力例

```
🔍 YouTube Live Stream Detection Test
============================================================
Testing 1 channel(s)

============================================================
📺 Channel: UCxxxxxxxxxxxxxxxxxxxxxx
============================================================

[RSS] Fetching: https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxxxx
✅ Found 3 videos in RSS:
   1. videoId1
   2. videoId2
   3. videoId3

[YouTube API] Fetching video details for 3 videos

📊 Results:
------------------------------------------------------------

🎬 Video: ライブ配信タイトル
   ID: videoId1
   Channel: UCxxxxxxxxxxxxxxxxxxxxxx
   🔴 LIVE STATUS: Currently streaming!
   👥 Viewers: 1,234
   🕐 Started: 2025-12-14T12:00:00Z

✅ Live stream detected for channel UCxxxxxxxxxxxxxxxxxxxxxx!
```

---

### 2. `test-rss-all-channels.ts`

データベース内のすべてのチャンネルを一括検証します。

#### 使い方

```bash
npm run test:rss-all
```

または直接実行：

```bash
tsx tools/test-rss-all-channels.ts
```

#### 出力例

```
🔍 Testing RSS + videos:list for all channels in DB
============================================================
📊 Found 200 channels in database

📡 Fetching RSS feeds...
✅ Fetched RSS for 198/200 channels
📹 Total videos to check: 594
💰 Estimated API cost: 12 units

🔎 Checking live streaming status...

============================================================
📊 RESULTS
============================================================

🔴 Currently Live: 3 channel(s)

Live Streams:

1. ホロライブ公式
   Channel ID: UCxxxxxxxx
   Video: 【重大発表】新メンバー加入！
   Video ID: videoId1
   👥 Viewers: 25,678
   🕐 Started: 2025-12-14T10:00:00Z

2. にじさんじ公式
   Channel ID: UCyyyyyyyy
   Video: 【歌枠】みんなで歌おう
   Video ID: videoId2
   👥 Viewers: 12,345
   🕐 Started: 2025-12-14T11:30:00Z

3. 個人Vtuber
   Channel ID: UCzzzzzzzz
   Video: 雑談配信
   Video ID: videoId3
   👥 Viewers: 456
   🕐 Started: 2025-12-14T12:15:00Z

⚪ Not Live: 197 channel(s)

============================================================
✅ Test completed
📊 Summary:
   - Total channels: 200
   - RSS fetched: 198
   - Videos checked: 594
   - Live streams found: 3
   - API units used: ~12
```

---

## 仕組み

### フロー

1. **RSSフィードから最新動画を取得**（無料）
   - `https://www.youtube.com/feeds/videos.xml?channel_id=XXX`
   - 最新3件の動画IDを抽出

2. **videos:list APIでライブ配信状態を確認**（1 unit/50動画）
   - `part=snippet,liveStreamingDetails`
   - `liveStreamingDetails.actualEndTime === null` なら配信中

3. **結果を表示**
   - ライブ配信中のチャンネルとその詳細
   - 視聴者数、開始時刻など

### コスト

- **RSS取得**: 0 units（無料）
- **videos:list**: 1 unit / 50動画

**例: 200チャンネルの場合**
- RSS: 200チャンネル × 3動画 = 600動画
- API: 600動画 ÷ 50 = **12 units**

---

## トラブルシューティング

### API Key エラー

```
❌ YOUTUBE_API_KEY environment variable is not set
```

→ `.env` ファイルに `YOUTUBE_API_KEY` を設定してください

### RSS取得エラー

```
❌ RSS fetch failed: 404 Not Found
```

→ チャンネルIDが正しいか確認してください

### データベース接続エラー

```
❌ Error: Connection to database failed
```

→ `POSTGRES_URL` などのDB環境変数が設定されているか確認してください

---

## テスト用のチャンネルID例

現在ライブ配信中のチャンネルを探すには、YouTubeで「ライブ配信中」を検索し、チャンネルIDを取得してください。

チャンネルIDの取得方法：
1. YouTubeチャンネルページを開く
2. URLから `UC` で始まる24文字のIDをコピー
   - 例: `https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx`

---

## 参考

- YouTube RSS Feed: https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
- YouTube Data API v3: https://developers.google.com/youtube/v3/docs/videos/list
