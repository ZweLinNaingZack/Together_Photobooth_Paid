import { Fragment, type ReactNode } from 'react';

/**
 * Shows translated text that has a little formatting inside it:
 *   *words*          → <em>words</em>  (the italic red words in headings)
 *   **words**        → <strong>words</strong>
 *   [words](#hash)   → a link inside the site
 *   a new line (\n)  → a line break
 * This keeps formatting inside the translation, so each language can put
 * the italic words where they sound right.
 */
export function Rich({ text }: { text: string }) {
  return <>{text.split('\n').map((line, row) => <Fragment key={row}>
    {row > 0 && <br />}
    {inline(line)}
  </Fragment>)}</>;
}

function inline(line: string): ReactNode[] {
  return line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(#[\w/-]*\))/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\((#[\w/-]*)\)$/);
    if (link) return <a key={i} href={link[2]}>{link[1]}</a>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
