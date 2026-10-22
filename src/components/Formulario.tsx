"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIdioma } from "@/components/Idioma";
import type { Idioma } from "@/lib/idioma";
import { TEXTO_PREGUNTA } from "@/lib/llm/pregunta";
import type { CampoFormulario } from "@/lib/tipos";

// Todo lo que falta se pregunta a la vez. Las respuestas se mandan como una
// frase normal («Tengo 34 años. Vivo de alquiler.»): así pasan por la misma
// lectura y validación que lo que se escribe a mano. En valenciano, las frases
// van en valenciano: el LLM las lee igual.

type Opcion = { etiqueta: string; frase: string };

// Las preguntas en castellano son las del servidor, que las usa para no
// repetirlas.
const PREGUNTA: Record<Idioma, Record<CampoFormulario, string>> = {
  es: TEXTO_PREGUNTA,
  va: {
    necesidad: "Què necessites? Per exemple, pagar el lloguer, la llum o els llibres de l'escola.",
    edad: "Quants anys tens?",
    municipio: "En quin municipi vius?",
    situacionLaboral: "Treballes ara o estàs a l'atur?",
    vivienda: "Vius de lloguer, en una casa teua o d'una altra manera?",
    hijos: "Tens fills? Quants?",
    ingresos: "Quants diners entren a casa teua cada mes, més o menys?",
    pension: "Cobres alguna pensió?",
    discapacidad: "Tens alguna discapacitat?",
  },
};

// Los campos con respuestas cerradas: una frase por opción que lleva a uno de
// los valores de OPCIONES (lib/llm/pregunta.ts).
const RESPUESTAS_ES: Partial<Record<CampoFormulario, Opcion[]>> = {
  situacionLaboral: [
    { etiqueta: "En paro", frase: "Estoy en paro." },
    { etiqueta: "Se me acabó el paro", frase: "Se me ha acabado el paro." },
    { etiqueta: "Trabajo", frase: "Estoy trabajando." },
    { etiqueta: "Autónomo/a", frase: "Trabajo como autónomo/a." },
    { etiqueta: "Jubilado/a", frase: "Estoy jubilado/a." },
    { etiqueta: "Estudio", frase: "Estoy estudiando." },
    { etiqueta: "Otra", frase: "Mi situación de trabajo es otra." },
  ],
  vivienda: [
    { etiqueta: "De alquiler", frase: "Vivo de alquiler." },
    { etiqueta: "En una habitación", frase: "Vivo en una habitación alquilada." },
    { etiqueta: "En una casa mía", frase: "Vivo en una casa de mi propiedad." },
    { etiqueta: "Otra", frase: "Vivo de otra forma." },
  ],
  hijos: [
    { etiqueta: "No", frase: "No tengo hijos." },
    { etiqueta: "1", frase: "Tengo 1 hijo." },
    { etiqueta: "2", frase: "Tengo 2 hijos." },
    { etiqueta: "3 o más", frase: "Tengo 3 hijos o más." },
  ],
  ingresos: [
    { etiqueta: "Ninguno", frase: "No tengo ingresos." },
    { etiqueta: "Bajos", frase: "Mis ingresos son bajos." },
    { etiqueta: "Medios", frase: "Mis ingresos son medios." },
    { etiqueta: "Altos", frase: "Mis ingresos son altos." },
  ],
  pension: [
    { etiqueta: "Sí", frase: "Cobro una pensión." },
    { etiqueta: "No", frase: "No cobro ninguna pensión." },
  ],
  discapacidad: [
    { etiqueta: "Sí", frase: "Tengo una discapacidad." },
    { etiqueta: "No", frase: "No tengo ninguna discapacidad." },
  ],
};

const RESPUESTAS: Record<Idioma, Partial<Record<CampoFormulario, Opcion[]>>> = {
  es: RESPUESTAS_ES,
  va: {
    situacionLaboral: [
      { etiqueta: "A l'atur", frase: "Estic a l'atur." },
      { etiqueta: "Se m'ha acabat l'atur", frase: "Se m'ha acabat l'atur." },
      { etiqueta: "Treballe", frase: "Estic treballant." },
      { etiqueta: "Autònom/a", frase: "Treballe com a autònom/a." },
      { etiqueta: "Jubilat/ada", frase: "Estic jubilat/ada." },
      { etiqueta: "Estudie", frase: "Estic estudiant." },
      { etiqueta: "Una altra", frase: "La meua situació de treball és una altra." },
    ],
    vivienda: [
      { etiqueta: "De lloguer", frase: "Visc de lloguer." },
      { etiqueta: "En una habitació", frase: "Visc en una habitació llogada." },
      { etiqueta: "En una casa meua", frase: "Visc en una casa de la meua propietat." },
      { etiqueta: "Una altra", frase: "Visc d'una altra manera." },
    ],
    hijos: [
      { etiqueta: "No", frase: "No tinc fills." },
      { etiqueta: "1", frase: "Tinc 1 fill." },
      { etiqueta: "2", frase: "Tinc 2 fills." },
      { etiqueta: "3 o més", frase: "Tinc 3 fills o més." },
    ],
    ingresos: [
      { etiqueta: "Cap", frase: "No tinc ingressos." },
      { etiqueta: "Baixos", frase: "Els meus ingressos són baixos." },
      { etiqueta: "Mitjans", frase: "Els meus ingressos són mitjans." },
      { etiqueta: "Alts", frase: "Els meus ingressos són alts." },
    ],
    pension: [
      { etiqueta: "Sí", frase: "Cobre una pensió." },
      { etiqueta: "No", frase: "No cobre cap pensió." },
    ],
    discapacidad: [
      { etiqueta: "Sí", frase: "Tinc una discapacitat." },
      { etiqueta: "No", frase: "No tinc cap discapacitat." },
    ],
  },
};

