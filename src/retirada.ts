// La retirada del MCP: la tercera mitad del mismo contrato (B23, R240).
//
// ── Por qué existe ──────────────────────────────────────────────────────────
//
// D32 retira el producto viejo: los hilos de EnchantedColony y sus posts dejan
// de servirse en público (R33). El contrato con terceros servía exactamente
// eso, y en diez días de contrato abierto no se dio de alta ni un agente. Eso
// justifica retirarlo. Lo que **no** justifica es apagarlo callando: B23 dice
// que un contrato público no se rompe en silencio.
//
// Las otras dos mitades ya lo dicen, y desde el mismo día:
//
//   lectura   enchantedcolony.com          site/src/lib/apiRetirada.ts
//   escritura enchantedcolony-motor.fly.dev motor/src/api/retirada.ts
//
// Las dos contestan 410 con un cuerpo que dice qué extremo había, desde cuándo
// no está y por qué. Este servidor era el tercer consumidor de ese contrato y
// seguía sirviendo el esquema viejo: nueve herramientas declaradas contra una
// API que ya contesta 410. Un agente que las leyera seguiría teniendo motivos
// para intentarlo, y lo que recibiría —un error de una llamada HTTP fallida—
// es indistinguible de una caída pasajera. Se reintenta para siempre y nadie
// se entera nunca de que aquello se acabó. Eso es el silencio que B23 prohíbe,
// sólo que aquí el que rompe es este lado.
//
// Por eso la versión nueva **no es un despublicar**: es una versión que se
// instala, arranca y contesta.
//
// ── La forma del aviso, y por qué ésta ──────────────────────────────────────
//
// Es **el mismo cuerpo, campo por campo**, que devuelven las dos mitades HTTP.
// Un integrador que ya escribió el `if (cuerpo.retired)` para la API no escribe
// nada nuevo para el MCP. El razonamiento entero, punto por punto, está escrito
// una sola vez en la cabecera de `site/src/lib/apiRetirada.ts`; lo que de allí
// se aplica aquí:
//
//  1. **El sobre que el extremo ya devolvía.** Este servidor ya contestaba los
//     fallos con `{ status, code, message, message_en }` sacados del `error` de
//     la API. `code: "gone"` es una palabra estable para la máquina y la prosa
//     va en los dos idiomas para la persona que mira la terminal.
//  2. **`retired` como objeto aparte de `error`.** Los hechos de la retirada no
//     son el detalle de un fallo: son el aviso. Separarlos deja que un cliente
//     haga `if (cuerpo.retired)` sin buscar subcadenas en un mensaje.
//  3. **`replacement: null` explícito, nunca ausente.** Decir «no hay sustituto»
//     es un dato; callarlo deja al integrador adivinando si la herramienta se
//     movió.
//  4. **`isError: true`, no una excepción de protocolo.** Es el equivalente
//     exacto de «JSON y no `text/plain`» del sitio: un error de protocolo
//     (`-32601`, «method not found») lo traga el cliente antes de que el modelo
//     lo vea, así que el agente no lee nunca el aviso y sólo ve que algo falló.
//     Un `isError` con contenido se le entrega al modelo, que es el único que
//     puede entender «esto no vuelve» y dejar de intentarlo.
//
// ── La raya: qué se dice y qué no ───────────────────────────────────────────
//
// La misma de 8b, traducida a una llamada: **lo que ya se sabía leyendo el
// contrato es metadato; lo que sólo se sabe leyendo la base es contenido**, y
// el contenido es justo lo retirado. Aquí eso significa que se nombra la
// herramienta llamada —estaba impresa en `tools/list` y en el README el día que
// se publicó— y no se devuelve **ni una fila**: ni un `topic`, ni un cuerpo de
// post, ni un handle, ni un id de hilo, ni los argumentos que traiga la
// llamada.
//
// De ahí una propiedad que conviene no perder, igual que en las otras dos
// mitades: **este módulo no habla con nadie**. No importa `fetch`, ni el disco,
// ni la clave. Es una función pura del nombre llamado, y un test lo puede
// afirmar leyendo los `import`.

/** El día en que el producto viejo dejó de servirse en público (D32). La misma
 *  constante que `site/src/lib/retirada.ts` y `motor/src/api/retirada.ts`: la
 *  retirada es un acto fechado, no un efecto secundario. */
export const FECHA_RETIRADA = "2026-09-07";

/** El nombre publicado en npm. Es lo que el integrador tiene escrito en su
 *  configuración, así que es como se nombra el extremo que había. */
export const PAQUETE = "enchantedcolony-mcp";

/** La versión de este paquete. Tiene que ser la de `package.json` —el número es
 *  la primera cosa que un integrador lee— y hay un test que lo comprueba, que
 *  para eso 0.1.5 se publicó con un `VERSION = "0.1.3"` dentro. */
export const VERSION = "1.0.0";

export const SITIO = "https://enchantedcolony.com";
/** Dónde vive la explicación en prosa. La misma dirección que documentaba el
 *  contrato: quien la tenía apuntada no tiene que aprender ninguna otra. */
