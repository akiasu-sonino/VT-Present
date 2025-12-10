import os, sys, json, textwrap, re
import google.generativeai as genai

DEBUG = os.environ.get("DEBUG_GEMINI_GEN") == "1"

genai.configure(api_key=os.environ["GEMINI_API_KEY"])


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
    model = genai.GenerativeModel("gemini-2.5-flash")
    res = model.generate_content(prompt)

    # 生成結果全体をデバッグ出力
    try:
        log_debug(f"raw response: {res}")
        text = (res.text or "").strip()
    except Exception as e:
        log_debug(f"failed to read response text: {e}")
        text = ""

    log_debug(f"response text:\n{text}")

    # ```json ... ``` で囲まれている場合は中身だけを抜き出す
    if text.startswith("```"):
        # 正規表現の \s はそのまま。ダブルバックスラッシュだと文字列 "\s" にマッチしない。
        fenced = re.findall(r"```(?:json)?\s*(.*?)```", text, flags=re.S)
        if fenced:
            text = fenced[0].strip()
            log_debug(f"unfenced json:\n{text}")

    log_debug(f"抜き出し後のJSON:\n{text}")

    # 念のためJSONパース。失敗したらフォールバック。
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
    # stdinからpayload(JSON)を受け取る
    payload = json.load(sys.stdin)
    result = generate(payload)
    json.dump(result, sys.stdout, ensure_ascii=False)
