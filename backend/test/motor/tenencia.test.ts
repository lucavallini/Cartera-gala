import { describe, expect, it } from "vitest";
import { estrategiaDeCosto } from "../../src/motor/costo/estrategia-costo";
import { crearRegistroManejadores } from "../../src/motor/operaciones/registro-manejadores";
import { reconstruir } from "../../src/motor/tenencia";
import { cantidadDe, costoDe } from "../../src/motor/posicion";
import type { EstadoCartera, Importe, OperacionMotor } from "../../src/motor/tipos";
import { crearOperacion as op } from "../utilidades/operaciones-motor";

const registro = crearRegistroManejadores();
const ppp = estrategiaDeCosto("PRECIO_PROMEDIO");
const fifo = estrategiaDeCosto("FIFO");
const texto = (i: Importe) => ({ ars: i.ars.toString(), usd: i.usd.toString() });

function calcular(ops: OperacionMotor[], estrategia = ppp): EstadoCartera {
  return reconstruir(ops, estrategia, registro);
}

function unica(estado: EstadoCartera) {
  const [posicion] = [...estado.posiciones.values()];
  if (!posicion) throw new Error("sin posición");
  return posicion;
}

describe("tenencia inicial y compras", () => {
  it("la tenencia inicial suma el activo al costo y no mueve efectivo", () => {
    const estado = calcular([op("TENENCIA_INICIAL", { cantidad: 10, precio: 1000 })]);
    const posicion = unica(estado);
    expect(cantidadDe(posicion).toString()).toBe("10");
    expect(texto(costoDe(posicion))).toEqual({ ars: "10000", usd: "10" });
    expect(estado.efectivo.size).toBe(0);
    expect(estado.registraEfectivo).toBe(false);
  });

  it("la compra incluye los gastos en el costo y descuenta el efectivo", () => {
    const estado = calcular([op("COMPRA", { cantidad: 10, precio: 1000, gastos: 50 })]);
    expect(texto(costoDe(unica(estado)))).toEqual({ ars: "10050", usd: "10.05" });
    expect(estado.efectivo.get("ARS")?.toString()).toBe("-10050");
  });

  it("una compra en dólares se valúa en pesos con el tipo de cambio de ese día", () => {
    const estado = calcular([
      op("COMPRA", { cantidad: 10, precio: "1.5", moneda: "USD_MEP", tipoCambio: 1500 }),
    ]);
    expect(texto(costoDe(unica(estado)))).toEqual({ ars: "22500", usd: "15" });
    expect(unica(estado).monedaPrecio).toBe("USD_MEP");
  });

  it("la renta fija cotiza cada 100 nominales", () => {
    const estado = calcular([
      op("TENENCIA_INICIAL", {
        ticker: "AL30",
        instrumentoId: "i-al30",
        cantidad: 1000,
        precio: 83940,
        factorPrecio: "0.01",
      }),
    ]);
    expect(costoDe(unica(estado)).ars.toString()).toBe("839400");
  });
});

describe("ventas", () => {
  const historia = () => [
    op("TENENCIA_INICIAL", { cantidad: 10, precio: 1000, fecha: "2026-01-10" }),
    op("COMPRA", { cantidad: 10, precio: 2000, fecha: "2026-01-12" }),
    op("VENTA", { cantidad: 5, precio: 3000, fecha: "2026-01-15" }),
  ];

  it("con precio promedio, la ganancia usa el costo promedio", () => {
    const posicion = unica(calcular(historia()));
    expect(texto(posicion.realizado)).toEqual({ ars: "7500", usd: "7.5" });
    expect(cantidadDe(posicion).toString()).toBe("15");
  });

  it("con FIFO, la ganancia usa el costo de lo más viejo", () => {
    const posicion = unica(calcular(historia(), fifo));
    expect(texto(posicion.realizado)).toEqual({ ars: "10000", usd: "10" });
  });

  it("los gastos de la venta bajan lo cobrado", () => {
    const estado = calcular([
      op("TENENCIA_INICIAL", { cantidad: 10, precio: 1000 }),
      op("VENTA", { cantidad: 10, precio: 1000, gastos: 100, fecha: "2026-02-01" }),
    ]);
    expect(texto(unica(estado).realizado)).toEqual({ ars: "-100", usd: "-0.1" });
    expect(estado.efectivo.get("ARS")?.toString()).toBe("9900");
  });

  it("vender más de lo que se tenía se rechaza con fecha y cantidades", () => {
    expect(() =>
      calcular([
        op("TENENCIA_INICIAL", { cantidad: 10, precio: 1000 }),
        op("VENTA", { cantidad: 20, precio: 1000, fecha: "2026-01-15" }),
      ]),
    ).toThrow("El 15/01/2026 vendés 20 AMZN, pero en ese momento tenías 10.");
  });

  it("se aplica por fecha aunque la venta se haya cargado antes", () => {
    const venta = op("VENTA", { cantidad: 5, precio: 3000, fecha: "2026-02-01" });
    const compra = op("COMPRA", { cantidad: 10, precio: 1000, fecha: "2026-01-10" });
    expect(cantidadDe(unica(calcular([venta, compra]))).toString()).toBe("5");
  });

  it("el mismo día, la tenencia inicial va antes que una venta cargada primero", () => {
    const venta = op("VENTA", { cantidad: 5, precio: 1000, fecha: "2026-01-10" });
    const inicial = op("TENENCIA_INICIAL", { cantidad: 10, precio: 1000, fecha: "2026-01-10" });
    expect(cantidadDe(unica(calcular([venta, inicial]))).toString()).toBe("5");
  });
});

