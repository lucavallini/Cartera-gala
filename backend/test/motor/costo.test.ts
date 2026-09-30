import { describe, expect, it } from "vitest";
import { Decimal } from "../../src/compartido/decimal";
import { estrategiaDeCosto } from "../../src/motor/costo/estrategia-costo";
import { enMoneda, escalar, importeDe, restar, sumar, sumarTodos } from "../../src/motor/importe";
import type { Importe, Lote } from "../../src/motor/tipos";

const d = (valor: string | number) => new Decimal(valor);
const importe = (ars: number, usd: number): Importe => ({ ars: d(ars), usd: d(usd) });
const texto = (i: Importe) => ({ ars: i.ars.toString(), usd: i.usd.toString() });

function lote(id: string, cantidad: number, costo: Importe): Lote {
  return { operacionId: id, fecha: new Date("2026-01-10T00:00:00Z"), cantidad: d(cantidad), costo };
}

const LOTES = [lote("a", 10, importe(1000, 10)), lote("b", 10, importe(2000, 16))];

describe("importes en pesos y dólares", () => {
  it("convierte según la moneda de la operación y el tipo de cambio", () => {
    expect(texto(importeDe(d(1500), "ARS", d(1500)))).toEqual({ ars: "1500", usd: "1" });
    expect(texto(importeDe(d(15), "USD_MEP", d(1500)))).toEqual({ ars: "22500", usd: "15" });
  });

  it("suma, resta, escala y elige la moneda", () => {
    expect(texto(sumar(importe(1, 2), importe(3, 4)))).toEqual({ ars: "4", usd: "6" });
    expect(texto(restar(importe(1, 2), importe(3, 4)))).toEqual({ ars: "-2", usd: "-2" });
    expect(texto(escalar(importe(10, 4), d("0.5")))).toEqual({ ars: "5", usd: "2" });
    expect(texto(sumarTodos([importe(1, 1), importe(2, 2), importe(3, 3)]))).toEqual({
      ars: "6",
      usd: "6",
    });
    expect(enMoneda(importe(10, 4), "ARS").toString()).toBe("10");
    expect(enMoneda(importe(10, 4), "USD_CCL").toString()).toBe("4");
  });
});

