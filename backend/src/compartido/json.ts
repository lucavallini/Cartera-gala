import type { Prisma } from "../generado/prisma/client";

/** Convierte un valor (con fechas y Decimal) a JSON plano para guardarlo en una columna Json. */
export function aJson(valor: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
}
