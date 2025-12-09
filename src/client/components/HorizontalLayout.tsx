import { ReactNode, CSSProperties } from 'react';

interface HorizontalLayoutItem {
    content: ReactNode;
    width?: string; // 例: '50%', '33.33%', 'auto', '1fr' など
}

interface HorizontalLayoutProps {
    items: HorizontalLayoutItem[];
    className?: string;
    containerClassName?: string;
    rowClassName?: string;
    gap?: string;
    containerStyle?: CSSProperties;
}

/**
 * 横並びレイアウトコンポーネント
 *
 * 使用方法:
 * <HorizontalLayout
 *   items={[
 *     { content: <AdBannerAmazon ... />, width: '41.66%' }, // col-5相当
 *     { content: <AdBannerAmazon ... />, width: '33.33%' }  // col-4相当
 *   ]}
 *   containerClassName="mt-4"
 *   gap="1rem"
 * />
 */
export function HorizontalLayout({
    items,
    className = '',
    containerClassName = '',
    rowClassName = '',
    gap = '2rem',
    containerStyle
}: HorizontalLayoutProps) {
    const rowStyle: CSSProperties = {
        display: 'flex',
        flexWrap: 'wrap',
        gap,
        ...(containerStyle || {})
    };

    const containerStyleObj: CSSProperties = {
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 0px',
        ...containerStyle
    };

    return (
        <div className={containerClassName} style={containerStyleObj}>
            <div className={rowClassName} style={rowStyle}>
                {items.map((item, index) => {
                    const itemStyle: CSSProperties = {
                        flex: item.width ? '0 0 auto' : '1 1 auto',
                        width: item.width || 'auto',
                        padding: '0 0.5rem'
                    };

                    return (
                        <div key={index} style={itemStyle}>
                            <div className={className}>{item.content}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

