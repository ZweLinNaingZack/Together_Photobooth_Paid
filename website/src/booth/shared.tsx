import type { ReactNode } from 'react';
// `title` is optional. Without one, the h1 is still there but hidden (sr-only):
// screen readers still announce the step, and Booth.tsx can still focus the h1 when the step changes.
export function Heading({ eyebrow, title, note }: { eyebrow: string; title?: ReactNode; note: string }) {
  return <div className="flow-heading"><div className="eyebrow">{eyebrow}</div>
    {title ? <h1 tabIndex={-1}>{title}</h1> : <h1 tabIndex={-1} className="sr-only">{eyebrow}</h1>}
    <p>{note}</p></div>;
}
