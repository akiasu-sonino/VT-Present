import { useEffect, useRef } from 'react';
import '../styles/AdBannerAdmax.css';

/**
 * アドマックス（Admax）サイドバナー広告コンポーネント
 * 画面の左端に固定表示される
 *
 * 参考: https://adm.shinobi.jp/
 */
export function AdBannerAdmax() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptAddedRef = useRef(false);

  useEffect(() => {
    // 既に追加済みの場合はスキップ
    if (scriptAddedRef.current) {
      return;
    }

    const s = document.createElement('script');
    s.src = 'https://adm.shinobi.jp/s/629a281b9d6e718ee7676471ecea6b17';
    s.async = true;

    s.onload = () => {
      console.log('[Admax] Script loaded successfully');
      scriptAddedRef.current = true;
    };

    s.onerror = () => {
      console.error('[Admax] Failed to load script');
    };

    // コンテナ内に追加する方法を試す
    if (containerRef.current) {
      containerRef.current.appendChild(s);
      console.log('[Admax] Script appended to container');
    }

    // クリーンアップ
    return () => {
      if (s.parentNode) {
        s.parentNode.removeChild(s);
        scriptAddedRef.current = false;
      }
    };
  }, []);

  return (
    <div className="admax-sidebar-container">
      <div ref={containerRef} className="admax-sidebar-content">
        {/* 広告がここに表示されます */}
      </div>
    </div>
  );
}
