# Track 1 · Buscador de ayudas

## El reto

El ciudadano cuenta su situación con sus palabras y la herramienta le dice a qué ayudas públicas (estatales, autonómicas y municipales) **podría optar** y dónde pedirlas. Hoy están repartidas entre administraciones y nadie te dice a cuáles puedes optar.

Puede haber hasta dos squads en este track, los dos con el mismo reto. Cada uno construye las piezas que le dé tiempo, en el orden que prefiera.

## Qué se espera en la demo

A partir de una descripción como «tengo 24 años, estoy en paro y vivo de alquiler en València», la herramienta devuelve varias ayudas con el motivo por el que encajan, los requisitos que hay que comprobar, su estado (abierta, cerrada o permanente) y el enlace oficial.

## Piezas

El reto se puede abordar por partes. Elegid las que os dé tiempo y en el orden que queráis.

| Pieza                 | Alcance en unas 4 h                                                                                                        | Hecho cuando…                                                                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ayudas para ti        | Del texto libre o de un perfil ficticio a las ayudas del catálogo que podrían encajar.                                     | Devuelve ayudas con el motivo, los requisitos que hay que comprobar, su estado y el enlace oficial; dice «podrías optar» y explica cuándo no hay coincidencias.         |
| Convocatorias en vivo | Consultar la API de la BDNS y mostrar las convocatorias del Estado y de la Comunitat Valenciana que encajan con el perfil. | Cada convocatoria enlaza a su ficha oficial y su estado sale de las fechas de la ficha, no del campo `abierto`; si la API no responde, usa la copia del pack y lo dice. |

## Materiales (`datos/`)

- `catalogo-tramites-ayudas.json`: 21 entradas (8 ayudas y 13 trámites) para ciudadanía residente en València. Cada entrada incluye `frases_usuario`, `requisitos_clave`, `pasos`, `documentacion`, `plazo`, `enlace_info`, `enlace_tramite`, `fuente` y `verificado`.
  - Ayudas incluidas: Ingreso Mínimo Vital, Renta Valenciana de Inclusión, complemento de ayuda para la infancia, subsidio por desempleo, bono social eléctrico, bono alquiler joven, ayudas de comedor escolar y Xarxa Llibres.
- `bdns-convocatorias-cv.json`: copia de respaldo de 59 convocatorias de la BDNS para personas físicas, recibidas entre el 1/07 y el 16/10/2026: 18 de la Generalitat, 17 del Ayuntamiento de València y 24 estatales de ámbito nacional. Cada una trae órgano, regiones, beneficiarios, finalidad, plazo tal como lo da la BDNS, bases, documentos y el enlace a su ficha oficial. Es para la demo si falla la red: la fuente viva es la API.
  - La copia no usa los nombres de la ficha en vivo. Equivalencias (copia → API): `numeroBDNS` → `codigoBDNS`, `titulo` → `descripcion`, `tituloLenguaCooficial` → `descripcionLeng`, `finalidad` → `descripcionFinalidad`, `tiposBeneficiario` → `tiposBeneficiarios`, `basesReguladoras` → `descripcionBasesReguladoras` y `urlBasesReguladoras`, `publicacionesDiarioOficial` → `anuncios`, `fondosUE` → `fondos`, y `plazoSolicitud` → `abierto`, `fechaInicioSolicitud`, `fechaFinSolicitud`, `textInicio` y `textFin` (en la copia, `textoInicio` y `textoFin`). En la copia, `regiones`, `tiposBeneficiario` e `instrumentos` son listas de textos; en la API, objetos con `descripcion`. Pasad las dos a la misma forma antes de mostrar nada.

## API de la BDNS: llamadas probadas

