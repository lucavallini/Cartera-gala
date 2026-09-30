import Decimal from "decimal.js";

// Precisión 40: alcanza para sumar y restar exacto cantidades y costos ya cuantizados a
// DECIMALES_MOTOR decimales, incluso cuando vienen de fracciones largas (por ejemplo, lotes
// escalados ×503/511): con la precisión por defecto esas sumas y restas se redondeaban y dejaban
// resto al vender todo lo que quedaba.
Decimal.set({ precision: 40 });

export { Decimal };

export const CERO = new Decimal(0);
export const CIEN = new Decimal(100);

/** Decimales a los que se cuantizan cantidades y costos dentro del motor de costos. */
export const DECIMALES_MOTOR = 12;

/** Trunca (nunca redondea para arriba) a la precisión interna del motor. */
export function cuantizar(valor: Decimal): Decimal {
  return valor.toDecimalPlaces(DECIMALES_MOTOR, Decimal.ROUND_DOWN);
}

/** Convierte un Decimal de Prisma, un número o un texto a Decimal de decimal.js. */
export function aDecimal(valor: { toString(): string } | number | string): Decimal {
  return new Decimal(valor.toString());
}

/** Número para mostrar, redondeado. Solo se usa al armar DTOs, nunca para calcular. */
export function aNumero(valor: Decimal, decimales: number): number {
  return valor.toDecimalPlaces(decimales, Decimal.ROUND_HALF_UP).toNumber();
}
