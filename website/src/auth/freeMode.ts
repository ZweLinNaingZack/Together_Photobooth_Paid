import { useEffect, useState } from 'react';
import { supabase } from './client';

// ---------------------------------------------------------------------------
// Free mode (promotion): is the booth free right now, and until when?
//
// The switch lives in the database (021-free-mode.sql), so the website and the
// charging rules can never disagree. We ask once per page load and share the answer.
// If the question fails (offline, or 021 not run yet) we assume NOT free, which
// simply shows the normal paid wording; the database still decides what's charged.
// ---------------------------------------------------------------------------
export interface FreeMode { free: boolean; until: string | null }

const notFree: FreeMode = { free: false, until: null };
let request: Promise<FreeMode> | null = null;
let known: FreeMode | null = null;

export function loadFreeMode(): Promise<FreeMode> {
  request ??= (async () => {
    try {
      if (!supabase) return notFree;
      const { data, error } = await supabase.rpc('together_free_mode');
      if (error || !data) return notFree;
      return { free: data.free === true, until: typeof data.until === 'string' ? data.until : null };
    } catch { return notFree; }
  })().then(value => (known = value));
  return request;
}

/** Use inside components. Starts as "not free" until the answer arrives (a split second). */
export function useFreeMode(): FreeMode {
  const [mode, setMode] = useState<FreeMode>(known ?? notFree);
  useEffect(() => { let alive = true; void loadFreeMode().then(value => { if (alive) setMode(value); }); return () => { alive = false; }; }, []);
  return mode;
}
