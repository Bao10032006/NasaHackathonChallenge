import './brand-mark.css'

/**
 * Animated Hỏa Lịch mark: a calendar tile ("lịch") holding a layered flame ("hỏa").
 * The flame tongues flicker, a soft glow breathes and a few embers rise. Decorative only
 * (aria-hidden); animation stops under prefers-reduced-motion (see brand-mark.css).
 */
export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40" width="40" height="40" focusable="false">
        <defs>
          <linearGradient id="bm-tile" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1a2234" />
            <stop offset="1" stopColor="#0b101c" />
          </linearGradient>
          <radialGradient id="bm-glow" cx="50%" cy="68%" r="50%">
            <stop offset="0" stopColor="#ff8a2a" stopOpacity=".75" />
            <stop offset=".55" stopColor="#ff4d1a" stopOpacity=".22" />
            <stop offset="1" stopColor="#ff4d1a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="bm-outer" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ff3b1f" />
            <stop offset="1" stopColor="#ff7a2a" />
          </linearGradient>
          <linearGradient id="bm-middle" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ff6a1a" />
            <stop offset="1" stopColor="#ffb020" />
          </linearGradient>
          <linearGradient id="bm-inner" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ffd25a" />
            <stop offset="1" stopColor="#fff3c4" />
          </linearGradient>
        </defs>
        <rect className="bm-tile" x="3" y="5" width="34" height="32" rx="8" fill="url(#bm-tile)" />
        <path className="bm-band" d="M3 13 V12.5 A7.5 7.5 0 0 1 10.5 5 H29.5 A7.5 7.5 0 0 1 37 12.5 V13 Z" />
        <rect className="bm-ring" x="11.5" y="2.5" width="3" height="6" rx="1.5" />
        <rect className="bm-ring" x="25.5" y="2.5" width="3" height="6" rx="1.5" />
        <circle className="bm-glow" cx="20" cy="27" r="13" fill="url(#bm-glow)" />
        <g className="bm-flame">
          <path className="bm-tongue bm-outer" fill="url(#bm-outer)"
            d="M20 13.5c3.6 4.1 6.8 7.2 6.8 11.4 0 4.3-3 7.6-6.8 7.6s-6.8-3.3-6.8-7.6c0-2.6 1.3-4.6 2.7-6.3.2 2 1.1 3.2 2.2 3.6-.4-3.2.3-5.9 1.9-8.7z" />
          <path className="bm-tongue bm-middle" fill="url(#bm-middle)"
            d="M20 18.5c2.3 2.7 4.4 4.8 4.4 7.6 0 2.9-2 5.1-4.4 5.1s-4.4-2.2-4.4-5.1c0-1.6.8-2.9 1.7-4 .2 1.2.7 1.9 1.4 2.2-.2-2 .2-3.9 1.3-5.8z" />
          <path className="bm-tongue bm-inner" fill="url(#bm-inner)"
            d="M20 23.2c1.3 1.5 2.4 2.7 2.4 4.2 0 1.6-1.1 2.8-2.4 2.8s-2.4-1.2-2.4-2.8c0-1.5 1.1-2.7 2.4-4.2z" />
        </g>
        <circle className="bm-spark bm-s1" cx="17" cy="19" r=".9" />
        <circle className="bm-spark bm-s2" cx="23" cy="17" r=".7" />
        <circle className="bm-spark bm-s3" cx="20.5" cy="15" r=".6" />
      </svg>
    </span>
  )
}
