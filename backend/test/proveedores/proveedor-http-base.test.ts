import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ProveedorHttpBase,
  type OpcionesProveedorHttp,
} from "../../src/proveedores/http/proveedor-http-base";
import { ErrorProveedorExterno } from "../../src/compartido/errores";
import { crearBuscarFalso, type RespuestaFalsa } from "../utilidades/http-falso";

const URL = "https://ejemplo.com/datos";
const TTL = 60_000;

class ProveedorPrueba extends ProveedorHttpBase {
  protected readonly queSeObtiene = "los datos de prueba";
  traer(forzar = false) {
    return this.obtener(
      "datos",
      URL,
      TTL,
      (json) => z.object({ n: z.number() }).parse(json),
      forzar,
    );
  }
}

function crear(respuestas: RespuestaFalsa | RespuestaFalsa[], extra: OpcionesProveedorHttp = {}) {
  let reloj = new Date("2026-09-28T15:00:00Z");
  const registros: string[] = [];
  const buscar = crearBuscarFalso({ [URL]: respuestas });
  const proveedor = new ProveedorPrueba({
    buscar,
    ahora: () => reloj,
    registrar: (mensaje) => registros.push(mensaje),
    timeoutMs: 50,
    ...extra,
  });
  return {
    proveedor,
    buscar,
    registros,
    avanzar: (ms: number) => {
      reloj = new Date(reloj.getTime() + ms);
    },
  };
}

describe("ProveedorHttpBase", () => {
  it("guarda en caché mientras dura el TTL y vuelve a pedir después", async () => {
    const { proveedor, buscar, avanzar } = crear([{ json: { n: 1 } }, { json: { n: 2 } }]);
    expect((await proveedor.traer()).valor).toEqual({ n: 1 });
    expect((await proveedor.traer()).valor).toEqual({ n: 1 });
    expect(buscar.llamadas).toHaveLength(1);
    avanzar(TTL + 1);
    const nuevo = await proveedor.traer();
    expect(nuevo).toMatchObject({ valor: { n: 2 }, desactualizado: false });
    expect(buscar.llamadas).toHaveLength(2);
  });

  it("forzar ignora la caché", async () => {
    const { proveedor, buscar, avanzar } = crear([{ json: { n: 1 } }, { json: { n: 2 } }]);
    await proveedor.traer();
    // Pasado el piso de refresco forzado (M2): antes de eso, forzar no va a la red.
    avanzar(10_001);
    expect((await proveedor.traer(true)).valor).toEqual({ n: 2 });
    expect(buscar.llamadas).toHaveLength(2);
  });

  it("si la fuente falla, devuelve el último dato marcado como desactualizado y lo registra", async () => {
    const { proveedor, registros, avanzar } = crear([{ json: { n: 1 } }, { status: 503 }]);
    const primero = await proveedor.traer();
    avanzar(TTL + 1);
    const respaldo = await proveedor.traer();
    expect(respaldo).toEqual({
      valor: { n: 1 },
      obtenidoEn: primero.obtenidoEn,
      desactualizado: true,
    });
    expect(registros[0]).toContain("los datos de prueba");
  });

  it("sin datos previos, falla con un mensaje llano y guarda la causa técnica", async () => {
    const { proveedor } = crear(new Error("getaddrinfo ENOTFOUND ejemplo.com"));
    const error = await proveedor.traer().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorProveedorExterno);
    expect((error as ErrorProveedorExterno).message).toBe(
      "No pudimos obtener los datos de prueba. Probá de nuevo en unos minutos.",
    );
    expect(String((error as ErrorProveedorExterno).causa)).toContain("ENOTFOUND");
  });

  it("una respuesta con formato inesperado cuenta como falla", async () => {
    const { proveedor } = crear({ json: { otro: "formato" } });
    await expect(proveedor.traer()).rejects.toThrow(ErrorProveedorExterno);
  });

  it("corta por timeout y reintenta una vez", async () => {
    const lenta = (signal: AbortSignal) =>
      new Promise<unknown>((_resolver, rechazar) => {
        signal.addEventListener("abort", () => rechazar(new Error("abortado")));
      });
    const { proveedor, buscar } = crear([lenta, { json: { n: 7 } }]);
    expect((await proveedor.traer()).valor).toEqual({ n: 7 });
    expect(buscar.llamadas).toHaveLength(2);
  });

  it("pedidos simultáneos comparten una sola descarga", async () => {
    const { proveedor, buscar } = crear({ json: { n: 1 } });
    await Promise.all([proveedor.traer(), proveedor.traer(), proveedor.traer()]);
    expect(buscar.llamadas).toHaveLength(1);
  });

  it("forzar no vuelve a la red si el dato tiene menos de 10 segundos", async () => {
    const { proveedor, buscar, avanzar } = crear([{ json: { n: 1 } }, { json: { n: 2 } }]);
    await proveedor.traer();
    avanzar(9_000);
    expect(await proveedor.traer(true)).toMatchObject({ valor: { n: 1 }, desactualizado: false });
    expect(buscar.llamadas).toHaveLength(1);
    avanzar(1_001);
    expect((await proveedor.traer(true)).valor).toEqual({ n: 2 });
    expect(buscar.llamadas).toHaveLength(2);
  });

  it("tras una falla sin respaldo no vuelve a la red durante la espera: falla enseguida", async () => {
    const { proveedor, buscar, avanzar } = crear(new Error("ECONNREFUSED"));
    await expect(proveedor.traer()).rejects.toThrow(ErrorProveedorExterno);
    // 1 intento + 1 reintento (el valor por defecto).
    expect(buscar.llamadas).toHaveLength(2);
    const segundo = await proveedor.traer().catch((e: unknown) => e);
    expect(segundo).toBeInstanceOf(ErrorProveedorExterno);
    expect((segundo as ErrorProveedorExterno).message).toBe(
      "No pudimos obtener los datos de prueba. Probá de nuevo en unos minutos.",
    );
    // Forzar tampoco saltea la espera.
    await expect(proveedor.traer(true)).rejects.toThrow(ErrorProveedorExterno);
    expect(buscar.llamadas).toHaveLength(2);
    avanzar(TTL + 1);
    await expect(proveedor.traer()).rejects.toThrow(ErrorProveedorExterno);
    expect(buscar.llamadas).toHaveLength(4);
  });

  it("tras una falla con respaldo, durante la espera devuelve el último dato sin ir a la red", async () => {
    const caido = new Error("ECONNREFUSED");
    const { proveedor, buscar, avanzar } = crear([
      { json: { n: 1 } },
      caido,
      caido,
      { json: { n: 2 } },
    ]);
    await proveedor.traer();
    avanzar(TTL + 1);
    expect(await proveedor.traer()).toMatchObject({ valor: { n: 1 }, desactualizado: true });
    expect(buscar.llamadas).toHaveLength(3);
    expect(await proveedor.traer()).toMatchObject({ valor: { n: 1 }, desactualizado: true });
    expect(buscar.llamadas).toHaveLength(3);
    avanzar(TTL + 1);
    expect(await proveedor.traer()).toMatchObject({ valor: { n: 2 }, desactualizado: false });
    expect(buscar.llamadas).toHaveLength(4);
  });
});
