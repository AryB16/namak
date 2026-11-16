import type { SVGProps } from 'react'

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...p,
})

export const IconTomorrow = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 6v3M5.6 9.6l1.8 1.8M18.4 9.6l-1.8 1.8" />
  </svg>
)
export const IconCompare = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3v18M5 8l-2 6h6L7 8M19 8l-2 6h6l-2-6M5 8h14" />
  </svg>
)
export const IconReplay = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 19l5-6 4 3 5-7 4 4M3 5v14h18" />
  </svg>
)
export const IconWorker = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
    <path d="M10 6.5h4M9.5 13.5c1-1.5 1.5-1.5 2.5 0s1.5 1.5 2.5 0" />
  </svg>
)
export const IconFarm = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 21V11M12 11c-3-4-7-3-8-1 3 0 5 .5 8 1zM12 11c3-4 7-3 8-1-3 0-5 .5-8 1zM12 11c-1-4 0-7 0-8 1 1 2 4 0 8zM5 21h14" />
  </svg>
)
export const IconInfo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
)
export const IconDrop = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3c-3.5 5-6 8-6 11a6 6 0 0 0 12 0c0-3-2.5-6-6-11z" />
  </svg>
)
export const IconPlay = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M8 5.5v13l11-6.5z" />
  </svg>
)
export const IconPause = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
  </svg>
)
export const IconCamera = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
)
export const IconSend = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 12l16-8-6 16-2.5-6.5z" />
  </svg>
)
