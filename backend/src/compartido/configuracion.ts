import type { z } from "zod";

/** Los valores de ejemplo del .env.example empiezan así y nunca se aceptan como reales. */
export const PREFIJO_VALOR_DE_EJEMPLO = "cambiar-";

export function noEsValorDeEjemplo(valor: string): boolean {
  return !valor.startsWith(PREFIJO_VALOR_DE_EJEMPLO);
}

/** Texto legible con un problema por línea, para errores de configuración al arrancar. */
export function describirProblemas(error: z.ZodError): string {
  return error.issues
    .map((problema) => `${problema.path.join(".")}: ${problema.message}`)
    .join("\n  ");
}
