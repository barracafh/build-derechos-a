import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { ProveedorIdioma } from "@/components/Idioma";
import { COOKIE_IDIOMA, LANG, leerIdioma } from "@/lib/idioma";
import ficha from "../../ficha.json";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
// Sin preload: solo la usan etiquetas y datos pequeños.
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  preload: false,
});

export const metadata: Metadata = {
  title: ficha.nombre,
  description: ficha.frase,
  // Experimental: que no aparezca en buscadores como si fuera un servicio oficial.
  robots: { index: false, follow: false },
};

const TEXTOS = {
  es: {
    saltar: "Saltar al contenido",
    aviso: "Aviso",
    experimental: "Herramienta experimental. No es un servicio oficial.",
  },
  va: {
    saltar: "Saltar al contingut",
    aviso: "Avís",
    experimental: "Eina experimental. No és un servei oficial.",
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const idioma = leerIdioma((await cookies()).get(COOKIE_IDIOMA)?.value);
  const t = TEXTOS[idioma];
  return (
    <html lang={LANG[idioma]} className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        <a
          href="#contenido"
          className="fixed top-2 left-2 z-50 inline-flex min-h-12 -translate-y-[calc(100%+16px)] items-center rounded-xl bg-foreground px-4 text-lg font-medium text-background focus-visible:translate-y-0"
        >
          {t.saltar}
        </a>
        <aside aria-label={t.aviso} className="bg-muted px-(--page-gutter) py-2">
          <p className="mx-auto max-w-(--container-content) text-center text-base text-(--text-secondary)">
            {t.experimental}
          </p>
        </aside>
        <ProveedorIdioma inicial={idioma}>{children}</ProveedorIdioma>
      </body>
    </html>
  );
}
