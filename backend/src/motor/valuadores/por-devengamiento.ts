import { Decimal } from "../../compartido/decimal";
import { IMPORTE_CERO, escalar, sumar } from "../importe";
import { costoDe } from "../posicion";
import type { Posicion, PrecioVigente } from "../tipos";
import type { ContextoValuacion, ValuacionPosicion, Valuador } from "./valuador";

const DIAS_POR_ANIO = 365;
const MS_POR_DIA = 86_400_000;
const CIEN = 100;

/** Plazos fijos y cauciones: capital más el interés de los días transcurridos. */
export class ValuadorPorDevengamiento implements Valuador {
  valuar(
    posicion: Posicion,
    _precio: PrecioVigente | undefined,
    contexto: ContextoValuacion,
  ): ValuacionPosicion {
    const { tasaAnual, ahora } = contexto;
    if (!tasaAnual) {
      return {
        valor: costoDe(posicion),
        precio: null,
        variacionPct: null,
        sinCotizacion: false,
        fuente: "COSTO",
      };
    }
    const valor = posicion.lotes.reduce((total, lote) => {
      const dias = Math.max(0, Math.floor((ahora.getTime() - lote.fecha.getTime()) / MS_POR_DIA));
      const factor = new Decimal(1).plus(tasaAnual.div(CIEN).mul(dias).div(DIAS_POR_ANIO));
      return sumar(total, escalar(lote.costo, factor));
    }, IMPORTE_CERO);
    return { valor, precio: null, variacionPct: null, sinCotizacion: false, fuente: "DEVENGADO" };
  }
}
