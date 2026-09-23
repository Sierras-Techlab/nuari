import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export default function UiReferencePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-8">
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="space-y-3">
          <Badge variant="success">Sólo desarrollo</Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Referencia visual de Nuari</h1>
          <p className="max-w-2xl text-muted-foreground">Primitivas neutrales para construir la experiencia de Nuari. Esta página no representa un módulo de negocio.</p>
        </header>

        <Separator />

        <section aria-labelledby="tokens-title" className="space-y-4">
          <h2 id="tokens-title" className="text-xl font-semibold">Tokens semánticos</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Token name="Primary" className="bg-primary text-primary-foreground" />
            <Token name="Secondary" className="bg-secondary text-secondary-foreground" />
            <Token name="Success" className="bg-success text-success-foreground" />
            <Token name="Warning" className="bg-warning text-warning-foreground" />
            <Token name="Destructive" className="bg-destructive text-destructive-foreground" />
            <Token name="Muted" className="bg-muted text-muted-foreground" />
            <Token name="Card" className="border bg-card text-card-foreground" />
            <Token name="Border / focus" className="border-2 border-ring bg-background" />
          </div>
        </section>

        <section aria-labelledby="components-title" className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Controles</CardTitle><CardDescription>Variantes y estados interactivos.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Button>Continuar</Button><Button variant="secondary">Secundario</Button><Button variant="outline">Borde</Button><Button variant="ghost">Sutil</Button>
              </div>
              <div className="flex flex-wrap gap-2"><Button variant="destructive">Eliminar</Button><Button variant="link">Ver más</Button><Button disabled>Deshabilitado</Button></div>
              <div className="space-y-2"><Label htmlFor="reference-input">Campo de ejemplo</Label><Input id="reference-input" placeholder="Escribí algo..." /><p className="text-xs text-muted-foreground">El foco debe ser visible y no depender sólo del color.</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Estados y etiquetas</CardTitle><CardDescription>Significados reforzados con texto.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2"><Badge>Predeterminado</Badge><Badge variant="secondary">Borrador</Badge><Badge variant="outline">Neutro</Badge><Badge variant="success">Activo</Badge><Badge variant="warning">Pendiente</Badge><Badge variant="destructive">Error</Badge></div>
              <div className="space-y-3" aria-label="Ejemplo de carga"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-10 w-28" /></div>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="type-title" className="space-y-4"><h2 id="type-title" className="text-xl font-semibold">Tipografía</h2><p className="text-4xl font-bold tracking-tight">Información clara para decidir.</p><p className="text-lg text-muted-foreground">La interfaz debe ser legible, directa y cómoda en pantallas pequeñas.</p><p className="text-sm text-muted-foreground">Texto auxiliar y estados secundarios.</p></section>
      </div>
    </main>
  );
}

function Token({ name, className }: { name: string; className: string }) {
  return <div className={`flex min-h-20 items-end rounded-lg p-3 text-sm font-semibold ${className}`}>{name}</div>;
}
