import { describe, expect, it } from "vitest";
import { leerFixture } from "../utilidades/http-falso";
import { crearProveedoresPrueba, URLS } from "../utilidades/proveedores-prueba";

describe("DolarApiProveedor", () => {
  it("devuelve los dólares conocidos y descarta los que la app no usa", async () => {
    const { dolarActual } = crearProveedoresPrueba();
    const { valor } = await dolarActual.actuales();
    const mep = valor.find((d) => d.tipo === "MEP");
    expect(mep?.venta.toString()).toBe("1556.5");
    expect(mep?.actualizadoEn.toISOString()).toBe("2026-09-28T19:48:00.000Z");
    expect(valor.find((d) => d.tipo === "CCL")?.venta.toString()).toBe("1619.6");
    expect(valor.map((d) => d.tipo).sort()).toEqual([
      "BLUE",
      "CCL",
      "CRIPTO",
      "MAYORISTA",
      "MEP",
      "OFICIAL",
    ]);
  });

  it("una fecha inválida no rompe el resumen: se descarta esa fila, nunca Invalid Date", async () => {
    const fixtures = leerFixture("dolarapi-dolares.json") as Array<Record<string, unknown>>;
    const conFechaRota = fixtures.map((fila) =>
      fila.casa === "bolsa" ? { ...fila, fechaActualizacion: "no-es-una-fecha" } : fila,
    );
    const { dolarActual } = crearProveedoresPrueba({
      rutasExtra: { [URLS.dolares]: { json: conFechaRota } },
    });
    const { valor } = await dolarActual.actuales();
    for (const cotizacion of valor) {
      expect(Number.isNaN(cotizacion.actualizadoEn.getTime())).toBe(false);
    }
    expect(valor.find((d) => d.tipo === "MEP")).toBeUndefined();
    expect(valor.find((d) => d.tipo === "CCL")?.venta.toString()).toBe("1619.6");
  });
});

describe("ArgentinaDatosProveedor", () => {
  it("histórico del dólar MEP por fecha", async () => {
    const { argentinaDatos } = crearProveedoresPrueba();
    const { valor } = await argentinaDatos.historico("MEP");
    expect(valor.at(-1)).toMatchObject({ fecha: "2026-09-28" });
    expect(valor.at(-1)?.venta.toString()).toBe("1557.3");
  });

  it("histórico del dólar desordenado: sale de la fecha más vieja a la más nueva", async () => {
    const desordenado = [...(leerFixture("argentinadatos-bolsa.json") as unknown[])].reverse();
    const { argentinaDatos } = crearProveedoresPrueba({
      rutasExtra: { [URLS.mepHistorico]: { json: desordenado } },
    });
    const fechas = (await argentinaDatos.historico("MEP")).valor.map((p) => p.fecha);
    expect(fechas).toEqual([...fechas].sort());
    expect(fechas.at(-1)).toBe("2026-09-28");
  });

  it("feriados del año como lista de fechas", async () => {
    const { argentinaDatos } = crearProveedoresPrueba();
    const { valor } = await argentinaDatos.feriados(2026);
    expect(valor).toContain("2026-10-12");
    expect(valor).toHaveLength(19);
  });
});
