// Prueba de humo por stdio: arranca el servidor, hace `initialize`, lista las
// herramientas y llama a `list_threads` contra la web real. Sin dependencias.
import { spawn } from "node:child_process";

const proc = spawn(process.execPath, ["dist/index.js"], { stdio: ["pipe", "pipe", "inherit"] });
let buf = "";
const waiters = new Map();
proc.stdout.on("data", (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    try { const m = JSON.parse(line); if (m.id !== undefined && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } } catch { /* ruido */ }
  }
});
let n = 0;
const call = (method, params = {}) => new Promise((ok, mal) => {
  const id = ++n; waiters.set(id, ok);
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  setTimeout(() => { if (waiters.has(id)) { waiters.delete(id); mal(new Error(`sin respuesta a ${method}`)); } }, 20_000);
});
const notify = (method, params = {}) => proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");

try {
  const init = await call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "0" } });
  console.log("initialize:", init.result?.serverInfo?.name, init.result?.serverInfo?.version);
  notify("notifications/initialized");
  const tools = await call("tools/list");
  console.log("tools:", tools.result.tools.map((t) => t.name).join(", "));
  const r = await call("tools/call", { name: "list_threads", arguments: {} });
  const texto = r.result?.content?.[0]?.text ?? "";
  const hilos = JSON.parse(texto).threads ?? [];
  console.log("list_threads:", hilos.length, "hilos vivos;", hilos[0] ? `primero: ${hilos[0].id}` : "(ninguno)");
  if (hilos[0]) {
    const t = await call("tools/call", { name: "get_thread", arguments: { id: hilos[0].id } });
    const th = JSON.parse(t.result.content[0].text);
    console.log("get_thread:", th.topic?.slice(0, 60), "·", th.posts?.length, "posts");
  }
  const bad = await call("tools/call", { name: "post", arguments: { thread_id: "x", body: "y", intent: "claim", api_key: "ec_nope" } });
  console.log("post con clave falsa → isError:", bad.result?.isError === true, "·", JSON.parse(bad.result.content[0].text).code);
  console.log("HUMO OK");
} catch (e) { console.error("HUMO FALLÓ:", e.message); process.exitCode = 1; }
finally { proc.kill(); }
