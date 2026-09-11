/** SVG keeps decorative marks consistent across desktop and mobile emoji fonts. */
export function DecorativeIcon({ arrow = false }: { arrow?: boolean }) {
  return <svg aria-hidden="true" focusable="false" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-0.12em' }}>
    <path d={arrow ? 'M6 18 18 6M6 6h12v12' : 'M12 3v18M3 12h18M5.6 5.6l12.8 12.8M5.6 18.4 18.4 5.6'} />
  </svg>;
}
