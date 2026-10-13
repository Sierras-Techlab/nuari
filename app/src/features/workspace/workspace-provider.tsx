"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { createLocalWorkspaceSource } from "./local-source";
import type { WorkspaceSource } from "./types";
import { useAccess } from "@/features/access/access-provider";
import { guardWorkspaceSource } from "@/features/access/guarded-sources";
import { ApiError } from "@/lib/api/errors";

const WorkspaceContext = createContext<WorkspaceSource | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { preflight } = useAccess();
  const gate = useRef(preflight);
  const mounted = useRef(false);
  useEffect(() => { gate.current = preflight; }, [preflight]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const ensureActive = useCallback(async () => {
    await gate.current();
    if (!mounted.current) throw new ApiError(0, "CONTEXT_CHANGED", "El espacio de trabajo cambió.");
  }, []);
  const [source, setSource] = useState<WorkspaceSource | null>(null);
  useEffect(() => {
    let active = true;
    const guarded = guardWorkspaceSource(createLocalWorkspaceSource(), ensureActive);
    queueMicrotask(() => { if (active) setSource(guarded); });
    return () => { active = false; };
  }, [ensureActive]);
  return source ? <WorkspaceContext.Provider value={source}>{children}</WorkspaceContext.Provider> : null;
}

export function useWorkspaceSource(): WorkspaceSource | null {
  return useContext(WorkspaceContext);
}

export function useWorkspaceDataSource(): WorkspaceSource {
  const shared = useWorkspaceSource();
  if (!shared) throw new Error("Authorized WorkspaceProvider is required.");
  return shared;
}

export function useWorkspaceCollection<T>(load: (source: WorkspaceSource) => Promise<T[]>) {
  const source = useWorkspaceDataSource();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const contextRetries = useRef(0);

  useEffect(() => {
    let active = true;
    load(source).then((result) => {
      if (!active) return;
      setItems(result);
      contextRetries.current = 0;
      setLoading(false);
      setError(null);
    }).catch((reason: unknown) => {
      if (!active) return;
      if (reason instanceof ApiError && reason.code === "CONTEXT_CHANGED") {
        if (contextRetries.current === 0) {
          contextRetries.current = 1;
          setRevision((value) => value + 1);
          return;
        }
      }
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar los datos.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [load, source, revision]);

  return { source, items, loading, error, refresh: () => { setLoading(true); setRevision((value) => value + 1); } };
}
