import { useEffect, useRef } from 'react';
import '../styles/AdBannerAdmax.css';

/**
 * アドマックス（Admax）サイドバナー広告コンポーネント
 * 画面の左端に固定表示される
 */
export function AdBannerAdmax() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    // 既に読み込み済みの場合はスキップ
    if (scriptLoadedRef.current) {
      console.log('Admax script already loaded');
      return;
    }

    console.log('Loading Admax script...');

    // アドマックススクリプトを動的に読み込む
    const script = document.createElement('script');
    script.src = 'https://adm.shinobi.jp/s/629a281b9d6e718ee7676471ecea6b17';
    script.async = true;

    script.onload = () => {
      console.log('Admax script loaded successfully');
      scriptLoadedRef.current = true;
    };

    script.onerror = () => {
      console.error('Failed to load Admax script');
    };

    // スクリプトをコンテナに追加
    if (containerRef.current) {
      containerRef.current.appendChild(script);
      console.log('Admax script appended to container');
    }

    // クリーンアップ
    return () => {
      if (containerRef.current && script.parentNode === containerRef.current) {
        containerRef.current.removeChild(script);
        scriptLoadedRef.current = false;
        console.log('Admax script removed from container');
      }
    };
  }, []);

  return (
    <div className="admax-sidebar-container">
      <div ref={containerRef} className="admax-sidebar-content">
        {/* アドマックススクリプトがここに挿入されます */}
      </div>
    </div>
  );
}