describe("precio promedio", () => {
  const ppp = estrategiaDeCosto("PRECIO_PROMEDIO");

  it("vender se lleva el costo promedio y deja el resto con el mismo promedio", () => {
    const { costoConsumido, restantes } = ppp.consumir(LOTES, d(5));
    expect(texto(costoConsumido)).toEqual({ ars: "750", usd: "6.5" });
    expect(restantes.map((l) => [l.operacionId, l.cantidad.toString(), texto(l.costo)])).toEqual([
      ["a", "7.5", { ars: "750", usd: "7.5" }],
      ["b", "7.5", { ars: "1500", usd: "12" }],
    ]);
  });

  it("vender todo no deja lotes", () => {
    const { costoConsumido, restantes } = ppp.consumir(LOTES, d(20));
    expect(texto(costoConsumido)).toEqual({ ars: "3000", usd: "26" });
    expect(restantes).toEqual([]);
  });

  it("vender en partes deja la cantidad y el costo exactos (lotes 1 y 2, vender 2)", () => {
    const lotes = [lote("a", 1, importe(1000, 1)), lote("b", 2, importe(3000, 2))];
    const { costoConsumido, restantes } = ppp.consumir(lotes, d(2));
    const cantidad = restantes.reduce((s, l) => s.plus(l.cantidad), d(0));
    expect(cantidad.toString()).toBe("1");
    const costoRestante = sumarTodos(restantes.map((l) => l.costo));
    expect(texto(sumar(costoRestante, costoConsumido))).toEqual({ ars: "4000", usd: "3" });
    // Lo que queda se puede vender entero.
    expect(ppp.consumir(restantes, cantidad).restantes).toEqual([]);
  });

  it("vender en partes deja exactamente lo que queda (lotes 1 y 5, vender 2)", () => {
    const lotes = [lote("a", 1, importe(100, 1)), lote("b", 5, importe(500, 5))];
    const { restantes } = ppp.consumir(lotes, d(2));
    expect(restantes.reduce((s, l) => s.plus(l.cantidad), d(0)).toString()).toBe("4");
    expect(ppp.consumir(restantes, d(4)).restantes).toEqual([]);
  });

  it("con 3 o más lotes la suma de lo que queda cierra exacta y vender todo no deja resto (C1)", () => {
    const lotes = [
      lote("a", 4, importe(400, 4)),
      lote("b", 7, importe(700, 7)),
      lote("c", 500, importe(50000, 500)),
    ];
    const { restantes } = ppp.consumir(lotes, d(7));
    const cantidad = restantes.reduce((s, l) => s.plus(l.cantidad), d(0));
    expect(cantidad.toString()).toBe("504");
    expect(ppp.consumir(restantes, d(504)).restantes).toEqual([]);
  });

  it("propiedad determinística: 2000 casos con 1 a 4 lotes y 3 ventas encadenadas (PPP y FIFO)", () => {
    // LCG (Lehmer/Park-Miller minimal standard) con semilla fija: mismo resultado en cada corrida.
    let semilla = 42;
    const siguiente = (): number => {
      semilla = (semilla * 16807) % 2147483647;
      return (semilla - 1) / 2147483646;
    };
    const entero = (min: number, max: number): number =>
      min + Math.floor(siguiente() * (max - min + 1));
    const costoAlAzar = (): number => Math.round(siguiente() * 100000 * 100) / 100;

    const fifo = estrategiaDeCosto("FIFO");

    for (let caso = 0; caso < 2000; caso++) {
      for (const estrategia of [ppp, fifo]) {
        const cantidadLotes = entero(1, 4);
        let lotes: Lote[] = [];
        for (let i = 0; i < cantidadLotes; i++) {
          lotes.push(lote(`l${i}`, entero(1, 1000), importe(costoAlAzar(), costoAlAzar())));
        }
        let total = lotes.reduce((s, l) => s.plus(l.cantidad), d(0));
        let costoAntes = sumarTodos(lotes.map((l) => l.costo));
        for (let venta = 0; venta < 3 && total.gt(0); venta++) {
          const cantidadVendida = d(entero(1, Math.max(1, total.toNumber())));
          const { costoConsumido, restantes } = estrategia.consumir(lotes, cantidadVendida);
          const restante = restantes.reduce((s, l) => s.plus(l.cantidad), d(0));
          expect(restante.eq(total.minus(cantidadVendida))).toBe(true);
          const costoRestante = sumarTodos(restantes.map((l) => l.costo));
          expect(sumar(costoRestante, costoConsumido).ars.eq(costoAntes.ars)).toBe(true);
          expect(sumar(costoRestante, costoConsumido).usd.eq(costoAntes.usd)).toBe(true);
          lotes = restantes;
          total = restante;
          costoAntes = costoRestante;
        }
        if (total.gt(0)) {
          expect(estrategia.consumir(lotes, total).restantes).toEqual([]);
        }
      }
    }
  });
});

describe("FIFO", () => {
  const fifo = estrategiaDeCosto("FIFO");

  it("vende primero lo más viejo", () => {
    const { costoConsumido, restantes } = fifo.consumir(LOTES, d(15));
    expect(texto(costoConsumido)).toEqual({ ars: "2000", usd: "18" });
    expect(restantes.map((l) => [l.operacionId, l.cantidad.toString(), texto(l.costo)])).toEqual([
      ["b", "5", { ars: "1000", usd: "8" }],
    ]);
  });

  it("vender todo no deja lotes y consume el costo total", () => {
    const { costoConsumido, restantes } = fifo.consumir(LOTES, d(20));
    expect(restantes).toEqual([]);
    expect(texto(costoConsumido)).toEqual({ ars: "3000", usd: "26" });
  });

  it("el lote vendido en parte conserva exactamente el costo que no se consumió", () => {
    // 1000 pesos a 3 pesos por dólar: el costo en dólares no tiene expresión exacta.
    const costo: Importe = { ars: d(1000), usd: d(1).div(3) };
    const lotes: Lote[] = [{ ...lote("a", 2, costo) }];
    const { costoConsumido, restantes } = fifo.consumir(lotes, d(1));
    expect(restantes.map((l) => l.cantidad.toString())).toEqual(["1"]);
    const costoRestante = restantes[0]?.costo ?? importe(0, 0);
    expect(costoRestante.usd.plus(costoConsumido.usd).eq(costo.usd)).toBe(true);
    expect(costoRestante.ars.plus(costoConsumido.ars).toString()).toBe("1000");
  });

  it("no modifica los lotes originales", () => {
    fifo.consumir(LOTES, d(15));
    expect(LOTES[0]?.cantidad.toString()).toBe("10");
  });
});
