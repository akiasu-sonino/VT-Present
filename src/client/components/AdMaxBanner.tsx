import '../styles/AdBanner.css';

interface AdMaxBannerProps {
  adId?: string; // 使用しないが互換性のために残す
  className?: string;
  width?: number;
  height?: number;
}

/**
 * 忍者AdMax バナー広告コンポーネント
 *
 * 対策②：iframeで広告を隔離（最も安全・本番向けベストプラクティス）
 * - parser-blocking 回避
 * - document.domain 無関係
 * - 本番安定
 */
export function AdMaxBanner({
  className = '',
  width = 160,
  height = 600
}: AdMaxBannerProps) {
  return (
    <iframe
      src="/ads/shinobi.html"
      className={`admax-banner ${className}`}
      width={width}
      height={height}
      frameBorder="0"
      scrolling="no"
      loading="lazy"
      style={{
        border: 'none',
        display: 'block',
        overflow: 'hidden',
        background: 'transparent'
      }}
      title="Advertisement"
    />
  );
}
