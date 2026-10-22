import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Lineas, Lista } from "@/components/Texto";
import { site } from "@/config/sitio";
import ficha from "../../../ficha.json";

export const metadata: Metadata = {
  title: `Declaración de accesibilidad · ${ficha.nombre}`,
};

// BORRADOR. Lo que está aquí es lo que sabemos hoy, sin adornos. Tiene que
// revisarlo la persona responsable antes de darlo por bueno.
//
// Datos que el equipo debe completar (si no se saben, la página lo dice):
const RESPONSABLE: string | null = null; // Persona o entidad responsable
const CONTACTO: string | null = null; // Correo o teléfono que no pida cuenta de GitHub
const FECHA = "22 de octubre de 2026"; // Fecha de preparación; cámbiala al revisar

const PENDIENTE = "Pendiente de indicar.";

const H2 = "font-sans text-2xl leading-[1.25] font-medium";

export default function DeclaracionDeAccesibilidad() {
  return (
    <main
      id="contenido"
      tabIndex={-1}
      className="mx-auto grid w-full max-w-[760px] gap-10 px-(--page-gutter) py-10 text-lg leading-[1.6] outline-none"
    >
      <div className="grid gap-5">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-auto min-h-12 w-fit px-5 py-2 text-lg",
          )}
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
          Volver al buscador
        </Link>
        <h1 className="font-sans text-[clamp(32px,5vw,44px)] leading-[1.15] font-medium">
          Declaración de accesibilidad
        </h1>
        <Lineas
          lineas={[
            `Esta declaración es del servicio ${ficha.nombre}.`,
            "Es un borrador. Todavía no es una declaración oficial.",
            `Fecha de preparación: ${FECHA}.`,
          ]}
        />
      </div>

      <section className="grid gap-3">
        <h2 className={H2}>Estado de cumplimiento</h2>
        <Lineas
          lineas={[
            "Todavía no hemos evaluado este servicio de forma completa.",
            "Por eso no podemos decir que cumple la norma.",
            "Tampoco podemos decir que no la cumple.",
          ]}
        />
        <p>
          La norma de referencia es el Real Decreto 1112/2018 y la norma
          UNE-EN 301549:2022. Pide un nivel parecido al nivel AA de las pautas
          WCAG 2.1.
        </p>
        <p>
          No sabemos todavía si esta norma se aplica a este servicio. Es una
          herramienta experimental y no es un servicio oficial. Aun así,
          intentamos cumplirla.
        </p>
      </section>

      <section className="grid gap-3">
        <h2 className={H2}>Lo que hemos hecho</h2>
        <Lista
          items={[
            "Hemos escrito los textos con frases cortas, una idea por línea y palabras sencillas. Seguimos las pautas de la norma UNE 153101 EX de lectura fácil.",
            "Hemos usado letra de 18 píxeles y un espacio entre líneas de más de 1,5.",
            "Hemos comprobado con una fórmula los contrastes de color de los textos y del foco.",
            "Se puede usar todo con el teclado. El foco se ve con un contorno negro.",
            "Los textos y los botones se ven bien al ampliar la página.",
            "Al recibir una respuesta, el lector de pantalla la anuncia y el foco va a su título.",
          ]}
        />
      </section>

      <section className="grid gap-3">
        <h2 className={H2}>Lo que no hemos hecho todavía</h2>
        <Lista
          items={[
            "No hemos probado el servicio con lectores de pantalla como NVDA, JAWS o VoiceOver.",
            "No hemos probado el servicio con personas con discapacidad.",
            "Los textos no están validados por personas con dificultades de comprensión lectora. La norma UNE 153101 EX pide esta validación para decir que un texto es de lectura fácil. Por eso los llamamos lenguaje sencillo.",
            "No explicamos las palabras difíciles en la pantalla. La norma UNE 153101 EX recomienda hacerlo.",
            "No usamos el logotipo europeo de lectura fácil, porque no tenemos esa validación.",
            "El apartado Texto oficial de cada ayuda no está en lectura fácil. Lo avisamos en su título.",
            "Los enlaces llevan a webs oficiales. No controlamos si esas webs son accesibles.",
            "No hemos medido el contraste del botón de enviar cuando pasas el ratón por encima.",
          ]}
        />
      </section>

      <section className="grid gap-3">
        <h2 className={H2}>Cómo hemos preparado esta declaración</h2>
        <Lineas
          lineas={[
            "Hemos hecho una autoevaluación del equipo.",
            "Hemos usado pruebas automáticas y el cálculo de contrastes.",
            "No ha habido una evaluación externa.",
          ]}
        />
      </section>

      <section className="grid gap-3">
        <h2 className={H2}>Contacto, quejas y sugerencias</h2>
        <p>
          Si algo no funciona o no se entiende, cuéntanoslo. También puedes
          pedirnos la información de otra forma.
        </p>
        <Lista
          items={[
            `Persona o entidad responsable: ${RESPONSABLE ?? PENDIENTE}`,
            `Contacto sin cuenta de GitHub: ${CONTACTO ?? PENDIENTE}`,
          ]}
        />
        <p>
          Ahora también puedes avisarnos en GitHub. Necesitas una cuenta de
          GitHub.
        </p>
        <div>
          <a
            href={site.feedbackUrl}
            className={cn(
              buttonVariants({ variant: "sunset", size: "lg" }),
              "h-auto min-h-12 px-5 py-2 text-lg",
            )}
          >
            ¿Algo está mal? Avísanos
          </a>
        </div>
        <p>
          Si no te contestamos o no estás de acuerdo con la respuesta, puedes
          presentar una reclamación ante la unidad responsable de accesibilidad
          de la administración competente.
        </p>
      </section>
    </main>
  );
}
