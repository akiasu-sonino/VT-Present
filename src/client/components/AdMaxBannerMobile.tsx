import '../styles/AdBanner.css';

interface AdMaxBannerMobileProps {
  className?: string;
  width?: number;
  height?: number;
}

/**
 * 忍者AdMax バナー広告コンポーネント（スマホ用）
 *
 * スマホ向けのサイズに最適化された広告を表示
 */
export function AdMaxBannerMobile({
  className = '',
  width = 320,
  height = 100
}: AdMaxBannerMobileProps) {
  return (
    <iframe
      src="/ads/shinobi-mobile.html"
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
