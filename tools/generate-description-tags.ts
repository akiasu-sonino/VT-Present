#!/usr/bin/env tsx
/**
 * VTuber/配信者の説明文とタグをAI生成するスクリプト
 * 標準入力(JSON) → 標準出力(JSON)
 */

import { OpenAI } from 'openai'

/* =====================
 * 設定
 * ===================== */
const DEBUG = process.env.DEBUG_GEMINI_GEN === '1'
const MODEL = 'gpt-5-mini'

// 外部レート制御が無い環境向けの安全弁
const RATE_LIMIT_WAIT_MS = Number(process.env.RATE_LIMIT_WAIT_MS ?? 2000)

/* =====================
 * Logger
 * ===================== */
const log = {
  info: (msg: string) => console.error(`[INFO] ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`),
  debug: (msg: string) => DEBUG && console.error(`[DEBUG] ${msg}`)
}

/* =====================
 * 型定義
 * ===================== */
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

/* =====================
 * OpenAI Client
 * ===================== */
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/* =====================
 * Prompt
 * ===================== */
function buildPrompt(payload: Payload): string {
  return `
あなたはVTuber/配信者の「第三者紹介文」を作る編集者です。

制約:
- 本人視点の表現は禁止（「はじめまして」「私は」等NG）
- 出力は **JSONのみ**
- description:
  - 書き出しは必ず「この方は〇〇さんです。」
  - 日本語・丁寧語
  - 120字以内
- tags:
  - 最大8件
  - 単語のみ（ひらがな/カタカナ/漢字）
  - 必ず「VTuber」または「配信者」を含める
- 個人情報・憶測は書かない

入力:
配信者名: ${payload.name}
公式説明: ${payload.channel_desc}

出力フォーマット:
{
  "description": string,
  "tags": string[]
}
`.trim()
}

/* =====================
 * JSON Parse Helper
 * ===================== */
function safeParseJSON(text: string): Result {
  let jsonText = text.trim()

  // ```json``` フェンス除去（保険）
  if (jsonText.startsWith('```')) {
    const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) jsonText = match[1].trim()
  }

  try {
    const data = JSON.parse(jsonText)
    return {
      description: String(data.description || '').replace(/\n/g, ' ').trim(),
      tags: Array.isArray(data.tags)
        ? data.tags.map((t: string) => t.trim()).filter(Boolean)
        : []
    }
  } catch (e) {
    log.error(`JSON parse failed`)
    log.debug(jsonText)
    return { description: '', tags: [] }
  }
}

/* =====================
 * Generate
 * ===================== */
async function generate(payload: Payload): Promise<Result> {
  const prompt = buildPrompt(payload)
  log.debug(`Prompt:\n${prompt}`)

  try {
    const res = await client.responses.create({
      model: MODEL,
      input: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt }
      ]
    })

    const output = res.output_text?.trim() ?? ''
    log.info(`AI response received (${output.length} chars)`)

    return safeParseJSON(output)
  } catch (e) {
    log.error(`OpenAI API error: ${e}`)
    return { description: '', tags: [] }
  }
}

/* =====================
 * Main
 * ===================== */
async function main() {
  try {
    log.info('Reading stdin...')
    let input = ''
    process.stdin.setEncoding('utf8')
    for await (const chunk of process.stdin) input += chunk

    const payload: Payload = JSON.parse(input)
    log.info(`Payload loaded: ${payload.name}`)

    // レート制御（外部で制御できない環境向けの安全弁）
    log.info(`Waiting ${RATE_LIMIT_WAIT_MS}ms for rate limit control...`)
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_WAIT_MS))

    const result = await generate(payload)

    // 常にJSONを返す（失敗時も）
    console.log(JSON.stringify(result))
  } catch (e) {
    log.error(`Fatal error: ${e}`)
    console.log(JSON.stringify({ description: '', tags: [] }))
    process.exit(1)
  }
}

main()
