import { useEffect, useRef } from 'react';
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
 * document.write()問題を回避するため、iframe内で広告を読み込む
 */
export function AdMaxBanner({
  adId,
  className = '',
  width = 160,
  height = 600
}: AdMaxBannerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!iframeDoc) return;

    // iframeのHTMLを生成
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
        </style>
      </head>
      <body>
        <script src="https://adm.shinobi.jp/s/${adId}"></script>
      </body>
      </html>
    `;

    // iframeにHTMLを書き込む
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();
  }, [adId]);

  return (
    <iframe
      ref={iframeRef}
      className={`admax-banner ${className}`}
      width={width}
      height={height}
      frameBorder="0"
      scrolling="no"
      style={{
        border: 'none',
        display: 'block',
        overflow: 'hidden'
      }}
      title="Advertisement"
    />
  );
}
