import '../styles/Skeleton.css'

interface StreamerCardSkeletonProps {
  count?: number
}

function StreamerCardSkeleton({ count = 1 }: StreamerCardSkeletonProps) {
  const skeletons = Array.from({ length: count }, (_, i) => (
    <div key={i} className="skeleton-card">
      {/* 画像エリア */}
      <div className="skeleton-image" />

      {/* コンテンツエリア */}
      <div className="skeleton-content">
        {/* タイトル */}
        <div className="skeleton skeleton-title" />

        {/* 説明文 */}
        <div className="skeleton skeleton-description" />
        <div className="skeleton skeleton-description" />

        {/* バッジ */}
        <div className="skeleton-badges">
          <div className="skeleton skeleton-badge" />
          <div className="skeleton skeleton-badge" />
        </div>

        {/* タグ */}
        <div className="skeleton-tags">
          <div className="skeleton skeleton-tag" />
          <div className="skeleton skeleton-tag" />
          <div className="skeleton skeleton-tag" />
        </div>

        {/* フォロワー数 */}
        <div className="skeleton skeleton-followers" />
      </div>

      {/* アクションボタン */}
      <div className="skeleton-actions">
        <div className="skeleton skeleton-button" />
        <div className="skeleton skeleton-button" />
      </div>
    </div>
  ))

  if (count === 1) {
    return skeletons[0]
  }

  return <>{skeletons}</>
}

export default StreamerCardSkeleton
