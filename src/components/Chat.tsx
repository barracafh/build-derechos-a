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
  Check,
  ChevronRight,
  Search,
  SquarePen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BotonAviso } from "@/components/BotonAviso";
import { TarjetaAyuda } from "@/components/TarjetaAyuda";
import { Formulario } from "@/components/Formulario";
import { Lineas } from "@/components/Texto";
import { SelectorIdioma, useIdioma } from "@/components/Idioma";
import { ruta, site } from "@/config/sitio";
import { CATALOGO_ACTUALIZADO } from "@/datos/actualizacion";
import { TEXTO_PREGUNTA } from "@/lib/llm/pregunta";
import { PanelCobertura } from "@/components/PanelCobertura";
import { LANG, type Idioma } from "@/lib/idioma";
import type { CampoFormulario, EventoChat, MensajeChat, Paso, Respuesta } from "@/lib/tipos";
import ficha from "../../ficha.json";

// Cada texto sigue las pautas de lectura fácil (UNE 153101 EX): frases cortas,
// una por línea, en presente y con palabras sencillas.
const ES = {
  pregunta: "¿Qué ayudas puedes pedir?",
  subtitulo: "Cuéntanos tu situación y te decimos qué ayudas pueden ser para ti.",
  ejemplos: [
    "Tengo 24 años, estoy en paro y vivo de alquiler en València",
    "Tengo 2 hijos en Castelló y ingresos bajos",
    "Soy jubilado, tengo 70 años, cobro la pensión mínima y la luz es muy cara",
    "Tengo 3 hijos en edad escolar y vivo en València",
  ],
  tituloEjemplos: "Ejemplos para empezar",
  // Lo que se ve mientras se busca, según la fase que manda el servidor.
  paso: {
    leyendo: "Leyendo tu mensaje",
    reintentando: "Tarda un poco más. Lo intento otra vez",
    comprobando: "Comprobando requisitos y plazos",
    buscando: "Buscando convocatorias de tu zona",
    requisitos: "Leyendo los requisitos de las convocatorias",
    eligiendo: "Eligiendo las ayudas que encajan contigo",
  } satisfies Record<Paso, string>,
  pensando: "Pensando",
  paciencia: "Puede tardar hasta un minuto.",
  escribe: "Escribe tu situación con tus palabras",
  buscarAyudas: "Buscar ayudas",
  unidad: {
    edad: "Edad",
    municipio: "Lugar",
    situacionLaboral: "Trabajo",
    vivienda: "Vivienda",
    hijos: "Hijos",
    ingresos: "Ingresos",
    pension: "Pensión",
    discapacidad: "Discapacidad",
  } as Record<string, string>,
  // Los valores cerrados del perfil (OPCIONES de lib/llm/pregunta.ts) llegan en
  // castellano; aquí se traducen solo para mostrarlos.
  valor: {} as Record<string, string>,
  loQueBuscas: "Lo que buscas",
  cuentame: "Para buscar tus ayudas, completa los datos que quieras. No hace falta responder a todo.",
  titulo: (n: number) =>
    n === 0 ? "No he encontrado ayudas" : n === 1 ? "Podrías optar a 1 ayuda" : `Podrías optar a ${n} ayudas`,
  mirado: (fecha: string) => `Hemos mirado el ${fecha}.`,
  afinar: "Para afinar la búsqueda",
  responder: "Responder",
  entendido: "Lo que he entendido de ti: ",
  corrige: "Si algo está mal, escríbelo otra vez.",
  quePuedesHacer: "Qué puedes hacer",
  sinAyudas: [
    "Añade más datos sobre ti.",
    "Por ejemplo, si trabajas, cuánto ganas, si tienes hijos o si vives de alquiler.",
    "También puedes mirar la sede electrónica de la Generalitat.",
  ],
  abrirSede: "Abrir la sede de la Generalitat",
  despues: (ahora: number, despues: number) =>
    ahora === 0
      ? "Ayudas con el plazo sin confirmar"
      : despues === 1
        ? "1 ayuda más con el plazo sin confirmar"
        : `${despues} ayudas más con el plazo sin confirmar`,
  respuesta: "Respuesta: ",
  problema: "Ha habido un problema.",
  otraVez: "Intentar otra vez",
  noHePodido: "No he podido buscar ahora mismo.",
  noHePodidoReintenta: "No he podido buscar ahora mismo. Inténtalo otra vez.",
  buscando: "Buscando ayudas.",
  tePregunto: "Te pregunto unos datos para buscar tus ayudas.",
  encontrado: (n: number) =>
    n === 0 ? "No he encontrado ayudas." : `He encontrado ${n} ${n === 1 ? "ayuda" : "ayudas"}.`,
  inicio: "Buscador de ayudas, volver al inicio",
  actualizadas: (fecha: string) => `Catálogo revisado el ${fecha}`,
  nueva: "Nueva conversación",
  conversacion: "Conversación",
  tu: "Tú: ",
  aviso: "¿Algo está mal? Avísanos",
  accesibilidad: "Accesibilidad",
  pieza: "Una pieza del squad",
};

