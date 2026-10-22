"use client";

import {
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  Euro,
  Lightbulb,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Fuentes } from "@/components/Fuentes";
import { useIdioma } from "@/components/Idioma";
import { Lineas, Lista, Texto } from "@/components/Texto";
import type { Idioma } from "@/lib/idioma";
import type { Ficha } from "@/lib/tipos";

// Colores de las etiquetas: texto oscuro sobre fondo claro (contraste > 7:1).
// El estado se dice siempre con palabras, no solo con el color.
const ESTADO = {
  abierta: "bg-green-100 text-green-900",
  permanente: "bg-green-100 text-green-900",
  cerrada: "bg-orange-100 text-orange-950",
  desconocido: "border-(--text-secondary) text-foreground",
} as const;

const AMBITO = {
  Estado: "bg-blue-100 text-blue-950",
  "Comunitat Valenciana": "bg-violet-100 text-violet-950",
  Local: "bg-pink-100 text-pink-950",
} as const;

const ES = {
  estado: {
    abierta: "Plazo abierto",
    permanente: "Sin fecha límite",
    cerrada: "Plazo cerrado",
    desconocido: "Plazo sin confirmar",
  },
  ambito: {
    Estado: () => "Estatal",
    "Comunitat Valenciana": (n: string | null) => `Autonómica: ${n ?? "Comunitat Valenciana"}`,
    Local: (n: string | null) => (n ? `Municipal: ${n}` : "Municipal"),
  },
  sinConfirmar: "Sin confirmar",
  sinPlazo: [
    "No hemos podido confirmar el plazo de esta ayuda.",
    "Mira el plazo en la información oficial.",
  ],
  porQue: "Por qué puede ser para ti",
  cuidado: "Ten cuidado:",
  plazo: "Plazo",
  dinero: "Dinero",
  tramite: "Hacer el trámite",
  oficial: "Información oficial",
  verRequisitos: "Ver requisitos y cómo pedirla",
  encaja: "Por qué encaja",
  cumplir: "Qué tienes que cumplir",
  cuanto: "Cuánto dinero es",
  comoSePide: "Cómo se pide",
  papeles: "Papeles que necesitas",
  textoOficial: "Texto oficial, no está en lectura fácil",
  talCual: "Este es el texto del catálogo, tal como está escrito.",
};

const TEXTOS: Record<Idioma, typeof ES> = {
  es: ES,
  va: {
    estado: {
      abierta: "Termini obert",
      permanente: "Sense data límit",
      cerrada: "Termini tancat",
      desconocido: "Termini sense confirmar",
    },
    ambito: {
      Estado: () => "Estatal",
      "Comunitat Valenciana": (n) => `Autonòmica: ${n ?? "Comunitat Valenciana"}`,
      Local: (n) => (n ? `Municipal: ${n}` : "Municipal"),
    },
    sinConfirmar: "Sense confirmar",
    sinPlazo: [
      "No hem pogut confirmar el termini d'esta ajuda.",
      "Mira el termini en la informació oficial.",
    ],
    porQue: "Per què pot ser per a tu",
    cuidado: "Compte:",
    plazo: "Termini",
    dinero: "Diners",
    tramite: "Fer el tràmit",
    oficial: "Informació oficial",
    verRequisitos: "Veure requisits i com demanar-la",
    encaja: "Per què encaixa",
    cumplir: "Què has de complir",
    cuanto: "Quants diners són",
    comoSePide: "Com es demana",
    papeles: "Papers que necessites",
    textoOficial: "Text oficial, no està en lectura fàcil",
    talCual: "Este és el text del catàleg, tal com està escrit.",
  },
};

// Etiqueta de cada bloque: pequeña y en gris, como en el resto de la herramienta.
const ETIQUETA = "text-lg font-medium text-(--text-secondary)";

// Título de bloque con icono decorativo (el texto ya dice lo mismo).
function Titulo({
  icono: Icono,
  children,
}: {
  icono: LucideIcon;
  children: string;
}) {
  return (
    <h4 className={`${ETIQUETA} flex items-center gap-2`}>
      <Icono aria-hidden="true" className="size-5 shrink-0" />
      {children}
    </h4>
  );
}

