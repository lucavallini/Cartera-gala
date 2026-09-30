import { z } from "zod";
import type { CrearCarteraEntrada, EditarCarteraEntrada } from "@cartera/contratos";
import { esquemaConsultaListado } from "../../compartido/paginacion";

const LARGO_MAXIMO_NOMBRE = 60;
const LARGO_MAXIMO_DESCRIPCION = 500;
const ORDEN_MAXIMO = 10_000;

const nombre = z
  .string({ message: "Poné un nombre para la cartera." })
  .trim()
  .min(1, "Poné un nombre para la cartera.")
  .max(LARGO_MAXIMO_NOMBRE, `El nombre puede tener hasta ${LARGO_MAXIMO_NOMBRE} caracteres.`);

const descripcion = z
  .string()
  .trim()
  .max(
    LARGO_MAXIMO_DESCRIPCION,
    `La descripción puede tener hasta ${LARGO_MAXIMO_DESCRIPCION} caracteres.`,
  );

export const esquemaCrearCartera = z.object({
  nombre,
  descripcion: descripcion.optional(),
}) satisfies z.ZodType<CrearCarteraEntrada>;

export const esquemaEditarCartera = z
  .object({
    nombre: nombre.optional(),
    descripcion: descripcion.nullable().optional(),
    esPrincipal: z.boolean().optional(),
    archivada: z.boolean().optional(),
    orden: z.number().int().min(0).max(ORDEN_MAXIMO).optional(),
  })
  .refine((cambios) => Object.values(cambios).some((valor) => valor !== undefined), {
    message: "No mandaste ningún cambio.",
  }) satisfies z.ZodType<EditarCarteraEntrada>;

export const esquemaConsultaCarteras = esquemaConsultaListado.extend({
  incluirArchivadas: z
    .enum(["true", "false"])
    .default("false")
    .transform((valor) => valor === "true"),
});

export type ConsultaCarteras = z.output<typeof esquemaConsultaCarteras>;
