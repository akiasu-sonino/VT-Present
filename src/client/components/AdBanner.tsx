import { useEffect } from 'react';
import '../styles/AdBanner.css';

interface AdBannerProps {
  adClient?: string; // Google AdSense クライアントID (例: "ca-pub-XXXXXXXXXXXXXXXX")
  adSlot?: string;   // 広告スロットID
  adFormat?: 'auto' | 'rectangle' | 'vertical' | 'horizontal';
  fullWidth?: boolean;
}

/**
 * Google AdSense バナー広告コンポーネント
 *
 * 使用方法:
 * 1. Google AdSenseアカウントから広告コードを取得
 * 2. adClient と adSlot に適切な値を設定
 * 3. ヘッダー下などに配置
 */
export function AdBanner({
  adClient,
  adSlot,
  adFormat = 'auto',
  fullWidth = true
}: AdBannerProps) {
  useEffect(() => {
    // AdSense スクリプトが存在しない場合は読み込む
    if (adClient && !window.adsbygoogle) {
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
      script.setAttribute('data-ad-client', adClient);
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }

    // 広告を表示
    if (adClient && adSlot) {
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      } catch (e) {
        console.error('AdSense error:', e);
      }
    }
  }, [adClient, adSlot]);

  // AdSense が設定されていない場合はプレースホルダーを表示
  if (!adClient || !adSlot) {
    return (
      <div className="ad-banner-container">
        <div className="ad-banner-placeholder">
          <div className="ad-banner-placeholder-content">
            <p className="ad-banner-placeholder-title">広告スペース</p>
            <p className="ad-banner-placeholder-text">
              Google AdSenseを設定すると、ここに広告が表示されます
            </p>
            <p className="ad-banner-placeholder-hint">
              AdBannerコンポーネントにadClientとadSlotを設定してください
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ad-banner-container">
      <ins
        className="adsbygoogle ad-banner"
        style={{ display: 'block' }}
        data-ad-client={adClient}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidth.toString()}
      />
    </div>
  );
}

// TypeScript用のwindow拡張
declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}