// Una ayuda: a la vista solo lo que decide (por qué encaja, plazo e importe) y,
// plegado, todo lo demás. `detalle` es opcional: una ficha de otra fuente puede
// traer solo los campos del contrato.
export function TarjetaAyuda({ f, n }: { f: Ficha; n: number }) {
  const t = TEXTOS[useIdioma()];
  const d = f.detalle;
  const resumen = d?.resumen ?? [f.finalidad];
  const avisos = d?.avisos ?? [];
  const plazo = d?.plazo ?? (f.estado === "desconocido" ? t.sinPlazo : []);
  const dinero = d?.dinero ?? null;
  const fuentes = d?.fuentes ?? [
    { nombre: new URL(f.enlace).hostname, url: f.enlace },
  ];
  return (
    <li>
      <Card
        render={<article />}
        className="gap-5 px-6 py-6 text-lg leading-[1.6] max-sm:px-5"
      >
        <header className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={`h-8 px-3 text-base ${ESTADO[f.estado]}`}
            >
              {t.estado[f.estado]}
            </Badge>
            <Badge
              variant="outline"
              className={`h-auto min-h-8 shrink px-3 py-1 text-base whitespace-normal ${AMBITO[f.administracion]}`}
            >
              {t.ambito[f.administracion](d?.ambito ?? null)}
            </Badge>
            {!f.verificado && (
              <Badge variant="outline" className="h-8 px-3 text-base">
                {t.sinConfirmar}
              </Badge>
            )}
          </div>
          <h3 className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 font-sans text-2xl leading-[1.25] font-medium">
            <span aria-hidden="true" className="font-light text-brand tabular-nums">
              {n}
            </span>
            <span>{f.titulo}</span>
          </h3>
          <p className="text-(--text-secondary)">
            <Texto>{resumen[0]}</Texto>
          </p>
        </header>

        {f.porQue.length > 0 && (
          <section className="grid gap-2">
            <Titulo icono={Lightbulb}>{t.porQue}</Titulo>
            <Lineas lineas={f.porQue} />
          </section>
        )}

        {avisos.length > 0 && (
          <div className="rounded-lg bg-(--warning) px-4 py-3 text-(--warning-foreground)">
            <p className="mb-1 font-medium">{t.cuidado}</p>
            <Lineas lineas={avisos} />
          </div>
        )}

        {(plazo.length > 0 || dinero) && (
          <div className="grid gap-3 rounded-xl bg-muted px-5 py-4">
            {plazo.length > 0 && (
              <p className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2">
                <CalendarClock
                  aria-hidden="true"
                  className="mt-1 size-5 shrink-0"
                />
                <span>
                  <span className="sr-only">{t.plazo}: </span>
                  <Texto>{plazo[0]}</Texto>
                </span>
              </p>
            )}
            {dinero && (
              <p className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2">
                <Euro aria-hidden="true" className="mt-1 size-5 shrink-0" />
                <span>
                  <span className="sr-only">{t.dinero}: </span>
                  <Texto>{dinero.intro[0]}</Texto>
                </span>
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {d?.enlaceTramite && (
            <a
              href={d.enlaceTramite}
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "h-auto min-h-12 px-6 py-2 text-lg font-medium whitespace-normal max-md:w-full",
              )}
            >
              {t.tramite}
              <span className="sr-only"> de {f.titulo}</span>
              <ArrowUpRight aria-hidden="true" className="size-5" />
            </a>
          )}
          <a
            href={f.enlace}
            className={cn(
              buttonVariants({ variant: "ghost", size: "lg" }),
              "h-auto min-h-12 px-4 py-2 text-lg whitespace-normal underline underline-offset-4 max-md:w-full",
            )}
          >
            {t.oficial}
            <span className="sr-only"> de {f.titulo}</span>
          </a>
        </div>

        <details className="group">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-lg font-medium [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden="true"
              className="size-5 shrink-0 transition-transform group-open:rotate-90"
            />
            {t.verRequisitos}
            <span className="sr-only"> de {f.titulo}</span>
          </summary>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-6 pl-7">
            {resumen.length > 1 && <Lineas lineas={resumen.slice(1)} />}
            {d && d.porQueDetalle.length > 0 && (
              <section className="grid gap-2">
                <Titulo icono={Lightbulb}>{t.encaja}</Titulo>
                <Lineas lineas={d.porQueDetalle} />
              </section>
            )}
            <section className="grid gap-2">
              <Titulo icono={ListChecks}>{t.cumplir}</Titulo>
              <Lista items={f.requisitos} />
            </section>
            {plazo.length > 1 && (
              <section className="grid gap-2">
                <Titulo icono={CalendarClock}>{t.plazo}</Titulo>
                <Lineas lineas={plazo} />
              </section>
            )}
            {dinero && (
              <section className="grid gap-2">
                <Titulo icono={Euro}>{t.cuanto}</Titulo>
                <Lineas lineas={dinero.intro} />
                {dinero.lista && <Lista items={dinero.lista} />}
              </section>
            )}
            {d && (
              <>
                <section className="grid gap-2">
                  <h4 className={ETIQUETA}>{t.comoSePide}</h4>
                  <Lista items={d.pasos} ordenada />
                </section>
                <section className="grid gap-2">
                  <h4 className={ETIQUETA}>{t.papeles}</h4>
                  <Lista items={d.documentos} />
                </section>
              </>
            )}
            <Fuentes fuentes={fuentes} />
            {d && (
              <details className="group rounded-xl bg-muted px-5 py-4">
                <summary className="min-h-11 cursor-pointer py-2 text-lg font-medium">
                  {t.textoOficial}
                </summary>
                <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-4">
                  <p className="text-(--text-secondary)">
                    {t.talCual}
                  </p>
                  <p>{d.oficial.titulo}</p>
                  <p className="[overflow-wrap:anywhere]">{d.oficial.organismo}</p>
                  <ul className="grid list-disc gap-2 pl-7">
                    {d.oficial.requisitos.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                  {d.oficial.plazo && <p>{t.plazo}: {d.oficial.plazo}</p>}
                </div>
              </details>
            )}
          </div>
        </details>
      </Card>
    </li>
  );
}
