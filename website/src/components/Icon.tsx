import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// One small icon set for the whole site, so every icon has the same line style
// (24×24 grid, rounded 1.75px strokes). Shapes follow the open-source Lucide
// icons (ISC licence). Using SVG instead of text characters like ♡ or → means the
// icons look the same on every phone and can be coloured with CSS.
//
// Usage: <Icon name="camera" />            → decorative (hidden from screen readers)
//        <Icon name="phone" label="Call" /> → meaningful on its own (read aloud)
// ---------------------------------------------------------------------------
const paths = {
  heart: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 0 0-16 0" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  camera: <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" /></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5" /><path d="M12 3v12" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  sparkles: <><path d="M12 3 10.1 8.8a2 2 0 0 1-1.29 1.29L3 12l5.8 1.9a2 2 0 0 1 1.29 1.29L12 21l1.9-5.8a2 2 0 0 1 1.29-1.29L21 12l-5.8-1.9a2 2 0 0 1-1.29-1.29Z" /><path d="M20 3v4M22 5h-4" /></>,
  layout: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
  arrowRight: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  arrowLeft: <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>,
  arrowUpRight: <><path d="M7 17 17 7" /><path d="M7 7h10v10" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  expand: <><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></>,
  reset: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></>,
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" /></>,
  plus: <><path d="M5 12h14" /><path d="M12 5v14" /></>,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  help: <><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></>,
  phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>,
  music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  facebook: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  shield: <><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, label, className }: { name: IconName; size?: number; label?: string; className?: string }) {
  return <svg className={`icon${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" focusable="false"
    {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>{paths[name]}</svg>;
}
