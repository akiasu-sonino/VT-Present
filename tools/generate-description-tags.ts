#!/usr/bin/env tsx
/**
 * VTuber/配信者の説明文とタグをAI生成するスクリプト
 * 標準入力からJSONペイロードを受け取り、標準出力にJSON結果を出力
 */

import { OpenAI } from 'openai'

const DEBUG = process.env.DEBUG_GEMINI_GEN === '1'

// ログ出力（常に標準エラーに出力）
function logError(msg: string): void {
  console.error(`[ERROR] ${msg}`)
}

function logInfo(msg: string): void {
  console.error(`[INFO] ${msg}`)
}

function logDebug(msg: string): void {
  if (DEBUG) {
    console.error(`[DEBUG] ${msg}`)
  }
}

interface Payload {
  name: string
  channel_desc: string
  latest_video_title?: string
  latest_video_desc?: string
  video_tags?: string[]
}

interface Result {
  description: string
  tags: string[]
}

// OpenAIクライアント
let client: OpenAI
try {
  logInfo('OpenAIクライアントを初期化中...')
  const apiKey = process.env.OPENAI_API_KEY
  client = new OpenAI({ apiKey })
  logInfo('OpenAIクライアント初期化完了')
} catch (e) {
  logError(`OpenAIクライアント初期化エラー: ${e}`)
  process.exit(1)
}

function buildPrompt(payload: Payload): string {
  return `あなたはVTuber/配信者の紹介文を作る編集者です。
仕様:
- 出力はJSONオブジェクト
- description: 日本語で丁寧語、120字以内
- tags: 配信ジャンル/特徴タグ 最大8件、ひらがな/カタカナ/漢字の単語にする（カンマ不要）
- 個人情報・憶測は書かない。
- 配信者 [配信者名]で検索を行い、その配信者の特徴を表すdescriptionとtagsを生成する。

入力:
配信者名: ${payload.name}
公式説明: ${payload.channel_desc}`.trim()
}

async function generate(payload: Payload): Promise<Result> {
  logInfo('プロンプト生成中...')
  const prompt = buildPrompt(payload)
  logDebug(`prompt:\n${prompt}`)

  // OpenAI API呼び出し
  logInfo('OpenAI APIを呼び出し中...')
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt }
      ]
    })

    const rawText = response.choices[0]?.message?.content?.trim() || ''
    logInfo(`OpenAI APIレスポンス受信完了（${rawText.length} bytes）`)
    logDebug(`raw response:\n${rawText}`)

    let text = rawText

    // ```json ... ``` の囲いを除去
    if (text.startsWith('```')) {
      logInfo('コードブロック囲いを除去中...')
      const match = text.match(/```(?:json)?\s*(.*?)```/s)
      if (match) {
        text = match[1].trim()
        logDebug(`unfenced json:\n${text}`)
      }
    }

    logDebug(`抜き出し後のJSON:\n${text}`)

    // JSONをパース
    logInfo('JSONをパース中...')
    try {
      const data = JSON.parse(text)
      const desc = String(data.description || '').trim().replace(/\n/g, ' ')
      const tags = (data.tags || []).map((t: string) => t.trim()).filter(Boolean)
      logInfo(`JSONパース成功: description=${desc.length}文字, tags=${tags.length}個`)
      return { description: desc, tags }
    } catch (e) {
      logError(`JSONパースエラー: ${e}`)
      logError(`パース対象テキスト: ${text.slice(0, 200)}...`)
      return { description: '', tags: [] }
    }
  } catch (e) {
    logError(`OpenAI API呼び出しエラー: ${e}`)
    return { description: '', tags: [] }
  }
}

async function main() {
  try {
    // 標準入力からペイロードを読み込む
    logInfo('標準入力からペイロードを読み込み中...')

    let inputData = ''
    process.stdin.setEncoding('utf8')

    for await (const chunk of process.stdin) {
      inputData += chunk
    }

    const payload: Payload = JSON.parse(inputData)
    logInfo(`ペイロード読み込み完了: name=${payload.name || 'N/A'}`)

    logInfo('2秒待機中...')
    await new Promise(resolve => setTimeout(resolve, 2000))

    logInfo('AI生成処理開始...')
    const result = await generate(payload)

    logInfo('結果をJSON形式で出力中...')
    console.log(JSON.stringify(result, null, 0))
    logInfo('処理完了')
  } catch (e) {
    if (e instanceof SyntaxError) {
      logError(`標準入力のJSON解析エラー: ${e}`)
    } else {
      logError(`予期しないエラー: ${e}`)
      console.error(e)
    }
    process.exit(1)
  }
}

main()
