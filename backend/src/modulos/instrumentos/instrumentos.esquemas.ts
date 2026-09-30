import { z } from "zod";
import type { EditarInstrumentoEntrada } from "@cartera/contratos";
import { esquemaDecimalPositivo, esquemaMoneda } from "../../compartido/esquemas";

const LARGO_MAXIMO_TICKER = 20;
const LARGO_MAXIMO_TEXTO = 120;
const MENSAJE_BUSQUEDA = "Escribí el ticker o parte del ticker.";

export const esquemaBusqueda = z.object({
  q: z
    .string({ message: MENSAJE_BUSQUEDA })
    .trim()
    .min(1, MENSAJE_BUSQUEDA)
    .max(LARGO_MAXIMO_TICKER, `El ticker puede tener hasta ${LARGO_MAXIMO_TICKER} caracteres.`)
    .transform((texto) => texto.toUpperCase()),
});

const textoOpcional = z
  .string()
  .trim()
  .max(LARGO_MAXIMO_TEXTO, `Puede tener hasta ${LARGO_MAXIMO_TEXTO} caracteres.`)
  .nullable()
  .optional();

export const esquemaEditarInstrumento = z
  .object({ nombre: textoOpcional, emisor: textoOpcional, sector: textoOpcional })
  .refine((cambios) => Object.values(cambios).some((valor) => valor !== undefined), {
    message: "No mandaste ningún cambio.",
  }) satisfies z.ZodType<EditarInstrumentoEntrada>;

export const esquemaPrecioManual = z.object({
  precio: esquemaDecimalPositivo,
  moneda: esquemaMoneda,
});
