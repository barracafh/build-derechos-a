"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import {
  ArrowUp,
  ArrowUpRight,
  Search,
  SquarePen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BotonAviso } from "@/components/BotonAviso";
import { TarjetaAyuda } from "@/components/TarjetaAyuda";
import { Lineas, Lista } from "@/components/Texto";
import { ruta, site } from "@/config/sitio";
import { PanelCobertura } from "@/components/PanelCobertura";
import type { MensajeChat, Respuesta } from "@/lib/tipos";
import ficha from "../../ficha.json";

// Cada texto sigue las pautas de lectura fácil (UNE 153101 EX): frases cortas,
// una por línea, en presente y con palabras sencillas.
const PREGUNTA = "¿Qué ayudas puedes pedir?";

const EJEMPLOS = [
  "Tengo 24 años, estoy en paro y vivo de alquiler en València",
  "Tengo 2 hijos en Castelló y ingresos bajos",
  "Soy jubilado, tengo 70 años, cobro la pensión mínima y la luz es muy cara",
  "Tengo 3 hijos en edad escolar y vivo en València",
];

type Mensaje =
  | { id: number; rol: "usuario"; texto: string }
  | { id: number; rol: "asistente"; estado: "cargando" }
  | { id: number; rol: "asistente"; estado: "error"; error: string; historial: MensajeChat[] }
  | { id: number; rol: "asistente"; estado: "ok"; respuesta: Respuesta };

const fechaLarga = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const H3 = "text-xl leading-[1.3] font-medium";

