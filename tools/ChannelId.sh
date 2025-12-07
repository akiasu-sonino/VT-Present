#!/bin/bash

# チャンネルハンドル名が引数として提供されているかチェック
if [ -z "$1" ]; then
    echo "使用方法: $0 <チャンネルハンドル名>"
    echo "例: $0 KonkonAria"
    exit 1
fi

# --- パラメータの定義 ---
# 第1引数 ($1) をチャンネルハンドル名として受け取る
CHANNEL_HANDLE="$1"

# チャンネルハンドル名を使ってターゲットURLを構築
TARGET_URL="https://www.youtube.com/@${CHANNEL_HANDLE}"

# --- ソースコードからチャンネルIDを抽出 ---
# 1. URLのHTMLソースを取得
# 2. 'externalId'パターンで検索し、最初に見つかったチャンネルIDを抽出
CHANNEL_ID=$(curl -s "${TARGET_URL}" | grep -oP '"externalId":"\KUC[a-zA-Z0-9_-]{22}' | head -1)

# もしexternalIdパターンで見つからなかった場合は、channelIdパターンも試す
if [ -z "$CHANNEL_ID" ]; then
    CHANNEL_ID=$(curl -s "${TARGET_URL}" | grep -oP '"channelId":"\KUC[a-zA-Z0-9_-]{22}' | head -1)
fi

# --- 結果の出力 ---
if [ -n "$CHANNEL_ID" ]; then
    echo "${CHANNEL_ID}"
else
    echo "❌ チャンネルIDを特定できませんでした。ハンドル名またはスクリプトのパターンを確認してください。"
fi