const TEXTOS: Record<Idioma, typeof ES> = {
  es: ES,
  va: {
    pregunta: "Quines ajudes pots demanar?",
    subtitulo: "Conta'ns la teua situació i et diem quines ajudes poden ser per a tu.",
    ejemplos: [
      "Tinc 24 anys, estic a l'atur i visc de lloguer a València",
      "Tinc 2 fills a Castelló i ingressos baixos",
      "Soc jubilat, tinc 70 anys, cobre la pensió mínima i la llum és molt cara",
      "Tinc 3 fills en edat escolar i visc a València",
    ],
    tituloEjemplos: "Exemples per a començar",
    paso: {
      leyendo: "Llegint el teu missatge",
      reintentando: "Tarda un poc més. Ho torne a intentar",
      comprobando: "Comprovant requisits i terminis",
      buscando: "Buscant convocatòries de la teua zona",
      requisitos: "Llegint els requisits de les convocatòries",
      eligiendo: "Triant les ajudes que encaixen amb tu",
    },
    pensando: "Pensant",
    paciencia: "Pot tardar fins a un minut.",
    escribe: "Escriu la teua situació amb les teues paraules",
    buscarAyudas: "Buscar ajudes",
    unidad: {
      edad: "Edat",
      municipio: "Lloc",
      situacionLaboral: "Treball",
      vivienda: "Habitatge",
      hijos: "Fills",
      ingresos: "Ingressos",
      pension: "Pensió",
      discapacidad: "Discapacitat",
    },
    valor: {
      "en paro": "a l'atur",
      "paro agotado": "atur esgotat",
      trabajando: "treballant",
      autónomo: "autònom",
      jubilado: "jubilat",
      estudiando: "estudiant",
      otra: "una altra",
      alquiler: "lloguer",
      habitación: "habitació",
      propiedad: "propietat",
      "sin ingresos": "sense ingressos",
      "menos de 600 €": "menys de 600 €",
      "más de 1.800 €": "més de 1.800 €",
      bajos: "baixos",
    },
    loQueBuscas: "El que busques",
    cuentame: "Per a buscar les teues ajudes, completa les dades que vulgues. No cal respondre a tot.",
    titulo: (n) =>
      n === 0 ? "No he trobat ajudes" : n === 1 ? "Podries optar a 1 ajuda" : `Podries optar a ${n} ajudes`,
    mirado: (fecha) => `Hem mirat el ${fecha}.`,
    afinar: "Per a afinar la cerca",
    responder: "Respondre",
    entendido: "El que he entés de tu: ",
    corrige: "Si alguna cosa està malament, torna a escriure-la.",
    quePuedesHacer: "Què pots fer",
    sinAyudas: [
      "Afig més dades sobre tu.",
      "Per exemple, si treballes, quant guanyes, si tens fills o si vius de lloguer.",
      "També pots mirar la seu electrònica de la Generalitat.",
    ],
    abrirSede: "Obrir la seu de la Generalitat",
    despues: (ahora, despues) =>
      ahora === 0
        ? "Ajudes amb el termini sense confirmar"
        : despues === 1
          ? "1 ajuda més amb el termini sense confirmar"
          : `${despues} ajudes més amb el termini sense confirmar`,
    respuesta: "Resposta: ",
    problema: "Hi ha hagut un problema.",
    otraVez: "Tornar-ho a intentar",
    noHePodido: "No he pogut buscar ara mateix.",
    noHePodidoReintenta: "No he pogut buscar ara mateix. Torna-ho a intentar.",
    buscando: "Buscant ajudes.",
    tePregunto: "Et pregunte unes dades per a buscar les teues ajudes.",
    encontrado: (n) =>
      n === 0 ? "No he trobat ajudes." : `He trobat ${n} ${n === 1 ? "ajuda" : "ajudes"}.`,
    inicio: "Cercador d'ajudes, tornar a l'inici",
    actualizadas: (fecha) => `Catàleg revisat el ${fecha}`,
    nueva: "Conversa nova",
    conversacion: "Conversa",
    tu: "Tu: ",
    aviso: "Hi ha algun error? Avisa'ns",
    accesibilidad: "Accessibilitat",
    pieza: "Una peça de l'squad",
  },
};