function Composer({
  texto,
  onChange,
  onEnviar,
  ocupado,
  flotante,
  entrada,
}: {
  texto: string;
  onChange: (t: string) => void;
  onEnviar: () => void;
  ocupado: boolean;
  flotante: boolean;
  entrada: RefObject<HTMLTextAreaElement | null>;
}) {
  // El cuadro crece con el texto hasta un máximo, en todos los navegadores.
  useEffect(() => {
    const el = entrada.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 208)}px`;
  }, [texto, entrada]);

  function teclas(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envía; Mayús+Enter, salto de línea.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onEnviar();
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onEnviar();
      }}
      className={cn(
        "composer flex items-end gap-2 rounded-[28px] border border-(--text-secondary) bg-background py-2 pr-2 pl-5",
        flotante && "shadow-(--shadow-soft)",
      )}
    >
      <label htmlFor="situacion" className="sr-only">
        Escribe tu situación con tus palabras
      </label>
      <textarea
        id="situacion"
        ref={entrada}
        value={texto}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={teclas}
        rows={1}
        maxLength={2000}
        autoComplete="off"
        placeholder="Escribe tu situación con tus palabras"
        className="max-h-52 min-h-12 min-w-0 flex-1 resize-none bg-transparent py-3 text-lg leading-6 placeholder:text-(--text-secondary)"
      />
      <Button
        type="submit"
        variant="sunset"
        aria-label="Buscar ayudas"
        disabled={ocupado || !texto.trim()}
        className="size-12 rounded-full"
      >
        <ArrowUp aria-hidden="true" className="size-6" />
      </Button>
    </form>
  );
}

const UNIDAD_HECHO: Record<string, string> = {
  edad: "Edad",
  municipio: "Lugar",
  situacionLaboral: "Trabajo",
  vivienda: "Vivienda",
  hijos: "Hijos",
  ingresos: "Ingresos",
  pension: "Pensión",
  discapacidad: "Discapacidad",
};

function VistaRespuesta({
  id,
  r,
  alPreguntar,
}: {
  id: number;
  r: Respuesta;
  alPreguntar: () => void;
}) {
  const n = r.fichas.length;
  const entendido = [
    ...r.perfil.hechos.map((h) => `${UNIDAD_HECHO[h.campo]}: ${h.valor}`),
    ...(r.perfil.necesidad ? [`Lo que buscas: ${r.perfil.necesidad}`] : []),
  ];
  const ahora = r.fichas.filter(
    (f) => f.estado === "abierta" || f.estado === "permanente",
  );
  return (
    <>
      <div className="grid gap-3">
        <h2
          id={`respuesta-${id}`}
          tabIndex={-1}
          className="font-sans text-3xl leading-9 font-medium"
        >
          {n === 0
            ? "No he encontrado ayudas"
            : n === 1
              ? "Podrías optar a 1 ayuda"
              : `Podrías optar a ${n} ayudas`}
        </h2>
        <p className="text-base text-(--text-secondary)">
          Hemos mirado el {fechaLarga(r.cobertura.fechaConsulta)}.
        </p>
      </div>

      {entendido.length > 0 && (
        <section className="grid gap-3">
          <h3 className={H3}>Lo que he entendido de ti</h3>
          <Lista items={entendido} />
          <p>Si algo está mal, escríbelo otra vez.</p>
        </section>
      )}

      {n === 0 ? (
        <Card
          render={<section />}
          className="gap-4 bg-muted px-6 py-6 text-lg ring-0"
        >
          <h3 className={H3}>Qué puedes hacer</h3>
          <Lineas
            lineas={[
              "Añade más datos sobre ti.",
              "Por ejemplo, si trabajas, cuánto ganas, si tienes hijos o si vives de alquiler.",
              "También puedes mirar la sede electrónica de la Generalitat.",
            ]}
          />
          <div>
            <a
              href="https://sede.gva.es"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-auto min-h-12 px-5 py-2 text-lg",
              )}
            >
              Abrir la sede de la Generalitat
              <ArrowUpRight aria-hidden="true" className="size-5" />
            </a>
          </div>
        </Card>
      ) : (
        <ol className="grid gap-6">
          {r.fichas.map((x, i) => (
            <TarjetaAyuda key={x.id} f={x} n={i + 1} />
          ))}
        </ol>
      )}

      <PanelCobertura c={r.cobertura} />

      {r.pregunta && (
        <section className="grid gap-3">
          <h3 className={H3}>Para afinar la búsqueda</h3>
          <p>{r.pregunta}</p>
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={alPreguntar}
              className="h-auto min-h-12 px-5 py-2 text-lg"
            >
              Responder
            </Button>
          </div>
        </section>
      )}

      {n > 0 && (
        <section className="grid gap-3">
          <h3 className={H3}>Resumen</h3>
          <Lista
            items={[
              n === 1
                ? "Hay 1 ayuda que puede ser para ti."
                : `Hay ${n} ayudas que pueden ser para ti.`,
              ...(ahora.length
                ? [`Puedes pedir ahora: ${ahora.map((f) => f.titulo).join(", ")}.`]
                : []),
              "Comprueba siempre los requisitos en la información oficial.",
            ]}
          />
          <p>Puedes escribirme más datos y busco otra vez.</p>
        </section>
      )}
    </>
  );
}

function BurbujaAsistente({
  m,
  alPreguntar,
  alReintentar,
}: {
  m: Extract<Mensaje, { rol: "asistente" }>;
  alPreguntar: () => void;
  alReintentar: (id: number, historial: MensajeChat[]) => void;
}) {
  return (
    <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-x-3 md:gap-x-4">
      <span
        aria-hidden="true"
        className="grid size-9 place-items-center rounded-lg bg-brand text-white"
      >
        <Search className="size-5" />
      </span>
      <div className="min-w-0 text-lg leading-[1.6] [&>:not(.sr-only)~*]:mt-8">
        <span className="sr-only">Respuesta: </span>
        {m.estado === "cargando" && (
          <p className="text-(--text-secondary) leading-9">
            Buscando ayudas
            <span aria-hidden="true" className="motion-safe:animate-pulse">
              …
            </span>
          </p>
        )}
        {m.estado === "error" && (
          <div
            role="alert"
            className="rounded-lg bg-(--warning) px-4 py-3 text-(--warning-foreground)"
          >
            <p className="font-medium">Ha habido un problema.</p>
            <p>{m.error}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => alReintentar(m.id, m.historial)}
              className="mt-3 h-auto min-h-12 px-5 py-2 text-lg"
            >
              Intentar otra vez
            </Button>
          </div>
        )}
        {m.estado === "ok" && <VistaRespuesta id={m.id} r={m.respuesta} alPreguntar={alPreguntar} />}
      </div>
    </div>
  );
}

export function Chat() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [anuncio, setAnuncio] = useState("");
  const [focoEn, setFocoEn] = useState<number | null>(null);
  const contador = useRef(0);
  const entrada = useRef<HTMLTextAreaElement>(null);
  const ultimoUsuario = useRef<HTMLDivElement>(null);

  const enChat = mensajes.length > 0;
  const ocupado = mensajes.some(
    (m) => m.rol === "asistente" && m.estado === "cargando",
  );
  const idUltimoUsuario = [...mensajes]
    .reverse()
    .find((m) => m.rol === "usuario")?.id;
  const hayRespuesta = mensajes.some(
    (m) => m.rol === "asistente" && m.estado !== "cargando",
  );

  // Al enviar, la pregunta nueva queda arriba y la respuesta se lee debajo.
  const total = mensajes.length;
  useEffect(() => {
    if (total === 0) return;
    const reducido = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    ultimoUsuario.current?.scrollIntoView({
      block: "start",
      behavior: reducido ? "auto" : "smooth",
    });
  }, [total]);

  // Cuando llega la respuesta, el foco va a su título: así el lector de pantalla
  // empieza a leerla y el teclado sigue desde ahí. Si la persona ya está
  // escribiendo otra cosa, no se le quita el foco.
  useEffect(() => {
    if (focoEn === null) return;
    const activo = document.activeElement;
    const libre =
      !activo ||
      activo === document.body ||
      (activo === entrada.current && !entrada.current?.value.trim());
    if (libre)
      document
        .getElementById(`respuesta-${focoEn}`)
        ?.focus({ preventScroll: true });
    setFocoEn(null);
  }, [focoEn]);

  function reemplazar(id: number, nuevo: Mensaje) {
    setMensajes((ms) => ms.map((m) => (m.id === id ? nuevo : m)));
  }

  // Historial que se manda: todo lo dicho, con las últimas 20 entradas.
  function historialCon(nuevo: string): MensajeChat[] {
    const previos: MensajeChat[] = mensajes.flatMap((m): MensajeChat[] =>
      m.rol === "usuario"
        ? [{ rol: "usuario", texto: m.texto }]
        : m.estado === "ok" && m.respuesta.pregunta
          ? [{ rol: "asistente", texto: m.respuesta.pregunta }]
          : [],
    );
    return [...previos, { rol: "usuario" as const, texto: nuevo }].slice(-20);
  }

  async function buscar(idA: number, historial: MensajeChat[]) {
    reemplazar(idA, { id: idA, rol: "asistente", estado: "cargando" });
    setAnuncio("Buscando ayudas.");
    try {
      const res = await fetch(ruta("/api/chat"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mensajes: historial }),
      });
      const datos = await res.json().catch(() => null);
      if (!res.ok || !datos)
        throw new Error(datos?.error ?? "No he podido buscar ahora mismo.");
      const respuesta = datos as Respuesta;
      reemplazar(idA, { id: idA, rol: "asistente", estado: "ok", respuesta });
      const n = respuesta.fichas.length;
      setAnuncio(
        n === 0
          ? "No he encontrado ayudas."
          : `He encontrado ${n} ${n === 1 ? "ayuda" : "ayudas"}.`,
      );
      setFocoEn(idA);
    } catch (err) {
      reemplazar(idA, {
        id: idA,
        rol: "asistente",
        estado: "error",
        historial,
        error:
          err instanceof Error
            ? err.message
            : "No he podido buscar ahora mismo. Inténtalo otra vez.",
      });
      setAnuncio("Ha habido un problema.");
    }
  }

  function enviar(directo?: string) {
    const limpio = (directo ?? texto).trim();
    if (!limpio || ocupado) return;
    const historial = historialCon(limpio);
    const idU = ++contador.current;
    const idA = ++contador.current;
    setMensajes((ms) => [
      ...ms,
      { id: idU, rol: "usuario", texto: limpio },
      { id: idA, rol: "asistente", estado: "cargando" },
    ]);
    setTexto("");
    entrada.current?.focus();
    void buscar(idA, historial);
  }

  // La pregunta de afinado lleva el cursor al cuadro de texto.
  function preguntar() {
    entrada.current?.focus();
  }

  function nueva() {
    setMensajes([]);
    setTexto("");
    setAnuncio("");
    requestAnimationFrame(() => entrada.current?.focus());
  }

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col">
      <div role="status" className="sr-only">
        {anuncio}
      </div>

      <header className="mx-auto flex min-h-16 w-full max-w-(--container-content) flex-wrap items-center justify-between gap-3 px-(--page-gutter) py-3">
        <button
          type="button"
          onClick={nueva}
          aria-label="Akorda, volver al inicio"
          className="cursor-pointer rounded-lg"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ruta("/logo-akorda.png")}
            alt=""
            width={839}
            height={213}
            className="h-9 w-auto"
          />
        </button>
        {enChat && (
          <Button
            type="button"
            variant="outline"
            onClick={nueva}
            className="h-9 px-3 text-base"
          >
            <SquarePen aria-hidden="true" className="size-4" />
            Nueva conversación
          </Button>
        )}
      </header>

      <main
        id="contenido"
        tabIndex={-1}
        className="flex flex-1 flex-col outline-none"
      >
        {!enChat ? (
          <div className="mx-auto grid w-full max-w-[760px] flex-1 grid-cols-[minmax(0,1fr)] content-center gap-10 px-(--page-gutter) py-10">
            <div className="grid gap-5 text-center">
              <h1 className="font-sans text-[clamp(32px,5vw,48px)] leading-[1.15] font-medium">
                {PREGUNTA}
              </h1>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
              <Composer
                texto={texto}
                onChange={setTexto}
                onEnviar={() => enviar()}
                ocupado={ocupado}
                flotante={false}
                entrada={entrada}
              />
            </div>

            <section aria-labelledby="titulo-ejemplos" className="grid gap-2">
              <h2
                id="titulo-ejemplos"
                className="font-sans text-xl leading-[1.3] font-medium"
              >
                Ejemplos para empezar
              </h2>
              <ul>
                {EJEMPLOS.map((ej) => (
                  <li key={ej}>
                    <button
                      type="button"
                      onClick={() => enviar(ej)}
                      className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-lg leading-normal transition-colors hover:bg-muted"
                    >
                      <ArrowUpRight
                        aria-hidden="true"
                        className="size-5 shrink-0"
                      />
                      {ej}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : (
          <>
            <h1 className="sr-only">{PREGUNTA}</h1>
            <section
              aria-label="Conversación"
              className="mx-auto grid w-full max-w-[760px] flex-1 grid-cols-[minmax(0,1fr)] content-start gap-10 px-(--page-gutter) pt-6 pb-10"
            >
              {mensajes.map((m) =>
                m.rol === "usuario" ? (
                  <div
                    key={m.id}
                    ref={m.id === idUltimoUsuario ? ultimoUsuario : undefined}
                    className="ml-auto max-w-[85%] scroll-mt-4 rounded-3xl bg-muted px-5 py-3 text-lg leading-[1.6] whitespace-pre-wrap [overflow-wrap:anywhere]"
                  >
                    <span className="sr-only">Tú: </span>
                    {m.texto}
                  </div>
                ) : (
                  <BurbujaAsistente
                    key={m.id}
                    m={m}
                    alPreguntar={preguntar}
                    alReintentar={(id, h) => void buscar(id, h)}
                  />
                ),
              )}

              {hayRespuesta && (
                <footer className="flex flex-wrap items-center gap-3">
                  <a
                    href={site.feedbackUrl}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "h-auto min-h-12 px-5 py-2 text-lg",
                    )}
                  >
                    ¿Algo está mal? Avísanos
                  </a>
                  <Link
                    href="/declaracion-de-accesibilidad"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "h-auto min-h-12 px-5 py-2 text-lg",
                    )}
                  >
                    Accesibilidad
                  </Link>
                </footer>
              )}
            </section>

            <div className="sticky bottom-0 bg-background pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
              <div className="mx-auto grid w-full max-w-[760px] grid-cols-[minmax(0,1fr)] gap-2 px-(--page-gutter)">
                <Composer
                  texto={texto}
                  onChange={setTexto}
                  onEnviar={() => enviar()}
                  ocupado={ocupado}
                  flotante
                  entrada={entrada}
                />
              </div>
            </div>
          </>
        )}
      </main>

      {!enChat && (
        <footer className="px-(--page-gutter) pb-4">
          <div className="mx-auto flex max-w-(--container-content) flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-base text-(--text-secondary)">
              Una pieza del squad{" "}
              <span className="font-mono">{ficha.equipo}</span> · Build night
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/declaracion-de-accesibilidad"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-auto min-h-11 px-4 py-2 text-base",
                )}
              >
                Accesibilidad
              </Link>
              <BotonAviso discreto />
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
