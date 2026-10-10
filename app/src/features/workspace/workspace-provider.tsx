"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { createLocalWorkspaceSource } from "./local-source";
import type { WorkspaceSource } from "./types";

const WorkspaceContext = createContext<WorkspaceSource | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [source] = useState(createLocalWorkspaceSource);
  return <WorkspaceContext.Provider value={source}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceSource(): WorkspaceSource | null {
  return useContext(WorkspaceContext);
}

export function useWorkspaceDataSource(): WorkspaceSource {
  const shared = useWorkspaceSource();
  const [local] = useState(createLocalWorkspaceSource);
  return shared ?? local;
}

export function useWorkspaceCollection<T>(load: (source: WorkspaceSource) => Promise<T[]>) {
  const source = useWorkspaceDataSource();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    load(source).then((result) => {
      if (!active) return;
      setItems(result);
      setLoading(false);
      setError(null);
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar los datos.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [load, source, revision]);

  return { source, items, loading, error, refresh: () => { setLoading(true); setRevision((value) => value + 1); } };
}
