import { z } from "zod";
import type { Moneda } from "@cartera/contratos";
import { Decimal } from "./decimal";
import { esTextoDiaValido } from "./fechas";

/** Orden canónico de las monedas (así se listan en toda la app). */
export const MONEDAS = [
  "ARS",
  "USD_MEP",
  "USD_CCL",
  "USD_EXTERIOR",
] as const satisfies readonly Moneda[];

function esquemaDecimal(esValido: (valor: Decimal) => boolean, mensaje: string) {
  return z.union([z.number(), z.string().trim()], { message: mensaje }).transform((valor, ctx) => {
    try {
      const decimal = new Decimal(valor);
      if (decimal.isFinite() && esValido(decimal)) return decimal;
    } catch {
      // se informa abajo con el mensaje llano
    }
    ctx.addIssue({ code: "custom", message: mensaje });
    return z.NEVER;
  });
}

export const esquemaDecimalPositivo = esquemaDecimal(
  (valor) => valor.gt(0),
  "Tiene que ser un número mayor a cero.",
);

export const esquemaDecimalNoNegativo = esquemaDecimal(
  (valor) => valor.gte(0),
  "No puede ser negativo.",
);

export const esquemaFechaDia = z
  .string({ message: "Poné una fecha válida con el formato AAAA-MM-DD." })
  .refine(esTextoDiaValido, "Poné una fecha válida con el formato AAAA-MM-DD.");

export const esquemaMoneda = z.enum(MONEDAS, {
  message: "Elegí la moneda: pesos, dólar MEP, dólar cable o dólar del exterior.",
});