type Mensaje =
  | { id: number; rol: "usuario"; texto: string }
  | { id: number; rol: "asistente"; estado: "cargando"; pasos?: Paso[] }
  | { id: number; rol: "asistente"; estado: "error"; error: string; historial: MensajeChat[] }
  | { id: number; rol: "asistente"; estado: "ok"; respuesta: Respuesta };

// La conversación se guarda solo en esta pestaña (sessionStorage): sobrevive a
// recargar y se borra al cerrarla. Nunca sale del navegador.
const CLAVE_CONVERSACION = "akorda:conversacion";

const fechaLarga = (iso: string, idioma: Idioma) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(LANG[idioma], {
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
  const t = TEXTOS[useIdioma()];
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
        {t.escribe}
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
        placeholder={t.escribe}
        className="max-h-52 min-h-12 min-w-0 flex-1 resize-none bg-transparent py-3 text-lg leading-6 placeholder:text-(--text-secondary)"
      />
      <Button
        type="submit"
        variant="sunset"
        aria-label={t.buscarAyudas}
        disabled={ocupado || !texto.trim()}
        className="size-12 rounded-full"
      >
        <ArrowUp aria-hidden="true" className="size-6" />
      </Button>
    </form>
  );
}

function VistaRespuesta({
  id,
  r,
  alPreguntar,
  alEnviar,
  activa,
}: {
  id: number;
  r: Respuesta;
  alPreguntar: () => void;
  alEnviar: (texto: string) => void;
  activa: boolean;
}) {
  const idioma = useIdioma();
  const t = TEXTOS[idioma];
  const n = r.fichas.length;
  const entendido = [
    ...r.perfil.hechos.map((h) => `${t.unidad[h.campo]}: ${t.valor[h.valor] ?? h.valor}`),
    ...(r.perfil.necesidad ? [`${t.loQueBuscas}: ${r.perfil.necesidad}`] : []),
  ];
  const esAhora = (f: Respuesta["fichas"][number]) =>
    f.estado === "abierta" || f.estado === "permanente";
  const ahora = r.fichas.filter(esAhora);
  const despues = r.fichas.filter((f) => !esAhora(f));
  // Las conversaciones antiguas pueden traer las preguntas sin los campos.
  // También se presentan como formulario, no como un párrafo de preguntas.
  const campos = r.formulario?.length
    ? r.formulario
    : (Object.keys(TEXTO_PREGUNTA) as CampoFormulario[])
      .filter((c) => r.pregunta?.includes(TEXTO_PREGUNTA[c]));
  // Mientras se conoce a la persona, la respuesta es solo la pregunta o el
  // formulario, como en un chat. El formato de resultados es para cuando hay
  // ayudas que enseñar. Solo la última respuesta deja contestar.
  if (n === 0 && r.pregunta)
    return campos.length > 1 ? (
      <div className="grid gap-6 pt-1">
        <p>{t.cuentame}</p>
        {activa && <Formulario id={id} campos={campos} alEnviar={alEnviar} enfocar />}
      </div>
    ) : (
      <p className="pt-1">{r.pregunta}</p>
    );
  return (
    <>
      <div className="grid gap-3">
        <h2
          id={`respuesta-${id}`}
          tabIndex={-1}
          className="font-sans text-3xl leading-9 font-medium"
        >
          {t.titulo(n)}
        </h2>
        <p className="text-base text-(--text-secondary)">
          {t.mirado(fechaLarga(r.cobertura.fechaConsulta, idioma))}
        </p>
      </div>

      {r.pregunta && campos.length <= 1 && (
        <section className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h3 className="sr-only">{t.afinar}</h3>
          <p>{r.pregunta}</p>
          <Button
            type="button"
            variant="outline"
            onClick={alPreguntar}
            className="h-auto min-h-11 px-4 py-2 text-base"
          >
            {t.responder}
          </Button>
        </section>
      )}

      {entendido.length > 0 && (
        <p>
          <span className="font-medium">{t.entendido}</span>
          {entendido.join(" · ")}.{" "}
          <span className="text-(--text-secondary)">
            {t.corrige}
          </span>
        </p>
      )}

      {n === 0 ? (
        <Card
          render={<section />}
          className="gap-4 bg-muted px-6 py-6 text-lg ring-0"
        >
          <h3 className={H3}>{t.quePuedesHacer}</h3>
          <Lineas lineas={t.sinAyudas} />
          <div>
            <a
              href="https://sede.gva.es"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-auto min-h-12 px-5 py-2 text-lg",
              )}
            >
              {t.abrirSede}
              <ArrowUpRight aria-hidden="true" className="size-5" />
            </a>
          </div>
        </Card>
      ) : (
        <>
          {ahora.length > 0 && (
            <ol className="grid grid-cols-[minmax(0,1fr)] gap-6">
              {ahora.map((x, i) => (
                <TarjetaAyuda key={x.id} f={x} n={i + 1} />
              ))}
            </ol>
          )}
          {despues.length > 0 && (
            <details open={ahora.length === 0} className="group grid grid-cols-[minmax(0,1fr)] gap-4">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-lg font-medium [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  aria-hidden="true"
                  className="size-5 shrink-0 transition-transform group-open:rotate-90"
                />
                {t.despues(ahora.length, despues.length)}
              </summary>
              <ol className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-6">
                {despues.map((x, i) => (
                  <TarjetaAyuda key={x.id} f={x} n={ahora.length + i + 1} />
                ))}
              </ol>
            </details>
          )}
        </>
      )}

      {campos.length > 1 && activa && (
        <section aria-labelledby={`afinar-${id}`} className="grid gap-6">
          <h3 id={`afinar-${id}`} className={H3}>
            {t.afinar}
          </h3>
          <Formulario id={id} campos={campos} alEnviar={alEnviar} enfocar={false} />
        </section>
      )}

      <PanelCobertura c={r.cobertura} />


    </>
  );
}