Base `https://www.infosubvenciones.es/bdnstrans/api`, todo GET, sin clave y en JSON; especificación en [snpsap-api.json](https://www.infosubvenciones.es/bdnstrans/estaticos/doc/snpsap-api.json). La API no envía cabeceras CORS: llamadla desde una ruta de servidor (`src/app/api/…`), no desde el navegador. Probadas el 18/10/2026:

| Llamada                                                                                                                                                                     | Para qué                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `/convocatorias/busqueda?vpd=GE&page=0&pageSize=50&order=fechaRecepcion&direccion=desc&tiposBeneficiario=1&fechaDesde=01/07/2026&tipoAdministracion=A&regiones=54,55,56,57` | Convocatorias de la Generalitat para personas físicas                                                                         |
| `…/busqueda?…&tipoAdministracion=C`                                                                                                                                         | Convocatorias del Estado                                                                                                      |
| `…/busqueda?…&tipoAdministracion=L&organos=2903`                                                                                                                            | Convocatorias del Ayuntamiento de València                                                                                    |
| `/convocatorias?vpd=GE&numConv=<número BDNS>`                                                                                                                               | Ficha completa: plazo, regiones, beneficiarios, bases y documentos                                                            |
| `/regiones?vpd=GE` · `/beneficiarios?vpd=GE` · `/finalidades?vpd=GE`                                                                                                        | Catálogos: 54 es la Comunitat Valenciana y 55–57 sus provincias; beneficiario 1 son personas físicas; finalidad 8 es vivienda |
| `/organos/codigo?codigo=<DIR3>`                                                                                                                                             | Pasa un código DIR3 a su id de órgano en la BDNS (`L01462508` → 2903)                                                         |

La ficha pública de cada convocatoria es `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/<número BDNS>`. Hay que citar «Origen de los datos: Intervención General de la Administración del Estado» con la fecha de consulta ([aviso legal](https://www.infosubvenciones.es/bdnstrans/GE/es/avisolegal)).

## Fuentes oficiales

| Fuente                                                                                                                             | Qué ofrece                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [API BDNS (Swagger)](https://www.infosubvenciones.es/bdnstrans/doc/swagger)                                                        | Todas las convocatorias públicas de España (Estado, CCAA y entidades locales). JSON, sin clave. Base: `https://www.infosubvenciones.es/bdnstrans/api`                                                                       |
| [Buenas prácticas de la API](https://www.infosubvenciones.es/bdnstrans/estaticos/ayuda/Buenas%20pr%C3%A1cticas%20API%20SNPSAP.pdf) | Guía oficial de uso de la API de la BDNS                                                                                                                                                                                    |
| [Portal del IMV](https://imv.seg-social.es/)                                                                                       | Portal oficial del Ingreso Mínimo Vital, de la Seguridad Social                                                                                                                                                             |
| [Dades Obertes GVA](https://dadesobertes.gva.es/es/dataset)                                                                        | Datos abiertos de la Generalitat, con API CKAN. No hay un dataset de convocatorias abiertas: `eco-gvo-subv-2026` recoge ayudas **concedidas** con el nombre de cada beneficiario: no lo uséis, porque trae datos personales |

## A tener en cuenta

- La BDNS dice qué convocatorias existen, no si una persona cumple los requisitos: «podrías optar; revisa las bases», nunca «tienes derecho».
- Hay que comprobar las fechas: muchas convocatorias están cerradas. El bono alquiler joven 2026 de la GVA cerró el 11/09/2026 (DOGV n.º 10434); el banco de libros sigue abierto hasta el 10/11/2026.
- Las 21 entradas del catálogo están comprobadas en la sede, el BOE o el DOGV a 18/10/2026.
- La renta valenciana de inclusión cambia el 20/10/2026: la Ley 2/2026 sustituye a la Ley 19/2017 (edad mínima de 23 años, 15 meses de empadronamiento, silencio negativo). El catálogo ya recoge la ley nueva, pero la ficha 19152 de la sede todavía describe la anterior.
- La API de la BDNS es pública: conviene no hacer más de una petición por segundo. Como la búsqueda no trae plazos, cada resultado necesita su ficha: en la demo, limitad la consulta a unas 10 fichas o guardadlas en memoria mientras corre la herramienta (son datos públicos, no del usuario).
- Las ayudas por la DANA de 2024 quedan fuera del pack. Si alguien pregunta por ellas, la herramienta lo dice y remite a la sede de la Generalitat (`https://sede.gva.es`), sin inventar convocatorias.
- Trampas de la BDNS: el campo `abierto` solo significa «plazo indefinido»; `regiones` no es jerárquico (algunas convocatorias de València solo llevan «ES - ESPAÑA», por eso el Ayuntamiento se busca por órgano); una convocatoria estatal puede limitarse a otras comunidades; la búsqueda no trae plazos, así que cada resultado necesita su ficha; y «concesión directa - instrumental» suele querer decir que la ciudadanía no puede solicitarla.

## Perfiles de prueba

- Joven de 24 años en paro, de alquiler en València, sin hijos.
- Madre autónoma con 2 hijos en Castelló, ingresos bajos.
- Jubilado de 70 años en un pueblo de la Safor, pensión mínima, factura de la luz alta.
- Familia con 3 hijos en edad escolar en València.

Dos perfiles prueban los huecos del pack. Castelló y la Safor no tienen ayudas municipales en el pack, que solo trae las del Ayuntamiento de València. La copia de la BDNS tampoco trae ayudas para autónomos (`tiposBeneficiario=3`), aunque las del catálogo sí pueden aplicarse a la madre. En esos casos, la herramienta dice qué no ha podido consultar y no da la lista por completa.

## Resumen para el agente

```markdown
# Track 1 · Buscador de ayudas · Build night · BARRACA x SOTI

Objetivo: a partir del texto libre de un ciudadano, indicar a qué ayudas públicas podría optar, por qué, qué requisitos debe comprobar, su estado y el enlace oficial.
Datos: datos/catalogo-tramites-ayudas.json (entradas con tipo "ayuda"), API BDNS https://www.infosubvenciones.es/bdnstrans/api (llamadas probadas en SETUP.md; el plazo sale de la ficha /convocatorias?vpd=GE&numConv=N, nunca del campo abierto) y datos/bdns-convocatorias-cv.json como respaldo sin red (con otros nombres de campo: ver Materiales). La API se llama desde el servidor, no desde el navegador.
Reglas: decir "podrías optar", nunca "tienes derecho"; no inventar importes, plazos ni requisitos; citar siempre el enlace oficial; no guardar datos del usuario; claves solo en servidor; la herramienta se sirve bajo /<equipo> (campo `equipo` de ficha.json) y muestra el aviso "No es un servicio oficial".
```