describe("cobros", () => {
  it("un dividendo suma a lo cobrado y al efectivo", () => {
    const estado = calcular([
      op("TENENCIA_INICIAL", { cantidad: 10, precio: 1000 }),
      op("DIVIDENDO", { monto: 500, fecha: "2026-03-01" }),
    ]);
    expect(texto(unica(estado).cobros)).toEqual({ ars: "500", usd: "0.5" });
    expect(estado.efectivo.get("ARS")?.toString()).toBe("500");
  });

  it("una amortización devuelve capital: baja lo invertido sin contar como ganancia", () => {
    const estado = calcular([
      op("TENENCIA_INICIAL", {
        ticker: "AL30",
        instrumentoId: "i-al30",
        cantidad: 1000,
        precio: 100,
        moneda: "USD_MEP",
        factorPrecio: "0.01",
      }),
      op("AMORTIZACION", {
        ticker: "AL30",
        instrumentoId: "i-al30",
        monto: 250,
        moneda: "USD_MEP",
        fecha: "2026-07-09",
      }),
    ]);
    const posicion = unica(estado);
    expect(texto(costoDe(posicion))).toEqual({ ars: "750000", usd: "750" });
    expect(texto(posicion.realizado)).toEqual({ ars: "0", usd: "0" });
    expect(estado.efectivo.get("USD_MEP")?.toString()).toBe("250");
  });

  it("una amortización de un activo que no se tenía se rechaza", () => {
    expect(() => calcular([op("AMORTIZACION", { monto: 10, fecha: "2026-03-01" })])).toThrow(
      "El 01/03/2026 registrás una amortización de AMZN, pero en ese momento no tenías ese activo.",
    );
  });
});

describe("efectivo y comisiones", () => {
  it("depósitos y extracciones activan el seguimiento del efectivo", () => {
    const estado = calcular([
      op("DEPOSITO", { instrumentoId: null, ticker: null, monto: 100000 }),
      op("EXTRACCION", { instrumentoId: null, ticker: null, monto: 30000, fecha: "2026-01-20" }),
    ]);
    expect(estado.registraEfectivo).toBe(true);
    expect(estado.efectivo.get("ARS")?.toString()).toBe("70000");
    expect(texto(estado.aportesNetos)).toEqual({ ars: "70000", usd: "70" });
  });

  it("una comisión sin activo es un gasto suelto; con activo, resta a su resultado", () => {
    const estado = calcular([
      op("TENENCIA_INICIAL", { cantidad: 10, precio: 1000 }),
      op("COMISION", { instrumentoId: null, ticker: null, monto: 200 }),
      op("COMISION", { monto: 50 }),
    ]);
    expect(texto(estado.comisionesSueltas)).toEqual({ ars: "200", usd: "0.2" });
    expect(texto(unica(estado).realizado)).toEqual({ ars: "-50", usd: "-0.05" });
    expect(estado.efectivo.get("ARS")?.toString()).toBe("-250");
  });
});

describe("validaciones en lenguaje llano", () => {
  it("los tipos de la etapa 2 todavía no se pueden registrar", () => {
    expect(() => calcular([op("SPLIT", { cantidad: 1 })])).toThrow(
      "Todavía no se pueden registrar operaciones de tipo «Split».",
    );
  });

  it("dice qué dato falta y en qué operación", () => {
    expect(() => calcular([op("COMPRA", { precio: 1000 })])).toThrow(
      "Falta la cantidad en la operación del 10/01/2026.",
    );
  });

  it("el registro describe los tipos disponibles", () => {
    const disponibles = registro.disponibles();
    expect(disponibles.map((t) => t.tipo)).toEqual([
      "TENENCIA_INICIAL",
      "COMPRA",
      "VENTA",
      "DIVIDENDO",
      "RENTA",
      "AMORTIZACION",
      "DEPOSITO",
      "EXTRACCION",
      "COMISION",
    ]);
    expect(disponibles[0]).toEqual({
      tipo: "TENENCIA_INICIAL",
      texto: "Tenencia inicial",
      descripcion:
        "Un activo que ya tenías, con su cantidad y su precio promedio de compra. No mueve efectivo.",
    });
  });
});
