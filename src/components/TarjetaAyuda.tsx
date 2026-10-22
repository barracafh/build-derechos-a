import { ArrowUpRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Fuentes } from "@/components/Fuentes";
import { Lineas, Lista } from "@/components/Texto";
import type { Resultado } from "@/lib/buscar";

const VARIANTE_ESTADO = {
  abierta: "default",
  permanente: "secondary",
  cerrada: "outline",
  "sin-confirmar": "outline",
} as const;

// El estado se dice con palabras, no solo con el color.
const ETIQUETA_ESTADO = {
  abierta: "Plazo abierto",
  permanente: "Sin fecha límite",
  cerrada: "Plazo cerrado",
  "sin-confirmar": "Plazo sin confirmar",
} as const;

// Etiqueta de cada bloque: pequeña y en gris, como en el resto de la herramienta.
const ETIQUETA = "text-lg font-medium text-(--text-secondary)";

// Una ayuda del catálogo: lo que decide va a la vista (por qué encaja, qué hay
// que cumplir y plazo) y el detalle de cómo se pide queda plegado.
export function TarjetaAyuda({ r, n }: { r: Resultado; n: number }) {
  return (
    <li>
      <Card
        render={<article />}
        className="gap-6 px-6 py-6 text-lg leading-[1.6] max-sm:px-5"
      >
        <header className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={VARIANTE_ESTADO[r.estado.tipo]}
              className="h-8 px-3 text-base"
            >
              {ETIQUETA_ESTADO[r.estado.tipo]}
            </Badge>
            <Badge variant="outline" className="h-8 px-3 text-base">
              {r.quien}
            </Badge>
          </div>
          <h3 className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 font-sans text-2xl leading-[1.25] font-medium">
            <span aria-hidden="true" className="font-light text-brand tabular-nums">
              {n}
            </span>
            <span>{r.nombre}</span>
          </h3>
          <Lineas lineas={r.resumen} className="text-(--text-secondary)" />
        </header>

        <section className="grid gap-2">
          <h4 className={ETIQUETA}>Por qué puede ser para ti</h4>
          <Lineas lineas={r.motivos} />
          {r.avisos.length > 0 && (
            <div className="mt-1 rounded-lg bg-(--warning) px-4 py-3 text-(--warning-foreground)">
              <p className="mb-1 font-medium">Ten cuidado:</p>
              <Lineas lineas={r.avisos} />
            </div>
          )}
        </section>

        <div className="grid gap-3 md:grid-cols-2">
          <section className="grid content-start gap-2 rounded-xl bg-muted px-5 py-5">
            <h4 className={ETIQUETA}>Qué tienes que cumplir</h4>
            <Lista items={r.requisitos} />
          </section>
          <div className="grid content-start gap-3">
            <section className="grid gap-2 rounded-xl bg-muted px-5 py-5">
              <h4 className={ETIQUETA}>Plazo</h4>
              <Lineas lineas={r.estado.lineas} />
            </section>
            {r.dinero && (
              <section className="grid gap-2 rounded-xl bg-muted px-5 py-5">
                <h4 className={ETIQUETA}>Cuánto dinero es</h4>
                <Lineas lineas={r.dinero.intro} />
                {r.dinero.lista && <Lista items={r.dinero.lista} />}
              </section>
            )}
          </div>
        </div>

        <details className="group">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-lg font-medium [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden="true"
              className="size-5 shrink-0 transition-transform group-open:rotate-90"
            />
            Cómo se pide y papeles que necesitas
          </summary>
          <div className="mt-3 grid gap-6 pl-7">
            <section className="grid gap-2">
              <h4 className={ETIQUETA}>Cómo se pide</h4>
              <Lista items={r.pasos} ordenada />
            </section>
            <section className="grid gap-2">
              <h4 className={ETIQUETA}>Papeles que necesitas</h4>
              <Lista items={r.documentos} />
            </section>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={r.enlaceInfo}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-auto min-h-12 px-5 py-2 text-lg whitespace-normal max-md:w-full",
            )}
          >
            Información oficial
            <span className="sr-only"> de {r.nombre}</span>
            <ArrowUpRight aria-hidden="true" className="size-5" />
          </a>
          {r.enlaceTramite && (
            <a
              href={r.enlaceTramite}
              className={cn(
                buttonVariants({ variant: "secondary", size: "lg" }),
                "h-auto min-h-12 px-5 py-2 text-lg whitespace-normal max-md:w-full",
              )}
            >
              Hacer el trámite
              <span className="sr-only"> de {r.nombre}</span>
              <ArrowUpRight aria-hidden="true" className="size-5" />
            </a>
          )}
        </div>

        <Fuentes fuentes={r.fuentes} />

        <details className="group rounded-xl bg-muted px-5 py-4">
          <summary className="min-h-11 cursor-pointer py-2 text-lg font-medium">
            Texto oficial, no está en lectura fácil
          </summary>
          <div className="mt-3 grid gap-4">
            <p className="text-(--text-secondary)">
              Este es el texto del catálogo, tal como está escrito.
            </p>
            <p>{r.oficial.titulo}</p>
            <p className="[overflow-wrap:anywhere]">{r.oficial.organismo}</p>
            <ul className="grid list-disc gap-2 pl-7">
              {r.oficial.requisitos.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
            {r.oficial.plazo && <p>Plazo: {r.oficial.plazo}</p>}
          </div>
        </details>
      </Card>
    </li>
  );
}
