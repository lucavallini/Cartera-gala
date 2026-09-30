import { describe, expect, it } from "vitest";
import { ErrorProveedorExterno } from "../../src/compartido/errores";
import { leerFixture } from "../utilidades/http-falso";
import { crearProveedoresPrueba, URLS } from "../utilidades/proveedores-prueba";

describe("Data912Proveedor", () => {
  it("baja las cinco listas del mercado con precio y variación", async () => {
    const { cotizaciones, buscar } = crearProveedoresPrueba();
    const { valor, desactualizado } = await cotizaciones.listas();
    expect(desactualizado).toBe(false);
    const amzn = valor.CEDEARS.find((f) => f.simbolo === "AMZN");
    expect(amzn?.precio.toString()).toBe("2775");
    expect(amzn?.variacionPct?.toString()).toBe("-1.6");
    expect(valor.OBLIGACIONES.find((f) => f.simbolo === "YM39D")?.precio.toString()).toBe("110.2");
    expect(valor.LETRAS.find((f) => f.simbolo === "D30S6")?.precio.toString()).toBe("152300");
    expect(valor.BONOS.map((f) => f.simbolo)).toContain("AL30D");
    expect(buscar.llamadas).toHaveLength(5);
  });

  it("usa el promedio de compra y venta cuando no hubo operaciones y descarta filas sin precio", async () => {
    const { cotizaciones } = crearProveedoresPrueba({
      rutasExtra: {
        [URLS.acciones]: {
          json: [
            { symbol: "SINCIERRE", c: 0, px_bid: 100, px_ask: 110, pct_change: null },
            { symbol: "VACIO", c: 0, px_bid: 0, px_ask: 0, pct_change: 0 },
          ],
        },
      },
    });
    const { valor } = await cotizaciones.listas();
    expect(valor.ACCIONES.map((f) => [f.simbolo, f.precio.toString(), f.variacionPct])).toEqual([
      ["SINCIERRE", "105", null],
    ]);
  });

  it("histórico: devuelve los cierres diarios, y lista vacía cuando data912 no tiene el ticker", async () => {
    const { cotizaciones } = crearProveedoresPrueba();
    const amzn = await cotizaciones.historico("CEDEARS", "AMZN");
    expect(amzn.valor.at(-1)).toMatchObject({ fecha: "2026-09-25" });
    expect(amzn.valor.at(-1)?.cierre.toString()).toBe("2820");
    expect((await cotizaciones.historico("ACCIONES", "YPFD")).valor).toEqual([]);
  });

  it("histórico: aunque data912 mande los días desordenados, salen de la más vieja a la más nueva", async () => {
    const desordenado = [
      ...(leerFixture("data912-historico-cedears-AMZN.json") as unknown[]),
    ].reverse();
    const { cotizaciones } = crearProveedoresPrueba({
      rutasExtra: { [URLS.historicoAmzn]: { json: desordenado } },
    });
    const fechas = (await cotizaciones.historico("CEDEARS", "AMZN")).valor.map((p) => p.fecha);
    expect(fechas).toEqual([...fechas].sort());
    expect(fechas.at(-1)).toBe("2026-09-25");
  });

  it("histórico: las familias sin histórico no consultan la red", async () => {
    const { cotizaciones, buscar } = crearProveedoresPrueba();
    expect((await cotizaciones.historico("OBLIGACIONES", "YM39O")).valor).toEqual([]);
    expect(buscar.llamadas).toHaveLength(0);
  });

  it("si falla una sola lista, usa las demás y avisa que los datos pueden estar desactualizados", async () => {
    const { cotizaciones } = crearProveedoresPrueba({
      rutasExtra: { [URLS.letras]: new Error("socket hang up") },
    });
    const { valor, desactualizado } = await cotizaciones.listas();
    expect(desactualizado).toBe(true);
    expect(valor.LETRAS).toEqual([]);
    expect(valor.CEDEARS.length).toBeGreaterThan(0);
  });

  it("si no responde ninguna lista y no hay datos previos, falla con un mensaje llano", async () => {
    const caido = new Error("socket hang up");
    const { cotizaciones } = crearProveedoresPrueba({
      rutasExtra: {
        [URLS.acciones]: caido,
        [URLS.cedears]: caido,
        [URLS.bonos]: caido,
        [URLS.obligaciones]: caido,
        [URLS.letras]: caido,
      },
    });
    const error = await cotizaciones.listas().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorProveedorExterno);
    expect((error as Error).message).toBe(
      "No pudimos obtener los precios del mercado. Probá de nuevo en unos minutos.",
    );
  });
});
