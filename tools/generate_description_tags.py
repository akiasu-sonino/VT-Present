import os, sys, json, textwrap, re
import time
from openai import OpenAI

DEBUG = os.environ.get("DEBUG_GEMINI_GEN") == "1"

# OpenAIクライアント
client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])


def log_debug(msg: str):
    if DEBUG:
        print(f"[debug] {msg}", file=sys.stderr)


def build_prompt(payload: dict) -> str:
    # 入力: name, channel_desc, latest_video_title, latest_video_desc, video_tags(list)
    return textwrap.dedent(
        f"""
    あなたはVTuber/配信者の紹介文を作る編集者です。
    仕様:
    - 出力はJSONオブジェクト
    - description: 日本語で丁寧語、120字以内
    - tags: 配信ジャンル/特徴タグ 最大8件、ひらがな/カタカナ/漢字の単語にする（カンマ不要）
    - 個人情報・憶測は書かない。
    - 配信者 [配信者名]で検索を行い、その配信者の特徴を表すdescriptionとtagsを生成する。

    入力:
    配信者名: {payload.get("name","")}
    公式説明: {payload.get("channel_desc","")}
    """
    ).strip()


def generate(payload: dict):
    prompt = build_prompt(payload)
    log_debug(f"prompt:\n{prompt}")

    # ---- OpenAI API呼び出し ----
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # 無料で使える軽量モデル、必要なら変更可
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt},
            ],
        )
        raw_text = response.choices[0].message.content.strip()
        log_debug(f"raw response:\n{raw_text}")
    except Exception as e:
        log_debug(f"OpenAI API error: {e}")
        return {"description": "", "tags": []}

    text = raw_text

    # ```json ... ``` の囲いを除去
    if text.startswith("```"):
        fenced = re.findall(r"```(?:json)?\s*(.*?)```", text, flags=re.S)
        if fenced:
            text = fenced[0].strip()
            log_debug(f"unfenced json:\n{text}")

    log_debug(f"抜き出し後のJSON:\n{text}")

    # JSONをパース
    try:
        data = json.loads(text)
        desc = str(data.get("description", "")).strip().replace("\n", " ")
        tags = [t.strip() for t in data.get("tags") or [] if t.strip()]
    except Exception as e:
        log_debug(f"json parse error: {e}")
        desc = ""
        tags = []

    return {"description": desc, "tags": tags}


if __name__ == "__main__":
    # stdin から payload(JSON) を受け取る
    payload = json.load(sys.stdin)
    time.sleep(2)  # 必要ならウェイト。Geminiほど厳しくないので短くした
    result = generate(payload)
    json.dump(result, sys.stdout, ensure_ascii=False)
