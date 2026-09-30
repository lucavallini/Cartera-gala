import type { Moneda } from "@cartera/contratos";
import type { Decimal } from "./decimal";

const LOCALE = "es-AR";
const UN_MILLON = 1_000_000;

/** Decimales al mostrar montos de dinero. */
export const DECIMALES_MONTO = 2;
/** Decimales al mostrar precios (o cada 100 nominales, en renta fija). */
export const DECIMALES_PRECIO = 6;
/** Decimales al mostrar cantidades de un activo. */
export const DECIMALES_CANTIDAD = 6;
/** Decimales al mostrar porcentajes. */
export const DECIMALES_PORCENTAJE = 2;

export function simboloMoneda(moneda: Moneda | "USD"): string {
  return moneda === "ARS" ? "$" : "US$";
}

export function formatearNumero(valor: Decimal, maxDecimales = 2): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: maxDecimales }).format(
    valor.toNumber(),
  );
}

export function formatearMoneda(valor: Decimal, moneda: Moneda | "USD", decimales = 2): string {
  const numero = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor.toNumber());
  return `${simboloMoneda(moneda)} ${numero}`;
}

/** "$ 74,9 M" para montos grandes; sin decimales para el resto. */
export function formatearMonedaAbreviada(valor: Decimal, moneda: Moneda | "USD"): string {
  if (valor.abs().gte(UN_MILLON)) {
    const millones = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(
      valor.div(UN_MILLON).toNumber(),
    );
    return `${simboloMoneda(moneda)} ${millones} M`;
  }
  return formatearMoneda(valor, moneda, 0);
}

export function formatearPorcentaje(valor: Decimal, conSigno = true): string {
  const numero = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(valor.toNumber());
  return `${conSigno && valor.gt(0) ? "+" : ""}${numero}%`;
}

const TEXTO_MONEDA: Record<Moneda, string> = {
  ARS: "Pesos",
  USD_MEP: "Dólar MEP",
  USD_CCL: "Dólar cable",
  USD_EXTERIOR: "Dólar exterior",
};

/** Nombre llano de la moneda, para mostrar (el front solo muestra, no traduce códigos). */
export function textoMoneda(moneda: Moneda): string {
  return TEXTO_MONEDA[moneda];
}
