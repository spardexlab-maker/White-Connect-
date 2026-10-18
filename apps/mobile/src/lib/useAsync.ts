import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncState<T> =
  | { status: 'loading'; data?: T; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data?: T; error: unknown };

/** Small data loader: loading / success / error with reload; keeps last data while reloading. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const counter = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const load = useCallback(() => {
    const id = ++counter.current;
    setState((s) => ({ status: 'loading', data: s.data }));
    run().then(
      (data) => { if (id === counter.current) setState({ status: 'success', data }); },
      (error) => { if (id === counter.current) setState((s) => ({ status: 'error', error, data: s.data })); },
    );
  }, [run]);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

/** Throws Supabase errors so useAsync can surface them. */
export async function unwrap<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}