// Mientras se busca: las fases ya hechas, marcadas, y la actual con los
// puntos. Si pasan 10 s, se avisa de que puede tardar.
function Progreso({ pasos }: { pasos: Paso[] }) {
  const t = TEXTOS[useIdioma()];
  const [lento, setLento] = useState(false);
  useEffect(() => {
    const reloj = setTimeout(() => setLento(true), 10_000);
    return () => clearTimeout(reloj);
  }, []);
  const actual = pasos.at(-1);
  // «Lo intento otra vez» no es una fase hecha: solo se ve mientras dura.
  const hechas = [...new Set(pasos)].filter((p) => p !== actual && p !== "reintentando");
  return (
    <div className="grid gap-1 leading-9 text-(--text-secondary)">
      {hechas.length > 0 && (
        <ul>
          {hechas.map((p) => (
            <li key={p} className="aparece flex items-center gap-3">
              <span aria-hidden="true" className="flex w-6 justify-center">
                <Check className="size-5" />
              </span>
              {t.paso[p]}
            </li>
          ))}
        </ul>
      )}
      <p className="flex items-center gap-3">
        <span aria-hidden="true" className="escribiendo flex w-6 justify-center gap-1">
          <span className="size-1.5 rounded-full bg-current" />
          <span className="size-1.5 rounded-full bg-current" />
          <span className="size-1.5 rounded-full bg-current" />
        </span>
        <span key={actual ?? "pensando"} className="aparece">
          {actual ? t.paso[actual] : t.pensando}
        </span>
      </p>
      {lento && <p className="aparece pl-9 text-base">{t.paciencia}</p>}
    </div>
  );
}

