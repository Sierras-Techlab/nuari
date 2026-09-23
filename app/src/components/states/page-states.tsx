import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export { ErrorState } from "./error-state";

export function LoadingState({ label = "Cargando contenido" }: { label?: string }) {
  return <div aria-busy="true" aria-label={label} className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-80 max-w-full" /><Skeleton className="h-32 w-full" /></div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>{action ? <CardContent>{action}</CardContent> : null}</Card>;
}
