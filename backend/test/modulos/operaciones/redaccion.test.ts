import { describe, expect, it } from "vitest";
import { Decimal } from "../../../src/compartido/decimal";
import {
  describirOperacion,
  describirSimulacion,
  formatearPrecio,
} from "../../../src/modulos/operaciones/redaccion";
import type { FotoPosicion } from "../../../src/motor/simulacion";

const d = (valor: string | number) => new Decimal(valor);

function foto(
  cantidad: number,
  costoArs: number,
  costoUsd: number,
  moneda: FotoPosicion["monedaPrecio"] = "ARS",
): FotoPosicion {
  return {
    ticker: "AMZN",
    cantidad: d(cantidad),
    costo: { ars: d(costoArs), usd: d(costoUsd) },
    monedaPrecio: moneda,
    factorPrecio: d(1),
  };
}

describe("redacción de operaciones", () => {
  it("los precios chicos llevan más decimales", () => {
    expect(formatearPrecio(d(2785), "ARS")).toBe("$ 2.785,00");
    expect(formatearPrecio(d("1.805"), "USD_MEP")).toBe("US$ 1,8050");
  });

  it("describe cada tipo en una frase", () => {
    const base = {
      ticker: "AMZN",
      cantidad: d(100),
      precio: d(2785),
      monto: null,
      moneda: "ARS" as const,
    };
    expect(describirOperacion({ ...base, tipo: "COMPRA" })).toBe("Compra de 100 AMZN a $ 2.785,00");
    expect(describirOperacion({ ...base, tipo: "TENENCIA_INICIAL" })).toBe(
      "Tenencia inicial de 100 AMZN a $ 2.785,00 promedio",
    );
    expect(describirOperacion({ ...base, tipo: "VENTA" })).toBe("Venta de 100 AMZN a $ 2.785,00");
    const cobro = {
      ticker: "YPFD",
      cantidad: null,
      precio: null,
      monto: d("12.5"),
      moneda: "USD_MEP" as const,
    };
    expect(describirOperacion({ ...cobro, tipo: "DIVIDENDO" })).toBe(
      "Dividendo de YPFD por US$ 12,50",
    );
    expect(describirOperacion({ ...cobro, tipo: "RENTA" })).toBe(
      "Renta (cupón) de YPFD por US$ 12,50",
    );
    expect(describirOperacion({ ...cobro, tipo: "DEPOSITO", ticker: null })).toBe(
      "Depósito de US$ 12,50",
    );
    expect(describirOperacion({ ...cobro, tipo: "COMISION", ticker: null })).toBe(
      "Comisión o gasto por US$ 12,50",
    );
  });

  it("explica el efecto de una operación sobre la tenencia", () => {
    expect(describirSimulacion(foto(72, 180000, 120), foto(172, 458500, 305))).toBe(
      "Tu tenencia de AMZN pasa de 72 a 172 y tu precio promedio de $ 2.500,00 a $ 2.665,70.",
    );
    expect(describirSimulacion(null, foto(72, 180000, 120))).toBe(
      "Vas a tener 72 AMZN con un precio promedio de $ 2.500,00.",
    );
    expect(describirSimulacion(foto(72, 180000, 120), foto(22, 55000, 36.67))).toBe(
      "Tu tenencia de AMZN pasa de 72 a 22.",
    );
    expect(describirSimulacion(foto(72, 180000, 120), foto(0, 0, 0))).toBe(
      "Tu tenencia de AMZN pasa de 72 a 0.",
    );
    expect(describirSimulacion(null, null)).toBe("La operación se puede registrar.");
  });
});
