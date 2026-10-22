"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TEXTO_PREGUNTA } from "@/lib/llm/pregunta";
import type { CampoFormulario } from "@/lib/tipos";

// Todo lo que falta se pregunta a la vez. Las respuestas se mandan como una
// frase normal («Tengo 34 años. Vivo de alquiler.»): así pasan por la misma
// lectura y validación que lo que se escribe a mano.

type Opcion = { etiqueta: string; frase: string };

// Los campos con respuestas cerradas: una frase por opción que lleva a uno de
// los valores de OPCIONES (lib/llm/pregunta.ts).
const RESPUESTAS: Partial<Record<CampoFormulario, Opcion[]>> = {
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

// Los campos de texto libre: cómo se convierte lo escrito en frase.
const FRASE: Partial<Record<CampoFormulario, (v: string) => string>> = {
  necesidad: (v) => (/[.!?]$/.test(v) ? v : `${v}.`),
  municipio: (v) => `Vivo en ${v}.`,
  edad: (v) => `Tengo ${v} años.`,
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
    return [RESPUESTAS[c] ? v : FRASE[c]!(v)];
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
        const opciones = RESPUESTAS[c];
        return opciones ? (
          <fieldset key={c} className="grid gap-2">
            <legend className="mb-2 font-medium">{TEXTO_PREGUNTA[c]}</legend>
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
              {TEXTO_PREGUNTA[c]}
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
          Enviar respuestas
        </Button>
        <p className="text-base text-(--text-secondary)">
          Contesta solo lo que quieras. También puedes escribirlo abajo.
        </p>
      </div>
    </form>
  );
}