function BurbujaAsistente({
  m,
  alPreguntar,
  alEnviar,
  activa,
  alReintentar,
}: {
  m: Extract<Mensaje, { rol: "asistente" }>;
  alPreguntar: () => void;
  alEnviar: (texto: string) => void;
  activa: boolean;
  alReintentar: (id: number, historial: MensajeChat[]) => void;
}) {
  const t = TEXTOS[useIdioma()];
  return (
    <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-x-3 md:gap-x-4">
      <span
        aria-hidden="true"
        className="grid size-9 place-items-center rounded-lg bg-brand text-white"
      >
        <Search className="size-5" />
      </span>
      {/* La clave cambia con el estado: cada cambio entra con su animación. */}
      <div
        key={m.estado}
        className="aparece min-w-0 text-lg leading-[1.6] [&>:not(.sr-only)~*]:mt-8"
      >
        <span className="sr-only">{t.respuesta}</span>
        {m.estado === "cargando" && <Progreso pasos={m.pasos ?? []} />}
        {m.estado === "error" && (
          <div
            role="alert"
            className="rounded-lg bg-(--warning) px-4 py-3 text-(--warning-foreground)"
          >
            <p className="font-medium">{t.problema}</p>
            <p>{m.error}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => alReintentar(m.id, m.historial)}
              className="mt-3 h-auto min-h-12 px-5 py-2 text-lg"
            >
              {t.otraVez}
            </Button>
          </div>
        )}
        {m.estado === "ok" && (
          <VistaRespuesta
            id={m.id}
            r={m.respuesta}
            alPreguntar={alPreguntar}
            alEnviar={alEnviar}
            activa={activa}
          />
        )}
      </div>
    </div>
  );
}

