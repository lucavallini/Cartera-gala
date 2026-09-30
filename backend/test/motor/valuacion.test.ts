import { describe, expect, it } from "vitest";
import { estrategiaDeCosto } from "../../src/motor/costo/estrategia-costo";
import { crearRegistroManejadores } from "../../src/motor/operaciones/registro-manejadores";
import { reconstruir } from "../../src/motor/tenencia";
import { valuadorPara } from "../../src/motor/valuadores/fabrica";
import { totalizar } from "../../src/motor/totales";
import { ponderar } from "../../src/motor/ponderacion";
import type {
  EstadoCartera,
  Importe,
  OperacionMotor,
  Posicion,
  PrecioVigente,
} from "../../src/motor/tipos";
import { crearOperacion as op, d } from "../utilidades/operaciones-motor";

const DOLAR = d(1500);
const AHORA = new Date("2026-02-09T00:00:00Z");
const texto = (i: Importe) => ({ ars: i.ars.toString(), usd: i.usd.toString() });

function estadoDe(ops: OperacionMotor[]): EstadoCartera {
  return reconstruir(ops, estrategiaDeCosto("PRECIO_PROMEDIO"), crearRegistroManejadores());
}

function primera(estado: EstadoCartera): Posicion {
  const [posicion] = [...estado.posiciones.values()];
  if (!posicion) throw new Error("sin posición");
  return posicion;
}

function precio(
  porMoneda: PrecioVigente["porMoneda"],
  extra: Partial<PrecioVigente> = {},
): PrecioVigente {
  return {
    porMoneda,
    variacionPct: null,
    fuente: "MERCADO",
    actualizadoEn: AHORA,
    desactualizado: false,
    ...extra,
  };
}

const contexto = { dolar: DOLAR, ahora: AHORA, tasaAnual: null };

describe("valuador por cotización", () => {
  const valuador = valuadorPara("CEDEAR");

  it("un activo operado en pesos se valúa con su precio en pesos", () => {
    const posicion = primera(estadoDe([op("TENENCIA_INICIAL", { cantidad: 10, precio: 2000 })]));
    const valuacion = valuador.valuar(
      posicion,
      precio({ ARS: d(2775), USD_MEP: d("1.805") }, { variacionPct: d("-1.6") }),
      contexto,
    );
    expect(texto(valuacion.valor)).toEqual({ ars: "27750", usd: "18.5" });
    expect(valuacion.precio?.toString()).toBe("2775");
    expect(valuacion.variacionPct?.toString()).toBe("-1.6");
    expect(valuacion.fuente).toBe("MERCADO");
  });

  it("un activo operado en dólares se valúa con su precio en dólares", () => {
    const posicion = primera(
      estadoDe([op("TENENCIA_INICIAL", { cantidad: 72, precio: "1.5", moneda: "USD_MEP" })]),
    );
    const valuacion = valuador.valuar(
      posicion,
      precio({ ARS: d(2775), USD_MEP: d("1.805") }),
      contexto,
    );
    expect(texto(valuacion.valor)).toEqual({ ars: "194940", usd: "129.96" });
    expect(valuacion.precio?.toString()).toBe("1.805");
  });

  it("si no cotiza en su moneda, usa la otra convirtiendo con el dólar", () => {
    const posicion = primera(
      estadoDe([op("TENENCIA_INICIAL", { cantidad: 10, precio: 1, moneda: "USD_MEP" })]),
    );
    const valuacion = valuador.valuar(posicion, precio({ ARS: d(3000) }), contexto);
    expect(texto(valuacion.valor)).toEqual({ ars: "30000", usd: "20" });
    expect(valuacion.precio?.toString()).toBe("2");
  });

  it("la renta fija aplica el factor de 100 nominales", () => {
    const posicion = primera(
      estadoDe([
        op("TENENCIA_INICIAL", {
          ticker: "YM39O",
          instrumentoId: "i-ym39",
          cantidad: 344,
          precio: "109.3",
          moneda: "USD_MEP",
          factorPrecio: "0.01",
        }),
      ]),
    );
    const valuacion = valuadorPara("ON").valuar(
      posicion,
      precio({ USD_MEP: d("110.2") }),
      contexto,
    );
    expect(valuacion.valor.usd.toString()).toBe("379.088");
  });

  it("sin cotización se valúa al costo y se marca", () => {
    const posicion = primera(estadoDe([op("TENENCIA_INICIAL", { cantidad: 10, precio: 1000 })]));
    const valuacion = valuador.valuar(posicion, undefined, contexto);
    expect(valuacion).toMatchObject({ sinCotizacion: true, fuente: "COSTO", precio: null });
    expect(texto(valuacion.valor)).toEqual({ ars: "10000", usd: "10" });
  });

  it("respeta el precio manual como fuente", () => {
    const posicion = primera(estadoDe([op("TENENCIA_INICIAL", { cantidad: 10, precio: 1000 })]));
    const valuacion = valuador.valuar(
      posicion,
      precio({ ARS: d(1100) }, { fuente: "MANUAL" }),
      contexto,
    );
    expect(valuacion.fuente).toBe("MANUAL");
    expect(valuacion.valor.ars.toString()).toBe("11000");
  });
});

