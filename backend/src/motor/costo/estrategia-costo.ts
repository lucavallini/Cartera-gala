import type { MetodoCosto } from "@cartera/contratos";
import type { Decimal } from "../../compartido/decimal";
import type { Importe, Lote } from "../tipos";
import { Fifo } from "./fifo";
import { PrecioPromedio } from "./precio-promedio";

export interface ResultadoConsumo {
  restantes: Lote[];
  costoConsumido: Importe;
}

/** Cómo se calcula el costo de lo que se vende. La cantidad ya viene validada (≤ tenencia). */
export interface EstrategiaCosto {
  readonly metodo: MetodoCosto;
  consumir(lotes: readonly Lote[], cantidad: Decimal): ResultadoConsumo;
}

const ESTRATEGIAS: Record<MetodoCosto, EstrategiaCosto> = {
  PRECIO_PROMEDIO: new PrecioPromedio(),
  FIFO: new Fifo(),
};

export function estrategiaDeCosto(metodo: MetodoCosto): EstrategiaCosto {
  return ESTRATEGIAS[metodo];
}
