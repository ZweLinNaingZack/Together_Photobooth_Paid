import { useEffect, useRef } from 'react';

/** Record same-URL wizard screens so browser Back visits the previous screen. */
export function useStepHistory<T extends string>(key: string, active: boolean, step: T, request: (target: T, commit: () => void) => void, apply: (target: T) => void) {
  const latest = useRef({step, request, apply}); latest.current = {step, request, apply};
  const recorded = useRef<string | null>(null);
  const transition = useRef<null | { target: T; phase: 'restore' | 'commit'; delta: number }>(null);
  useEffect(() => {
    if (!active) { recorded.current = null; return; }
    const tag = `${key}:${Date.now()}:${Math.random()}`;
    let index = 0;
    history.replaceState({...history.state, wizard: {tag, step: latest.current.step, index}}, '');
    recorded.current = latest.current.step;
    function pop() {
      const entry = history.state?.wizard;
      const pending = transition.current;
      if (pending?.phase === 'restore') {
        transition.current = null;
        latest.current.request(pending.target, () => {
          transition.current = {...pending, phase:'commit'};
          history.go(pending.delta);
        });
        return;
      }
      if (pending?.phase === 'commit') {
        transition.current = null; index = entry.index;
        recorded.current = pending.target; latest.current.apply(pending.target); return;
      }
      if (entry?.tag !== tag || entry.step === latest.current.step) return;
      const delta = entry.index - index;
      if (!delta) return;
      transition.current = {target:entry.step, phase:'restore', delta};
      history.go(-delta);
    }
    window.addEventListener('popstate', pop);
    const record = () => {
      index++;
      history.pushState({...history.state, wizard:{tag, step:latest.current.step, index}}, '');
    };
    recorder.current = record;
    return () => { window.removeEventListener('popstate', pop); transition.current=null; recorder.current=null; };
  }, [active, key]);
  const recorder = useRef<null | (() => void)>(null);
  useEffect(() => {
    if (active && recorded.current !== step) { recorder.current?.(); recorded.current=step; }
  }, [active, step]);
}
