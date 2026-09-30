import type { Moneda } from "@cartera/contratos";
import { CERO, type Decimal } from "../../compartido/decimal";
import { IMPORTE_CERO, sumar } from "../../motor/importe";
import { cantidadDe, costoDe } from "../../motor/posicion";
import type { PosicionValuada } from "../../motor/totales";
import type { Importe } from "../../motor/tipos";
import type { ValuacionPosicion } from "../../motor/valuadores/valuador";
import type { InstrumentoCatalogado } from "../instrumentos";

/** Un activo sumado entre carteras y cuentas: así se muestra en la tabla. */
export interface TenenciaAgrupada {
  instrumento: InstrumentoCatalogado;
  cantidad: Decimal;
  costo: Importe;
  valor: Importe;
  realizado: Importe;
  cobros: Importe;
  monedaPrecio: Moneda;
  factorPrecio: Decimal;
  valuacion: ValuacionPosicion;
}

/** Solo lo que se tiene hoy, de mayor a menor valor. */
export function agruparPorInstrumento(
  valuadas: readonly PosicionValuada[],
  catalogo: ReadonlyMap<string, InstrumentoCatalogado>,
): TenenciaAgrupada[] {
  const grupos = new Map<string, TenenciaAgrupada>();
  for (const { posicion, valuacion } of valuadas) {
    const cantidad = cantidadDe(posicion);
    const instrumento = catalogo.get(posicion.instrumentoId);
    if (!instrumento || cantidad.lte(0)) continue;
    const actual = grupos.get(posicion.instrumentoId);
    grupos.set(posicion.instrumentoId, {
      instrumento,
      cantidad: (actual?.cantidad ?? CERO).plus(cantidad),
      costo: sumar(actual?.costo ?? IMPORTE_CERO, costoDe(posicion)),
      valor: sumar(actual?.valor ?? IMPORTE_CERO, valuacion.valor),
      realizado: sumar(actual?.realizado ?? IMPORTE_CERO, posicion.realizado),
      cobros: sumar(actual?.cobros ?? IMPORTE_CERO, posicion.cobros),
      monedaPrecio: actual?.monedaPrecio ?? posicion.monedaPrecio,
      factorPrecio: posicion.factorPrecio,
      valuacion: actual?.valuacion ?? valuacion,
    });
  }
  return [...grupos.values()].sort((a, b) => b.valor.ars.comparedTo(a.valor.ars));
}
