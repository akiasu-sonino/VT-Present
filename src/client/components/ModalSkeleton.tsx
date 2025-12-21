import '../styles/Skeleton.css'

export function VideoSkeleton() {
  return (
    <div className="video-container">
      <div className="skeleton skeleton-video" />
    </div>
  )
}

interface CommentSkeletonProps {
  count?: number
}

export function CommentSkeleton({ count = 3 }: CommentSkeletonProps) {
  const skeletons = Array.from({ length: count }, (_, i) => (
    <div key={i} className="skeleton-comment">
      <div className="skeleton-comment-header">
        <div className="skeleton skeleton-avatar" />
        <div className="skeleton skeleton-author" />
        <div className="skeleton skeleton-date" />
      </div>
      <div className="skeleton skeleton-comment-body" />
      <div className="skeleton skeleton-comment-body" />
    </div>
  ))

  return <>{skeletons}</>
}