// Los campos de texto libre: cómo se convierte lo escrito en frase.
const punto = (v: string) => (/[.!?]$/.test(v) ? v : `${v}.`);
const FRASE: Record<Idioma, Partial<Record<CampoFormulario, (v: string) => string>>> = {
  es: {
    necesidad: punto,
    municipio: (v) => `Vivo en ${v}.`,
    edad: (v) => `Tengo ${v} años.`,
  },
  va: {
    necesidad: punto,
    municipio: (v) => `Visc a ${v}.`,
    edad: (v) => `Tinc ${v} anys.`,
  },
};

const TEXTOS = {
  es: {
    enviar: "Enviar respuestas",
    ayuda: "Contesta solo lo que quieras. También puedes escribirlo abajo.",
  },
  va: {
    enviar: "Enviar respostes",
    ayuda: "Contesta només el que vulgues. També ho pots escriure a baix.",
  },
};

export function Formulario({
  id,
  campos,
  alEnviar,
  enfocar,
}: {
  id: number;
  campos: CampoFormulario[];
  alEnviar: (texto: string) => void;
  enfocar: boolean;
}) {
  const idioma = useIdioma();
  const [valores, setValores] = useState<Partial<Record<CampoFormulario, string>>>({});
  const formulario = useRef<HTMLFormElement>(null);
  const poner = (c: CampoFormulario, v: string) => setValores((vs) => ({ ...vs, [c]: v }));

  // Cuando el formulario es toda la respuesta, el foco va a su primer campo,
  // salvo que la persona ya esté escribiendo en otro sitio.
  useEffect(() => {
    if (!enfocar) return;
    const activo = document.activeElement;
    const cuadro = document.getElementById("situacion") as HTMLTextAreaElement | null;
    if (activo && activo !== document.body && !(activo === cuadro && !cuadro.value.trim())) return;
    formulario.current?.querySelector<HTMLElement>("input")?.focus({ preventScroll: true });
  }, [enfocar]);

  const frases = campos.flatMap((c) => {
    const v = valores[c]?.trim();
    if (!v) return [];
    return [RESPUESTAS[idioma][c] ? v : FRASE[idioma][c]!(v)];
  });

  return (
    <form
      ref={formulario}
      onSubmit={(e) => {
        e.preventDefault();
        if (frases.length) alEnviar(frases.join(" "));
      }}
      className="grid gap-6"
    >
      {campos.map((c) => {
        const nombre = `${c}-${id}`;
        const opciones = RESPUESTAS[idioma][c];
        return opciones ? (
          <fieldset key={c} className="grid gap-2">
            <legend className="mb-2 font-medium">{PREGUNTA[idioma][c]}</legend>
            <div className="flex flex-wrap gap-2">
              {opciones.map((o) => (
                <label
                  key={o.etiqueta}
                  className="flex min-h-11 cursor-pointer items-center rounded-full border border-(--text-secondary) px-4 text-base transition-colors hover:bg-muted has-checked:border-foreground has-checked:bg-foreground has-checked:text-background has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-foreground"
                >
                  <input
                    type="radio"
                    name={nombre}
                    value={o.frase}
                    checked={valores[c] === o.frase}
                    onChange={() => poner(c, o.frase)}
                    className="sr-only"
                  />
                  {o.etiqueta}
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <div key={c} className="grid gap-2">
            <label htmlFor={nombre} className="font-medium">
              {PREGUNTA[idioma][c]}
            </label>
            <Input
              id={nombre}
              type={c === "edad" ? "number" : "text"}
              inputMode={c === "edad" ? "numeric" : undefined}
              min={c === "edad" ? 0 : undefined}
              max={c === "edad" ? 120 : undefined}
              maxLength={c === "edad" ? undefined : 200}
              value={valores[c] ?? ""}
              onChange={(e) => poner(c, e.target.value)}
              autoComplete="off"
              className="h-12 max-w-md rounded-xl border-(--text-secondary) px-4 text-lg md:text-lg"
            />
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button
          type="submit"
          disabled={frases.length === 0}
          className="h-auto min-h-12 px-5 py-2 text-lg"
        >
          {TEXTOS[idioma].enviar}
        </Button>
        <p className="text-base text-(--text-secondary)">
          {TEXTOS[idioma].ayuda}
        </p>
      </div>
    </form>
  );
}
