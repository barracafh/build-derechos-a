import type { Mensaje } from "@/lib/ia";
import { elegirPregunta } from "@/lib/llm/pregunta";
import { hablaDeDana, perfilDeTexto } from "@/lib/llm/respaldo";
import {
  bloqueada,
  crearFicha,
  fichasDelCatalogo,
  noCubiertoPor,
  porEstado,
} from "@/lib/motor/catalogo";
import type { Cobertura, Ficha, MensajeChat, Perfil, Respuesta } from "@/lib/tipos";
import { construirMensajes, leerRespuesta } from "./perfil";

// Un segundo intento solo si el primero falla, tarda demasiado o no trae JSON.
export const INTENTOS = 2;

type Dependencias = {
  completar: (messages: Mensaje[]) => Promise<string>;
  hoy: Date;
  msPorIntento?: number;
};

function conLimite<T>(promesa: Promise<T>, ms: number): Promise<T> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    reloj = setTimeout(() => rechazar(new Error(`sin respuesta en ${ms} ms`)), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(reloj));
}

// Una conversación → una respuesta con las ayudas del catálogo. El LLM lee el
// texto y propone ayudas; el código valida cada cosa y monta las fichas. Si el
// LLM no responde bien, se lee el texto con reglas (respaldo.ts y motor/).
// No guarda ni registra nada de lo que escribe la persona.
export async function responder(
  mensajes: MensajeChat[],
  { completar, hoy, msPorIntento = 20_000 }: Dependencias,
): Promise<Respuesta> {
  const fechaConsulta = hoy.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  const delUsuario = mensajes.filter((m) => m.rol === "usuario");
  const ultimo = delUsuario.at(-1)!;

  // Las ayudas de la DANA no están en el catálogo: se remite a la sede.
  if (hablaDeDana(ultimo.texto))
    return {
      perfil: { hechos: [], necesidad: null },
      fichas: [],
      cobertura: {
        consultado: [],
        noConsultado: ["Ayudas por la DANA de 2024: míralas en https://sede.gva.es"],
        respaldo: true,
        fechaConsulta,
      },
      pregunta: null,
    };

  // En los registros, solo el error de HelmCode, nunca el texto de la persona.
  let lectura = null;
  for (let intento = 1; intento <= INTENTOS && !lectura; intento++) {
    try {
      const texto = await conLimite(completar(construirMensajes(mensajes)), msPorIntento);
      lectura = leerRespuesta(texto, mensajes);
      if (!lectura) console.error(`LLM, intento ${intento}: la respuesta no trae JSON`);
    } catch (error) {
      console.error(`LLM, intento ${intento}:`, (error as Error).message);
    }
  }

  let perfil: Perfil;
  let fichas: Ficha[];
  const noConsultado: string[] = [];
  if (lectura) {
    perfil = lectura.perfil;
    fichas = porEstado(
      lectura.elegidos
        .filter(({ id }) => !bloqueada(id, perfil))
        .map(({ id, citas }) =>
          crearFicha(id, perfil, citas.map((c) => `Dices: «${c}».`), [], hoy),
        ),
    );
  } else {
    perfil = perfilDeTexto(delUsuario.map((m) => m.texto).join("\n"));
    fichas = fichasDelCatalogo(perfil, hoy);
    noConsultado.push(
      "La lectura de tu mensaje con inteligencia artificial. No ha funcionado y he buscado palabras clave.",
    );
  }

  const cobertura: Cobertura = {
    consultado: [
      "Catálogo de trámites y ayudas (Estado, Generalitat y Ajuntament de València), a 18/10/2026",
    ],
    noConsultado: [...noConsultado, ...noCubiertoPor(perfil)],
    respaldo: true,
    fechaConsulta,
  };
  return { perfil, fichas, cobertura, pregunta: elegirPregunta(fichas, perfil) };
}
