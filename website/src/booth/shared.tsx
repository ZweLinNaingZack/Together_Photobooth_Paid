import type { ReactNode } from 'react';
export function Heading({ eyebrow, title, note }: { eyebrow: string; title: ReactNode; note: string }) {
  return <div className="flow-heading"><div className="eyebrow">{eyebrow}</div><h1 tabIndex={-1}>{title}</h1><p>{note}</p></div>;
}