describe("valuador por devengamiento", () => {
  it("suma el interés de los días transcurridos con la tasa nominal anual", () => {
    const posicion = primera(
      estadoDe([
        op("TENENCIA_INICIAL", {
          ticker: "PF",
          instrumentoId: "i-pf",
          cantidad: 1,
          precio: 100000,
          fecha: "2026-01-10",
        }),
      ]),
    );
    const valuacion = valuadorPara("PLAZO_FIJO").valuar(posicion, undefined, {
      ...contexto,
      tasaAnual: d("36.5"),
    });
    expect(valuacion.valor.ars.toString()).toBe("103000");
    expect(valuacion.fuente).toBe("DEVENGADO");
  });
});

describe("totales", () => {
  it("suma valor, invertido, resultados y variación del día", () => {
    const estado = estadoDe([
      op("TENENCIA_INICIAL", { cantidad: 10, precio: 1000, tipoCambio: 1000 }),
      op("TENENCIA_INICIAL", {
        ticker: "VIEJO",
        instrumentoId: "i-viejo",
        cantidad: 5,
        precio: 1000,
        tipoCambio: 1000,
      }),
      op("VENTA", {
        ticker: "VIEJO",
        instrumentoId: "i-viejo",
        cantidad: 5,
        precio: 1200,
        tipoCambio: 1000,
        fecha: "2026-01-20",
      }),
      op("DIVIDENDO", { monto: 300, tipoCambio: 1000, fecha: "2026-01-25" }),
      op("COMISION", { instrumentoId: null, ticker: null, monto: 100, tipoCambio: 1000 }),
    ]);
    const valuadas = [...estado.posiciones.values()].map((posicion) => ({
      posicion,
      valuacion: valuadorPara("CEDEAR").valuar(
        posicion,
        posicion.ticker === "AMZN" ? precio({ ARS: d(1500) }, { variacionPct: d(25) }) : undefined,
        contexto,
      ),
    }));
    const totales = totalizar(valuadas, estado, DOLAR);
    expect(totales.valor.ars.toString()).toBe("15000");
    expect(totales.invertido.ars.toString()).toBe("10000");
    expect(totales.noRealizado.ars.toString()).toBe("5000");
    expect(totales.realizado.ars.toString()).toBe("1000");
    expect(totales.cobros.ars.toString()).toBe("300");
    expect(totales.resultadoTotal.ars.toString()).toBe("6200");
    expect(totales.costoHistorico.ars.toString()).toBe("15000");
    expect(totales.rendimientoPct.ars?.toFixed(4)).toBe("41.3333");
    expect(totales.variacionDiaria.ars.toString()).toBe("3000");
    expect(totales.variacionDiariaPct.ars?.toString()).toBe("25");
    expect(totales.efectivo).toBeNull();
  });

  it("el efectivo solo suma si se registran depósitos", () => {
    const estado = estadoDe([
      op("DEPOSITO", { instrumentoId: null, ticker: null, monto: 30, moneda: "USD_MEP" }),
    ]);
    const totales = totalizar([], estado, DOLAR);
    expect(totales.efectivo && texto(totales.efectivo)).toEqual({ ars: "45000", usd: "30" });
    expect(totales.valor.usd.toString()).toBe("30");
    expect(totales.rendimientoPct.ars).toBeNull();
  });
});

describe("ponderación", () => {
  it("agrupa por clave, ordena de mayor a menor y calcula el porcentaje", () => {
    const pesos = ponderar([
      { clave: "CEDEAR", etiqueta: "CEDEAR", valor: d(300) },
      { clave: "ON", etiqueta: "Obligación negociable", valor: d(600) },
      { clave: "CEDEAR", etiqueta: "CEDEAR", valor: d(100) },
      { clave: "VACIO", etiqueta: "Vacío", valor: d(0) },
    ]);
    expect(pesos.map((p) => [p.clave, p.valor.toString(), p.porcentaje.toString()])).toEqual([
      ["ON", "600", "60"],
      ["CEDEAR", "400", "40"],
    ]);
  });

  it("sin valores devuelve una lista vacía", () => {
    expect(ponderar([])).toEqual([]);
  });
});
