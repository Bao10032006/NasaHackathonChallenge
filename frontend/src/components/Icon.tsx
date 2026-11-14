import type { SVGProps } from 'react'

/** One consistent 24×24 stroke icon set (replaces structural emoji). Decorative by default. */
const PATHS = {
  flame: 'M12 3c.5 3-2.5 4.5-2.5 7.5a2.5 2.5 0 0 0 5 0c0-1-.4-1.8-.9-2.5 2.4.9 4.4 3.3 4.4 6.2A6 6 0 0 1 6 14.2C6 9.6 10 7.4 12 3Z',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-11v6m0-9.5v.5',
  select: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4',
  close: 'M6 6l12 12M18 6 6 18',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8L12 3.5Z',
  filter: 'M4 5h16l-6 7.5V19l-4 1.5v-8L4 5Z',
  chevronDown: 'M6 9l6 6 6-6',
  layers: 'M12 3 2.5 8 12 13l9.5-5L12 3ZM2.5 13 12 18l9.5-5',
  table: 'M4 5h16v14H4V5Zm0 5h16M10 5v14',
  alert: 'M12 3 2 20h20L12 3Zm0 6v5m0 3v.5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 18, title, ...rest }: { name: IconName; size?: number; title?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      className="icon"
      {...rest}
    >
      {title && <title>{title}</title>}
      <path d={PATHS[name]} fill={name === 'star' || name === 'flame' ? 'currentColor' : 'none'} />
    </svg>
  )
}
