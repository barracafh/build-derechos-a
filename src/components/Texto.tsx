import type { ElementType } from "react";
import { cn } from "@/lib/utils";

// Texto en lenguaje sencillo. Los textos de src/datos/lectura-facil.ts marcan
// con **palabra** las palabras difíciles; mientras no haya glosario en pantalla,
// la marca se quita y la palabra sale como texto normal.
export function Texto({ children }: { children: string }) {
  return <>{children.replace(/\*\*(.+?)\*\*/g, "$1")}</>;
}

// Varias frases, cada una en su línea.
export function Lineas({
  lineas,
  className,
}: {
  lineas: string[];
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1", className)}>
      {lineas.map((l) => (
        <p key={l}>
          <Texto>{l}</Texto>
        </p>
      ))}
    </div>
  );
}

type Punto = { lineas: string[]; hijos: string[] };

// Una línea que empieza por «+ » sigue el punto anterior en otra línea.
// Una línea que empieza por dos espacios es un punto de la lista anterior.
function agrupar(items: string[]): Punto[] {
  const puntos: Punto[] = [];
  for (const it of items) {
    const ultimo = puntos[puntos.length - 1];
    if (it.startsWith("+ ") && ultimo) ultimo.lineas.push(it.slice(2));
    else if (it.startsWith("  ") && ultimo) ultimo.hijos.push(it.trim());
    else puntos.push({ lineas: [it], hijos: [] });
  }
  return puntos;
}

export function Lista({
  items,
  ordenada = false,
  className,
}: {
  items: string[];
  ordenada?: boolean;
  className?: string;
}) {
  const Etiqueta: ElementType = ordenada ? "ol" : "ul";
  return (
    <Etiqueta
      className={cn(
        "grid gap-3 pl-7",
        ordenada ? "list-decimal" : "list-disc",
        className,
      )}
    >
      {agrupar(items).map((p) => (
        <li key={p.lineas.join("|")} className="pl-1">
          {p.lineas.map((l) => (
            <p key={l}>
              <Texto>{l}</Texto>
            </p>
          ))}
          {p.hijos.length > 0 && (
            <ul className="mt-2 grid list-[circle] gap-2 pl-6">
              {p.hijos.map((h) => (
                <li key={h}>
                  <Texto>{h}</Texto>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </Etiqueta>
  );
}
