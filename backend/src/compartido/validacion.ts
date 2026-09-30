import { z } from "zod";
import { ErrorValidacion } from "./errores";
import { mensajeAmigable } from "./mensajes-validacion";

z.config({ customError: mensajeAmigable });

export function validar<T extends z.ZodType>(esquema: T, datos: unknown): z.output<T> {
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) {
    throw new ErrorValidacion(
      "Hay datos inválidos. Revisá los campos marcados.",
      resultado.error.issues.map((problema) => ({
        campo: problema.path.join("."),
        mensaje: problema.message,
      })),
    );
  }
  return resultado.data;
}
