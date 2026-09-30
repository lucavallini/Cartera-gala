import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BuscarHttp, RespuestaHttp } from "../../src/proveedores/http/proveedor-http-base";

const DIRECTORIO_FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
);

export function leerFixture(nombre: string): unknown {
  return JSON.parse(readFileSync(path.join(DIRECTORIO_FIXTURES, nombre), "utf8"));
}

/** Respuesta JSON, un status HTTP de error, una excepción de red o una función que espera. */
export type RespuestaFalsa =
  { json: unknown } | { status: number } | Error | ((signal: AbortSignal) => Promise<unknown>);

export interface BuscarFalso extends BuscarHttp {
  llamadas: string[];
}

/** `rutas` se busca por coincidencia exacta de URL; las URLs no listadas dan 404. */
export function crearBuscarFalso(
  rutas: Record<string, RespuestaFalsa | RespuestaFalsa[]>,
): BuscarFalso {
  const llamadas: string[] = [];
  const turnos = new Map<string, number>();
  const buscar = (async (url, init): Promise<RespuestaHttp> => {
    llamadas.push(url);
    const definida = rutas[url];
    const turno = turnos.get(url) ?? 0;
    turnos.set(url, turno + 1);
    const respuesta = Array.isArray(definida)
      ? definida[Math.min(turno, definida.length - 1)]
      : definida;
    if (respuesta === undefined) return { ok: false, status: 404, json: async () => ({}) };
    if (respuesta instanceof Error) throw respuesta;
    if (typeof respuesta === "function") {
      const json = await respuesta(init.signal);
      return { ok: true, status: 200, json: async () => json };
    }
    if ("status" in respuesta)
      return { ok: false, status: respuesta.status, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => respuesta.json };
  }) as BuscarFalso;
  buscar.llamadas = llamadas;
  return buscar;
}
