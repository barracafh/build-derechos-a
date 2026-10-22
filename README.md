# Derechos · Buscador de ayudas públicas

Encuentra las ayudas a las que podrías optar contando tu situación con tus palabras. Proyecto del equipo **derechos-a**, track 1 del Build night · BARRACA x SOTI.

**Demo:** https://build.barraca.house/derechos-a

> Herramienta experimental. No es un servicio oficial. Orienta sobre posibles ayudas; no confirma el derecho a recibirlas ni presenta solicitudes.

## El problema y para quién es

Las ayudas públicas están repartidas entre administraciones, sedes y convocatorias con lenguaje difícil de entender. Saber qué buscar exige conocer de antemano el nombre de la prestación y quién la gestiona. Derechos está pensado para personas que necesitan orientación sobre vivienda, empleo, familia o necesidades básicas, sin tener que conocer ese mapa administrativo.

## Qué hemos hecho

- Un chat que recoge la situación de la persona, permite corregir lo entendido y hace preguntas para afinar la búsqueda. Por ejemplo: «Tengo 24 años, estoy en paro y vivo de alquiler en València».
- Una búsqueda que combina un catálogo de prestaciones con convocatorias de la **BDNS en directo**, rentas mínimas autonómicas y datos extraídos de páginas oficiales. Consulta los niveles estatal, autonómico y local según la ubicación y los organismos disponibles; no supone una cobertura completa de España.
- Fichas con el motivo por el que una ayuda podría encajar, requisitos que comprobar, estado del plazo y enlaces oficiales. Cuando hay información disponible, incluyen importe, documentación y pasos para solicitarla. Los plazos se calculan a partir de las fechas y el texto de la ficha, no solo del indicador `abierto` de la BDNS.
- Respuestas que explican hasta dónde se ha consultado, qué falta por mirar y cuándo se usa una copia de respaldo si falla la BDNS. Los datos extraídos automáticamente se señalan como pendientes de revisión.
- Interfaz en castellano y valenciano, textos orientados a lectura fácil, controles de teclado, declaración de accesibilidad y botón para avisar de errores.
- Pruebas automatizadas de plazos, territorio, selección de ayudas, conversación y filtros de ámbito. También hay un proceso de indexación de fuentes oficiales y un workflow nocturno configurado para actualizar sus datos.

La IA interpreta la conversación y selecciona identificadores de ayudas; las fichas se construyen con los datos del catálogo y de las herramientas de consulta, no con enlaces o importes inventados por el modelo.

## Qué falta para producción

Ampliar y auditar la cobertura territorial y de prestaciones; revisar con especialistas los requisitos, importes y cambios normativos; validar los textos de lectura fácil con sus destinatarios; y realizar una auditoría de accesibilidad. También hay que probar el servicio con carga y fallos de proveedores, reforzar los límites de uso y cerrar la evaluación de privacidad y las condiciones del proveedor de IA. Una coincidencia orientativa nunca sustituye la comprobación de las bases oficiales.

## Datos y privacidad

Se usan datos públicos de ayudas, no expedientes ni datos personales de beneficiarios. Para la demo, utiliza perfiles ficticios: no introduzcas DNI, contraseñas, datos bancarios ni expedientes reales.

La aplicación no guarda conversaciones en una base de datos ni registra su texto en logs. El historial se conserva en `sessionStorage` para sobrevivir a una recarga de la pestaña y se puede borrar al iniciar una nueva conversación. Para responder, los mensajes se envían al servidor y al proveedor de IA HelmCode: no es un procesamiento exclusivamente local.

Las fuentes y los enlaces concretos se muestran en cada ficha. La consulta de convocatorias usa la BDNS, con origen en la Intervención General de la Administración del Estado. El material inicial está en `datos/`; las ampliaciones y los datos de indexación, en `src/datos/`.

## Arrancar

Con Bun y Node 22 o superior, dentro del repo de vuestro equipo:

