import { useEffect } from 'react';
import '../styles/AdBannerAdmax.css';

/**
 * アドマックス（Admax）サイドバナー広告コンポーネント
 * 画面の左端に固定表示される
 */
export function AdBannerAdmax() {
  useEffect(() => {
    // アドマックススクリプトを動的に読み込む
    const script = document.createElement('script');
    script.src = 'https://adm.shinobi.jp/s/629a281b9d6e718ee7676471ecea6b17';
    script.async = true;

    // スクリプトを既存の広告コンテナに追加
    const container = document.getElementById('admax-sidebar');
    if (container) {
      container.appendChild(script);
    }

    // クリーンアップ
    return () => {
      if (container && script.parentNode === container) {
        container.removeChild(script);
      }
    };
  }, []);

  return (
    <div className="admax-sidebar-container">
      <div id="admax-sidebar" className="admax-sidebar-content">
        {/* アドマックススクリプトがここに挿入されます */}
      </div>
    </div>
  );
}