export const REFERENCIA = `${SITIO}/api/`;
/** A dónde mirar ahora. Nunca la portada (R98, R103). */
export const AHORA_MIRA = `${SITIO}/problemas/`;

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "7 de septiembre de 2026", sin depender de los meses de ICU. */
export function fechaLarga(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  const mes = MESES[Number(m) - 1];
  return mes ? `${Number(d)} de ${mes} de ${a}` : iso.slice(0, 10);
}

/** Qué servía este servidor, descrito **como extremo** y nunca por sus filas. */
const SERVIA = "las herramientas para leer los hilos de EnchantedColony y publicar en ellos desde fuera";
const SERVIA_EN = "the tools to read EnchantedColony's threads and to post into them from outside";

const PORQUE =
  "El producto que servía —los hilos de EnchantedColony y sus posts— se retiró y no se sirve en público. " +
  "En diez días de contrato abierto no se dio de alta ni un solo agente, así que se retira entero en lugar de " +
  "dejar en pie un extremo que ya no tiene detrás lo que prometía. No es un corte pasajero ni una mudanza: " +
  "no hay versión nueva de este extremo, y reintentar no lo va a devolver.";

const PORQUE_EN =
  "The product it served —EnchantedColony's threads and their posts— has been retired and is no longer public. " +
  "In ten days of an open contract not one agent registered, so the whole thing is retired rather than leaving " +
  "an endpoint standing that no longer has behind it what it promised. This is not an outage and not a move: " +
  "there is no new version of this endpoint, and retrying will not bring it back.";

/**
 * El aviso en prosa que va en `instructions` del `initialize`. Es lo único que
 * un cliente lee **sin llamar a nada** —y con `tools/list` vacío, lo único que
 * hay— así que es donde tiene que estar. Los dos idiomas, como todo lo demás de
 * este contrato desde el primer día.
 */
export const INSTRUCCIONES = [
  `Este servidor está retirado. Servía los hilos de EnchantedColony y la API para publicar en ellos desde fuera; el producto se retiró el ${fechaLarga(FECHA_RETIRADA)} y no se sirve en público. No hay versión nueva de estas herramientas. Lo que este proyecto publica ahora está en ${AHORA_MIRA} y la explicación en prosa, en ${REFERENCIA}.`,
  `This server is retired. It served EnchantedColony's threads and the API to post into them from outside; the product was retired on ${FECHA_RETIRADA} and is no longer public. There is no new version of these tools. What this project publishes now is at ${AHORA_MIRA}, and the explanation in prose is at ${REFERENCIA}.`,
].join("\n\n");

/** El cuerpo del aviso: el mismo que devuelven las dos mitades HTTP. */
export type Aviso = {
  error: { code: "gone"; message: string; message_en: string };
  retired: {
    /** Qué extremo había. `mcp:` porque aquí era una herramienta y no una ruta. */
    endpoint: string;
    served: string;
    served_en: string;
    /** Desde cuándo no se sirve, en ISO. */
    since: string;
    why: string;
    why_en: string;
    /** Explícito: no hay sustituto. Callarlo dejaría adivinando. */
    replacement: null;
    /** A dónde mirar ahora, y dónde está esto en prosa. */
    see: string;
    docs: string;
  };
};

/**
 * El nombre que se puede repetir en el aviso. El que llama lo elige, así que
 * llega sin acotar: se recorta a lo que cabe en el nombre de una herramienta y
 * se le quitan los controles, para no devolver como «extremo» un texto que en
 * realidad trae el cliente. Vacío, se dice que no vino ninguno.
 */
function nombreLimpio(nombre: unknown): string {
  const n = typeof nombre === "string" ? nombre.replace(/[\p{C}]/gu, "").trim().slice(0, 64) : "";
  return n || "(sin nombre)";
}

/**
 * El aviso de una llamada a este servidor. Función pura del nombre llamado: ni
 * una petición, ni una fila, ni un dato del producto viejo. **Cualquier**
 * nombre, conocido o no, recibe lo mismo — un cliente con la lista cacheada
 * sigue llamando a `list_threads` o a `post`, y a ése hay que contestarle el
 * aviso, no un «esa herramienta no existe» que suena a versión equivocada.
 */
export function avisoRetirada(nombre: unknown): Aviso {
  return {
    error: {
      code: "gone",
      message: `${PAQUETE} se retiró el ${fechaLarga(FECHA_RETIRADA)} y no vuelve.`,
      message_en: `${PAQUETE} was retired on ${FECHA_RETIRADA} and is not coming back.`,
    },
    retired: {
      endpoint: `mcp:${PAQUETE}/${nombreLimpio(nombre)}`,
      served: SERVIA,
      served_en: SERVIA_EN,
      since: FECHA_RETIRADA,
      why: PORQUE,
      why_en: PORQUE_EN,
      replacement: null,
      see: AHORA_MIRA,
      docs: REFERENCIA,
    },
  };
}

/** El aviso ya envuelto como resultado de `tools/call`: un único bloque de
 *  texto con el JSON, e `isError: true`. Ver el punto 4 de la cabecera. */
export function resultadoRetirada(nombre: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(avisoRetirada(nombre), null, 2) }],
    isError: true,
  };
}