```sh
bun install --frozen-lockfile
bun run dev
```

Abre http://localhost:3000/derechos-a. Configura en `.env.local` (nunca se sube al repositorio):

```dotenv
HELMCODE_API_KEY=tu_clave
HELMCODE_MODEL=glm5.3-flash
```

`HELMCODE_BASE_URL` es opcional si se usa un endpoint distinto. Las llamadas de IA y BDNS se hacen desde el servidor; ninguna clave lleva el prefijo `NEXT_PUBLIC_`.

```sh
bun run test
bun run typecheck
bun run build
```

La app usa Next.js (App Router), React, Tailwind y Bun. La entrada está en `src/app/page.tsx`, el chat en `src/components/Chat.tsx`, la ruta de servidor en `src/app/api/chat/route.ts` y la lógica en `src/lib/llm/`, `src/lib/motor/` y `src/lib/ayudas/`.

Las reglas del proyecto están en [AGENTS.md](AGENTS.md); el reto y las limitaciones de las fuentes iniciales, en [SETUP.md](SETUP.md).

## Publicar

Cada push a `main` se publica solo en `https://build.barraca.house/<equipo>`. No hace falta entrar en Vercel: las claves ya están puestas en el proyecto. Si `bun run build` falla en local, tampoco se publicará.

## CLI del evento

`buildnight` revisa las seis reglas, entrega la ficha y enseña el tablón. Necesita `gh auth login`. En macOS o Linux:

```sh
curl -fsSL https://build.barraca.house/instalar.sh | sh
buildnight                          # vuestro expediente: equipo, track y cuenta atrás
buildnight observar                 # déjalo abierto: suma vuestros tokens al ranking
```

`observar` cuenta los tokens de Claude Code, Codex y Pi en este proyecto durante el build. La primera vez te pide confirmar tu cuenta en GitHub; no da acceso a nada.

En Windows, descarga `buildnight-windows-x64.exe` de la [última release](https://github.com/barracafh/build-comite/releases/latest).

## Ficha y entrega

`ficha.json` describe la herramienta: nombre, frase, icono, track (`herramienta`), equipo, URL pública y fuentes. `datos` indica `simulados` o datos públicos `reales`, nunca personales. No cambiéis `equipo`: de él sale la ruta.

```sh
buildnight ficha validar
buildnight revisar
```

Antes de revisar, añadid a Git los archivos nuevos que formen parte de la entrega, sin incluir claves ni datos personales. Hasta que la herramienta esté publicada, la regla de URL pública fallará; las otras cinco deben pasar. La revisión analiza archivos versionados; no acredita la exactitud del contenido.

Publicar la web no registra la entrega. Cuando esté lista y revisada, el comando de entrega es:

```sh
buildnight registrar
```

El contrato es `apps/cli/esquemas/ficha.schema.json` en el monorepo del evento. Conservad `.buildnight/plantilla.json`.

## Diseño

Todas las herramientas usan Sol, el sistema visual de [Reforma Digital](https://reforma-digital.es), con el OK de Samu: los tokens de `src/styles/tema.css`, Geist y Geist Mono servidas por `next/font` desde el propio sitio, Georgia en los titulares y las primitivas de shadcn/ui con Base UI de `src/components/ui/`. `src/app/page.tsx` enseña cómo se compone una respuesta. Las reglas están en [AGENTS.md](AGENTS.md#diseño); el origen y la licencia, en [AVISO.md](AVISO.md).

Para añadir componentes: `bunx shadcn@4.22.1 add <componente>`. Responded **no** si pide sobrescribir componentes existentes, para conservar variantes como `sunset`. No uséis `--overwrite` ni `shadcn init`. Subid también los cambios de `package.json` y `bun.lock`.

Referencias: [basePath de Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath), [Tailwind con Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs) y [shadcn/ui con Base UI](https://ui.shadcn.com/docs).
