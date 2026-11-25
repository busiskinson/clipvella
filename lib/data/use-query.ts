"use client";

import { useEffect, useState } from "react";
import { useDataVersion } from "@/stores/data-store";

export interface QueryState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/** Minimal fetch-on-mount hook that refetches whenever data is invalidated. */
export function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[] = []): QueryState<T> {
  const version = useDataVersion((s) => s.version);
  const [state, setState] = useState<QueryState<T>>({ data: null, error: null, loading: true });

  useEffect(() => {
    let alive = true;
    fetcher()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((e: unknown) => alive && setState((s) => ({ data: s.data, error: e instanceof Error ? e.message : String(e), loading: false })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the fetcher is identified by `deps`
  }, [version, ...deps]);

  return state;
}
