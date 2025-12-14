import { useMemo } from 'react';
import '../styles/AdBanner.css';

interface AdMaxBannerProps {
  adId: string; // 忍者AdMaxの広告ID (例: "629a281b9d6e718ee7676471ecea6b17")
  className?: string;
  width?: number;
  height?: number;
}

/**
 * 忍者AdMax バナー広告コンポーネント
 *
 * document.write()問題を回避するため、iframe srcdoc属性を使用
 */
export function AdMaxBanner({
  adId,
  className = '',
  width = 160,
  height = 600
}: AdMaxBannerProps) {
  // iframeのHTMLコンテンツを生成
  const htmlContent = useMemo(() => `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: transparent;
    }
  </style>
</head>
<body>
  <script src="https://adm.shinobi.jp/s/${adId}"></script>
</body>
</html>`, [adId]);

  return (
    <iframe
      className={`admax-banner ${className}`}
      width={width}
      height={height}
      frameBorder="0"
      scrolling="no"
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
      srcDoc={htmlContent}
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
