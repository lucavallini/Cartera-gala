import { describe, expect, it } from "vitest";
import { Decimal } from "../../../src/compartido/decimal";
import { redactarFrase } from "../../../src/modulos/resumen/redaccion";
import type { TotalesCartera } from "../../../src/motor/totales";

const d = (valor: string | number) => new Decimal(valor);
const imp = (ars: string | number, usd: string | number) => ({ ars: d(ars), usd: d(usd) });

function totales(datos: Partial<TotalesCartera>): TotalesCartera {
  const cero = imp(0, 0);
  return {
    valor: cero,
    valorPosiciones: cero,
    invertido: cero,
    noRealizado: cero,
    realizado: cero,
    cobros: cero,
    comisionesSueltas: cero,
    resultadoTotal: cero,
    costoHistorico: cero,
    variacionDiaria: cero,
    efectivo: null,
    rendimientoPct: { ars: null, usd: null },
    variacionDiariaPct: { ars: null, usd: null },
    ...datos,
  };
}

describe("frase de resumen", () => {
  const cartera = totales({
    valor: imp("74900000", "48320"),
    resultadoTotal: imp("4865000", "3140.4"),
    rendimientoPct: { ars: d("6.94"), usd: d("6.94") },
    variacionDiariaPct: { ars: d("-0.44"), usd: d("-0.44") },
  });

  it("en dólares, con el equivalente en pesos", () => {
    expect(redactarFrase(cartera, "USD", true, false)).toBe(
      "Tu cartera vale US$ 48.320 (≈ $ 74,9 M). Desde que empezaste ganaste US$ 3.140 (+6,9%). Hoy bajó 0,4%.",
    );
  });

  it("en pesos, y con el mercado cerrado habla de la última rueda", () => {
    expect(redactarFrase(cartera, "ARS", false, false)).toBe(
      "Tu cartera vale $ 74,9 M (≈ US$ 48.320). Desde que empezaste ganaste $ 4,9 M (+6,9%). En la última rueda bajó 0,4%.",
    );
  });

  it("dice perdiste cuando el resultado es negativo y omite lo que no se puede calcular", () => {
    const enRojo = totales({
      valor: imp(900, "0.9"),
      resultadoTotal: imp(-100, "-0.1"),
      rendimientoPct: { ars: d(-10), usd: d(-10) },
    });
    expect(redactarFrase(enRojo, "ARS", true, false)).toBe(
      "Tu cartera vale $ 900 (≈ US$ 1). Desde que empezaste perdiste $ 100 (-10,0%).",
    );
  });

  it("sin activos invita a empezar", () => {
    expect(redactarFrase(totales({}), "USD", true, true)).toBe(
      "Todavía no cargaste activos. Empezá con «Agregar activo que ya tengo».",
    );
  });
});
