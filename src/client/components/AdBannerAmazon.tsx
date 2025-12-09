interface AdBannerAmazonProps {
  url?: string;
  imageSrc?: string;
  alt?: string;
  maxWidth?: string;
  maxHeight?: string;
  cardWidth?: string;
  cardHeight?: string;
}

/**
 * Amazon Affiliates 広告コンポーネント
 *
 * 使用方法:
 * <AdBannerAmazon 
 *   url="https://amzn.to/48r6qld" 
 *   imageSrc="https://m.media-amazon.com/images/I/61Sy-86P2FL._AC_SL1500_.jpg"
 *   alt="Amazon Affiliates"
 *   maxWidth="200px"
 *   maxHeight="200px"
 * />
 */
export function AdBannerAmazon({
  url = 'https://amzn.to/48r6qld',
  imageSrc = 'https://m.media-amazon.com/images/I/61Sy-86P2FL._AC_SL1500_.jpg',
  alt = 'Amazon Affiliates',
  maxWidth: _maxWidth = '200px',
  maxHeight: _maxHeight = '200px',
  cardWidth = '250px',
  cardHeight = 'auto',
}: AdBannerAmazonProps) {
  return (
    <div
      className="ad-banner-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        border: '1px solid #e0e0e0',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        transition: 'box-shadow 0.2s ease',
        width: cardWidth,
        height: cardHeight,
        minHeight: cardHeight === 'auto' ? '280px' : cardHeight,
        boxSizing: 'border-box'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
      }}
    >
      <div style={{
        width: '100%',
        height: '180px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '12px'
      }}>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <img
            src={imageSrc}
            alt={alt}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              display: 'block'
            }}
          />
        </a>
      </div>
      {alt && (
        <p style={{
          margin: '0',
          fontSize: '0.9rem',
          color: '#333',
          textAlign: 'center',
          width: '100%',
          lineHeight: '1.4',
          minHeight: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {alt}
        </p>
      )}
    </div>
  );
}
