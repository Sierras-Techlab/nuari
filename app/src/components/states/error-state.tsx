"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ErrorState({ title = "No pudimos cargar este contenido", description = "Intentá nuevamente. Si el problema continúa, revisá la conexión.", action }: { title?: string; description?: string; action?: ReactNode }) {
  return <Card role="alert" className="border-destructive/40"><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>{action ? <CardContent>{action}</CardContent> : <CardContent><Button variant="outline" onClick={() => window.location.reload()}>Reintentar</Button></CardContent>}</Card>;
}
