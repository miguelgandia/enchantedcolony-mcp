// Lo que tiene que ser verdad de la versión retirada, comprobado como lo
// comprueba un cliente: arrancando `dist/index.js` y hablándole por stdio.
//
// Se ataca el servidor construido y no el módulo, a propósito. Lo que R240
// exige no es que una función devuelva un objeto: es que **un cliente que se
// conecte reciba el aviso**, y entre las dos cosas está el registro de
// capacidades del SDK, que es justamente donde se puede perder (sin declarar
// `tools`, un cliente no llama a `tools/call` y el aviso no llega nunca).
//
// Sin dependencias: `node --test` y un cliente JSON-RPC de veinte líneas, como
// el `scripts/smoke.mjs` que esto sustituye. Aquel llamaba a la web real para
// ver hilos vivos; ya no hay hilos vivos que ver, y lo que hay que comprobar es
// lo contrario: que no se llama a nadie.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

let proc;
let buf = "";
let n = 0;
const esperando = new Map();

function llamar(method, params = {}) {
  return new Promise((ok, mal) => {
    const id = ++n;
    esperando.set(id, ok);
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    // `unref`: el reloj de espera no debe mantener vivo el proceso de pruebas.
    setTimeout(() => { if (esperando.delete(id)) mal(new Error(`sin respuesta a ${method}`)); }, 10_000).unref();
  });
}

before(async () => {
  proc = spawn(process.execPath, ["dist/index.js"], { cwd: raiz, stdio: ["pipe", "pipe", "inherit"] });
  proc.stdout.on("data", (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const linea = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!linea) continue;
      try {
        const m = JSON.parse(linea);
        if (m.id !== undefined && esperando.has(m.id)) { esperando.get(m.id)(m); esperando.delete(m.id); }
      } catch { /* ruido */ }
    }
  });
});

after(() => proc?.kill());

let init;

test("initialize: el aviso en prosa, los dos idiomas, la fecha y los dos enlaces", async () => {
  init = await llamar("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  const ins = init.result.instructions;
  assert.match(ins, /Este servidor está retirado/);
  assert.match(ins, /This server is retired/);
  assert.match(ins, /7 de septiembre de 2026/);
  assert.match(ins, /2026-09-07/);
  assert.match(ins, /https:\/\/enchantedcolony\.com\/problemas\//);
  assert.match(ins, /https:\/\/enchantedcolony\.com\/api\//);
  // Que no vuelve, no que está caído: es lo que separa el aviso de una caída.
  assert.match(ins, /No hay versión nueva/);
  assert.match(ins, /no longer public/);
});

test("initialize: el nombre de siempre y la versión de package.json", () => {
  // El nombre se queda: cambiarlo rompería las configuraciones ya escritas, que
  // es lo contrario de lo que la retirada busca.
  assert.equal(init.result.serverInfo.name, "enchantedcolony");
  // 0.1.5 se publicó con un `VERSION = "0.1.3"` dentro. Esto lo impide.
  assert.equal(init.result.serverInfo.version, pkg.version);
  assert.equal(pkg.version, "1.0.0");
  // Sin la capacidad `tools`, un cliente no llama y el aviso no llega.
  assert.ok(init.result.capabilities.tools);
});

test("tools/list: la lista vacía — el esquema viejo ya no se sirve", async () => {
  const r = await llamar("tools/list");
  assert.deepEqual(r.result.tools, []);
});

test("tools/call: cualquier nombre viejo recibe el aviso, no un fallo", async () => {
  for (const nombre of ["list_threads", "get_thread", "get_neighbor", "register", "answer_challenge", "post", "stance", "me", "remember_key"]) {
    const r = await llamar("tools/call", { name: nombre, arguments: { id: "lo-que-sea" } });
    assert.equal(r.error, undefined, `${nombre} contestó con un error de protocolo, que el modelo no llega a leer`);
    assert.equal(r.result.isError, true, nombre);
    const cuerpo = JSON.parse(r.result.content[0].text);
    assert.equal(cuerpo.error.code, "gone");
    assert.equal(cuerpo.retired.since, "2026-09-07");
    assert.equal(cuerpo.retired.replacement, null);
    assert.ok("replacement" in cuerpo.retired, "replacement tiene que estar, explícito");
    assert.equal(cuerpo.retired.endpoint, `mcp:enchantedcolony-mcp/${nombre}`);
    assert.equal(cuerpo.retired.see, "https://enchantedcolony.com/problemas/");
    assert.equal(cuerpo.retired.docs, "https://enchantedcolony.com/api/");
    // Los cuatro hechos, en los dos idiomas.
    for (const c of ["message", "message_en"]) assert.match(cuerpo.error[c], /2026|septiembre/);
    for (const c of ["served", "served_en", "why", "why_en"]) assert.ok(cuerpo.retired[c].length > 20, c);
    assert.match(cuerpo.retired.why, /no hay versión nueva de este extremo/);
    assert.match(cuerpo.retired.why_en, /not an outage/);
  }
});

test("tools/call: un nombre que nunca existió recibe lo mismo", async () => {
  const r = await llamar("tools/call", { name: "lo_que_sea", arguments: {} });
  assert.equal(r.result.isError, true);
  const cuerpo = JSON.parse(r.result.content[0].text);
  assert.equal(cuerpo.error.code, "gone");
  assert.equal(cuerpo.retired.endpoint, "mcp:enchantedcolony-mcp/lo_que_sea");
});

test("el aviso no devuelve nada del producto viejo, ni los argumentos", async () => {
  const r = await llamar("tools/call", {
    name: "post",
    arguments: { thread_id: "2026-08-27-22-un-hilo-de-verdad", body: "EL CUERPO DE UN POST", api_key: "ec_secreta" },
  });
  const texto = r.result.content[0].text;
  for (const filtrado of ["2026-08-27-22", "EL CUERPO DE UN POST", "ec_secreta", "thread_id"]) {
    assert.ok(!texto.includes(filtrado), `el aviso repite «${filtrado}», que es contenido del producto retirado`);
  }
});

test("un nombre desmesurado no se devuelve entero", async () => {
  const r = await llamar("tools/call", { name: "x".repeat(5000), arguments: {} });
  const cuerpo = JSON.parse(r.result.content[0].text);
  assert.ok(cuerpo.retired.endpoint.length < 120, "el nombre lo pone el cliente: se acota");
});

/** El código del archivo construido, sin las líneas de comentario: el aviso
 *  explica de dónde viene y nombra el motor y la API viejos, y eso es prosa,
 *  no una llamada. Lo que se afirma abajo es sobre lo que se ejecuta. */
function codigo(archivo) {
  return readFileSync(new URL(`../dist/${archivo}`, import.meta.url), "utf8")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join("\n");
}

test("el servidor ya no habla con nadie ni toca el disco", () => {
  const fuente = codigo("index.js") + "\n" + codigo("retirada.js");
  for (const prohibido of ["fetch(", "node:fs", "node:os", "node:path", "fly.dev", "/api/v0", "EC_API_KEY", "homedir", "registerTool"]) {
    assert.ok(!fuente.includes(prohibido), `queda «${prohibido}» en el servidor construido`);
  }
  // Lo que sí importa, y nada más: el SDK y su propio aviso.
  const imports = [...fuente.matchAll(/^import .*? from ["'](.+?)["']/gm)].map((m) => m[1]);
  assert.deepEqual(
    imports.filter((i) => !i.startsWith("@modelcontextprotocol/sdk/")),
    ["./retirada.js"],
  );
  assert.equal([...codigo("retirada.js").matchAll(/^import /gm)].length, 0, "el aviso es una función pura: no importa nada");
});
