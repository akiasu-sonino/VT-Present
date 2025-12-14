import { useEffect, useRef } from 'react';
import '../styles/AdBannerAdmax.css';

/**
 * アドマックス（Admax）サイドバナー広告コンポーネント
 * 画面の左端に固定表示される
 *
 * 参考: https://adm.shinobi.jp/
 */
export function AdBannerAdmax() {
  const scriptAddedRef = useRef(false);

  useEffect(() => {
    // 既に追加済みの場合はスキップ
    if (scriptAddedRef.current) {
      console.log('[Admax] Script already added');
      return;
    }

    console.log('[Admax] Adding script to document.body');

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

    // document.bodyに追加（記事の推奨方法）
    document.body.appendChild(s);
    console.log('[Admax] Script appended to document.body');

    // クリーンアップ
    return () => {
      if (s.parentNode) {
        s.parentNode.removeChild(s);
        scriptAddedRef.current = false;
        console.log('[Admax] Script removed from document.body');
      }
    };
  }, []);

  return (
    <div className="admax-sidebar-container">
      <div className="admax-sidebar-content">
        {/* 広告がここに表示されます */}
      </div>
    </div>
  );
}
