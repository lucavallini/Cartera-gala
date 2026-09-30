import type { Moneda } from "@cartera/contratos";
import { CERO, cuantizar, type Decimal } from "../compartido/decimal";
import type { Importe } from "./tipos";

export const IMPORTE_CERO: Importe = { ars: CERO, usd: CERO };

/** Un monto en la moneda de la operación, expresado en pesos y en dólares. */
export function importeDe(monto: Decimal, moneda: Moneda, tipoCambio: Decimal): Importe {
  return moneda === "ARS"
    ? { ars: monto, usd: monto.div(tipoCambio) }
    : { ars: monto.mul(tipoCambio), usd: monto };
}

export function sumar(a: Importe, b: Importe): Importe {
  return { ars: a.ars.plus(b.ars), usd: a.usd.plus(b.usd) };
}

export function restar(a: Importe, b: Importe): Importe {
  return { ars: a.ars.minus(b.ars), usd: a.usd.minus(b.usd) };
}

export function escalar(importe: Importe, factor: Decimal): Importe {
  return { ars: importe.ars.mul(factor), usd: importe.usd.mul(factor) };
}

export function sumarTodos(importes: Iterable<Importe>): Importe {
  let total = IMPORTE_CERO;
  for (const importe of importes) total = sumar(total, importe);
  return total;
}

/** Cuantiza (trunca) ambas monedas a la precisión interna del motor. */
export function cuantizarImporte(importe: Importe): Importe {
  return { ars: cuantizar(importe.ars), usd: cuantizar(importe.usd) };
}

/** La parte en pesos para ARS; la parte en dólares para cualquier dólar. */
export function enMoneda(importe: Importe, moneda: Moneda | "USD"): Decimal {
  return moneda === "ARS" ? importe.ars : importe.usd;
}
