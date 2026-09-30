import { z } from "zod";
import type { Pagina } from "@cartera/contratos";

export const POR_PAGINA_POR_DEFECTO = 20;
export const POR_PAGINA_MAXIMO = 100;
/** Tope para que nadie pida un salto absurdo que haga fallar la consulta. */
export const PAGINA_MAXIMA = 1_000_000;

export const esquemaConsultaListado = z.object({
  pagina: z.coerce
    .number()
    .int()
    .min(1, "La página empieza en 1.")
    .max(PAGINA_MAXIMA, `La página tiene que ser menor a ${PAGINA_MAXIMA}.`)
    .default(1),
  porPagina: z.coerce
    .number()
    .int()
    .min(1)
    .max(POR_PAGINA_MAXIMO, `Se pueden pedir hasta ${POR_PAGINA_MAXIMO} por página.`)
    .default(POR_PAGINA_POR_DEFECTO),
  orden: z.string().optional(),
  direccion: z.enum(["asc", "desc"]).default("asc"),
});

export type ConsultaListado = z.output<typeof esquemaConsultaListado>;

export interface OpcionesListado extends ConsultaListado {
  filtros?: Record<string, unknown>;
}

export function construirPagina<T>(
  items: T[],
  total: number,
  opciones: Pick<OpcionesListado, "pagina" | "porPagina">,
): Pagina<T> {
  return {
    items,
    total,
    pagina: opciones.pagina,
    porPagina: opciones.porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / opciones.porPagina)),
  };
}

export function mapearPagina<T, U>(pagina: Pagina<T>, mapear: (item: T) => U): Pagina<U> {
  return { ...pagina, items: pagina.items.map(mapear) };
}
