UPDATE streamers s
SET tags = (
  SELECT array_agg(DISTINCT cleaned_tag)
  FROM (
    SELECT
      -- ① 正規化テーブルに存在する ⇒ 替える
      CASE
        WHEN tn.normalized_tag IS NOT NULL THEN tn.normalized_tag

        -- ② 正規化テーブルに「削除指定 (normalized_tag = NULL)」がある ⇒ NULL で消す
        WHEN tn.alias IS NOT NULL AND tn.normalized_tag IS NULL THEN NULL

        -- ③ 正規化テーブルに存在しない ⇒ 絶対に残す
        ELSE t.tag
      END AS cleaned_tag
    FROM unnest(s.tags) AS t(tag)
    LEFT JOIN tag_normalization tn
      ON tn.alias = t.tag
  ) sub
  WHERE cleaned_tag IS NOT NULL   -- ② のタグだけ削除
)
WHERE s.tags IS NOT NULL;