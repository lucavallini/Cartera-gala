import type { TipoInstrumento } from "@cartera/contratos";
import { ValuadorPorCotizacion } from "./por-cotizacion";
import { ValuadorPorDevengamiento } from "./por-devengamiento";
import type { Valuador } from "./valuador";

const POR_COTIZACION = new ValuadorPorCotizacion();
const POR_DEVENGAMIENTO = new ValuadorPorDevengamiento();
const TIPOS_QUE_DEVENGAN: ReadonlySet<TipoInstrumento> = new Set(["PLAZO_FIJO", "CAUCION"]);

export function valuadorPara(tipo: TipoInstrumento): Valuador {
  return TIPOS_QUE_DEVENGAN.has(tipo) ? POR_DEVENGAMIENTO : POR_COTIZACION;
}
