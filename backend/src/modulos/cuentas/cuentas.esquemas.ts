import { z } from "zod";
import type { CrearCuentaEntrada, EditarCuentaEntrada } from "@cartera/contratos";
import { esquemaConsultaListado } from "../../compartido/paginacion";

const LARGO_MAXIMO = 80;

const broker = z
  .string({ message: "Poné el nombre del bróker. Ejemplo: Bull Market." })
  .trim()
  .min(1, "Poné el nombre del bróker. Ejemplo: Bull Market.")
  .max(LARGO_MAXIMO, `Puede tener hasta ${LARGO_MAXIMO} caracteres.`);
const textoOpcional = z
  .string()
  .trim()
  .max(LARGO_MAXIMO, `Puede tener hasta ${LARGO_MAXIMO} caracteres.`);

export const esquemaCrearCuenta = z.object({
  broker,
  numeroComitente: textoOpcional.optional(),
  alias: textoOpcional.optional(),
}) satisfies z.ZodType<CrearCuentaEntrada>;

export const esquemaEditarCuenta = z
  .object({
    broker: broker.optional(),
    numeroComitente: textoOpcional.nullable().optional(),
    alias: textoOpcional.nullable().optional(),
  })
  .refine((cambios) => Object.values(cambios).some((valor) => valor !== undefined), {
    message: "No mandaste ningún cambio.",
  }) satisfies z.ZodType<EditarCuentaEntrada>;

export const esquemaConsultaCuentas = esquemaConsultaListado;
export type ConsultaCuentas = z.output<typeof esquemaConsultaCuentas>;
