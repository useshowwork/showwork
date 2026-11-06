type Props = { tone?: 'dark' | 'white'; mark?: boolean; width?: number; className?: string };

/** Official Showwork artwork, shared across authentication, marketing and product pages. */
export default function ShowworkLogo({ tone = 'dark', mark = false, width = mark ? 24 : 104, className }: Props) {
  return <img
    src={mark ? '/images/logo/icon.svg' : tone === 'white' ? '/images/logo/swwhite.svg' : '/images/logo/sw.svg'}
    alt="Showwork"
    width={width}
    height={mark ? width : Math.round(width * 72.39 / 443.45)}
    className={className}
    style={{ display: 'block', width, height: 'auto', maxWidth: '100%', ...(mark && tone === 'white' ? { filter: 'brightness(0) invert(1)' } : {}) }}
  />;
}
