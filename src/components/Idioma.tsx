"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { COOKIE_IDIOMA, LANG, type Idioma } from "@/lib/idioma";

const Contexto = createContext<{ idioma: Idioma; cambiar: (i: Idioma) => void }>({
  idioma: "es",
  cambiar: () => {},
});

export const useIdioma = () => useContext(Contexto).idioma;

export function ProveedorIdioma({
  inicial,
  children,
}: {
  inicial: Idioma;
  children: ReactNode;
}) {
  const [idioma, setIdioma] = useState(inicial);
  const router = useRouter();
  function cambiar(i: Idioma) {
    setIdioma(i);
    document.documentElement.lang = LANG[i];
    // Solo en la ruta del equipo: el dominio lo comparten todas las herramientas.
    document.cookie = `${COOKIE_IDIOMA}=${i}; path=${process.env.NEXT_PUBLIC_BASE_PATH || "/"}; max-age=31536000; samesite=lax`;
    // El aviso de arriba lo pinta el layout en el servidor.
    router.refresh();
  }
  return <Contexto.Provider value={{ idioma, cambiar }}>{children}</Contexto.Provider>;
}

// Banderas dibujadas a mano: los emojis de bandera no se ven en Windows y la
// Senyera no tiene emoji. Son decorativas: el nombre del idioma va al lado.
function Bandera({ idioma }: { idioma: Idioma }) {
  return idioma === "es" ? (
    <svg aria-hidden="true" viewBox="0 0 12 8" className="h-4 w-6 shrink-0 rounded-[2px] ring-1 ring-foreground/15">
      <rect width="12" height="8" fill="#AA151B" />
      <rect y="2" width="12" height="4" fill="#F1BF00" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 12 8" className="h-4 w-6 shrink-0 rounded-[2px] ring-1 ring-foreground/15">
      <rect width="12" height="8" fill="#FCDD09" />
      {[1, 3, 5, 7].map((i) => (
        <rect key={i} y={(i * 8) / 9} width="12" height={8 / 9} fill="#DA121A" />
      ))}
      <rect width="3" height="8" fill="#0F47AF" />
      <rect x="3" width="0.4" height="8" fill="#DA121A" />
    </svg>
  );
}

const NOMBRE: Record<Idioma, string> = { es: "Castellano", va: "Valencià" };

export function SelectorIdioma() {
  const { idioma, cambiar } = useContext(Contexto);
  return (
    <div
      role="group"
      aria-label={idioma === "es" ? "Idioma" : "Llengua"}
      className="flex items-center gap-1"
    >
      {(["es", "va"] as const).map((i) => (
        <button
          key={i}
          type="button"
          lang={LANG[i]}
          aria-pressed={idioma === i}
          onClick={() => cambiar(i)}
          className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2 text-base transition-colors hover:bg-muted aria-pressed:border-(--text-secondary) aria-pressed:font-medium"
        >
          <Bandera idioma={i} />
          {NOMBRE[i]}
        </button>
      ))}
    </div>
  );
}