export function Chat() {
  const idioma = useIdioma();
  const t = TEXTOS[idioma];
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

  // Al abrir, recupera la conversación de esta pestaña si la hay.
  const [restaurada, setRestaurada] = useState(false);
  useEffect(() => {
    try {
      const guardada = sessionStorage.getItem(CLAVE_CONVERSACION);
      if (guardada) {
        const ms = JSON.parse(guardada) as Mensaje[];
        contador.current = Math.max(0, ...ms.map((m) => m.id));
        setMensajes(ms);
      }
    } catch {
      // Sin sessionStorage (modo privado, bloqueado): se empieza de cero.
    }
    setRestaurada(true);
  }, []);

  // Se guarda cuando no hay nada buscándose; «Nueva conversación» la borra.
  useEffect(() => {
    if (!restaurada || ocupado) return;
    try {
      if (mensajes.length === 0) sessionStorage.removeItem(CLAVE_CONVERSACION);
      else sessionStorage.setItem(CLAVE_CONVERSACION, JSON.stringify(mensajes));
    } catch {
      // Si no se puede guardar, la conversación sigue en memoria.
    }
  }, [mensajes, ocupado, restaurada]);

  function reemplazar(id: number, nuevo: Mensaje) {
    setMensajes((ms) => ms.map((m) => (m.id === id ? nuevo : m)));
  }

  // Historial que se manda: todo lo dicho, con las últimas 60 entradas.
  function historialCon(nuevo: string): MensajeChat[] {
    const previos: MensajeChat[] = mensajes.flatMap((m): MensajeChat[] =>
      m.rol === "usuario"
        ? [{ rol: "usuario", texto: m.texto }]
        : m.estado === "ok" && m.respuesta.pregunta
          ? m.respuesta.formulario?.length
            ? m.respuesta.formulario.map((c) => ({ rol: "asistente" as const, texto: TEXTO_PREGUNTA[c] }))
            : [{ rol: "asistente", texto: m.respuesta.pregunta }]
          : [],
    );
    return [...previos, { rol: "usuario" as const, texto: nuevo }].slice(-60);
  }

  async function buscar(idA: number, historial: MensajeChat[]) {
    reemplazar(idA, { id: idA, rol: "asistente", estado: "cargando" });
    setAnuncio(t.buscando);
    // La última respuesta: el servidor junta su perfil con lo nuevo y le
    // recuerda al LLM qué ayudas ya se vieron.
    const previa = mensajes
      .flatMap((m) => (m.rol === "asistente" && m.estado === "ok" && m.id < idA ? [m.respuesta] : []))
      .at(-1);
    try {
      const res = await fetch(ruta("/api/chat"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mensajes: historial,
          perfil: previa?.perfil,
          ayudas: previa?.fichas.map((f) => f.id),
        }),
      });
      if (!res.ok || !res.body) {
        const datos = await res.json().catch(() => null);
        throw new Error(datos?.error ?? t.noHePodido);
      }
      // Llega una línea JSON por evento: fases y, al final, la respuesta.
      let respuesta: Respuesta | null = null;
      const pasos: Paso[] = [];
      let resto = "";
      const lector = res.body.pipeThrough(new TextDecoderStream()).getReader();
      for (let l = await lector.read(); !l.done; l = await lector.read()) {
        const lineas = (resto + l.value).split("\n");
        resto = lineas.pop()!;
        for (const linea of lineas.filter(Boolean)) {
          const e = JSON.parse(linea) as EventoChat;
          if ("respuesta" in e) respuesta = e.respuesta;
          else {
            if (pasos.at(-1) !== e.paso) pasos.push(e.paso);
            reemplazar(idA, { id: idA, rol: "asistente", estado: "cargando", pasos: [...pasos] });
            setAnuncio(`${t.paso[e.paso]}.`);
          }
        }
      }
      if (!respuesta) throw new Error(t.noHePodido);
      reemplazar(idA, { id: idA, rol: "asistente", estado: "ok", respuesta });
      const n = respuesta.fichas.length;
      // Una pregunta se lee en voz alta y el foco se queda en el cuadro de
      // texto, o va al formulario, para contestar sin moverse.
      if (n === 0 && respuesta.pregunta) {
        setAnuncio(
          respuesta.formulario.length > 1
            ? t.tePregunto
            : respuesta.pregunta,
        );
        return;
      }
      setAnuncio(t.encontrado(n));
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
            : t.noHePodidoReintenta,
      });
      setAnuncio(t.problema);
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
          aria-label={t.inicio}
          className="cursor-pointer rounded-lg"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ruta("/logo-akorda.png")}
            alt=""
            width={900}
            height={134}
            className="h-9 w-auto"
          />
        </button>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <p className="flex items-center gap-2 text-base text-(--text-secondary)">
            {t.actualizadas(fechaLarga(CATALOGO_ACTUALIZADO, idioma))}
          </p>
          <SelectorIdioma />
          {enChat && (
            <Button
              type="button"
              variant="outline"
              onClick={nueva}
              className="h-9 px-3 text-base"
            >
              <SquarePen aria-hidden="true" className="size-4" />
              {t.nueva}
            </Button>
          )}
        </div>
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
                {t.pregunta}
              </h1>
              <p className="text-xl leading-[1.5] text-(--text-secondary)">
                {t.subtitulo}
              </p>
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
                {t.tituloEjemplos}
              </h2>
              <ul>
                {t.ejemplos.map((ej) => (
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
            <h1 className="sr-only">{t.pregunta}</h1>
            <section
              aria-label={t.conversacion}
              className="mx-auto grid w-full max-w-[760px] flex-1 grid-cols-[minmax(0,1fr)] content-start gap-10 px-(--page-gutter) pt-6 pb-10"
            >
              {mensajes.map((m) =>
                m.rol === "usuario" ? (
                  <div
                    key={m.id}
                    ref={m.id === idUltimoUsuario ? ultimoUsuario : undefined}
                    className="aparece ml-auto max-w-[85%] scroll-mt-4 rounded-3xl bg-muted px-5 py-3 text-lg leading-[1.6] whitespace-pre-wrap [overflow-wrap:anywhere]"
                  >
                    <span className="sr-only">{t.tu}</span>
                    {m.texto}
                  </div>
                ) : (
                  <BurbujaAsistente
                    key={m.id}
                    m={m}
                    alPreguntar={preguntar}
                    alEnviar={enviar}
                    activa={m.id === mensajes.at(-1)?.id}
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
                    {t.aviso}
                  </a>
                  <Link
                    href="/declaracion-de-accesibilidad"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "h-auto min-h-12 px-5 py-2 text-lg",
                    )}
                  >
                    {t.accesibilidad}
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
              {t.pieza}{" "}
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
                {t.accesibilidad}
              </Link>
              <BotonAviso discreto />
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
