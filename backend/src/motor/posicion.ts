import type { Moneda } from "@cartera/contratos";
import { CERO, type Decimal } from "../compartido/decimal";
import { enMoneda, IMPORTE_CERO, sumarTodos } from "./importe";
import type { EstadoCartera, Importe, Posicion } from "./tipos";

export function cantidadDe(posicion: Posicion): Decimal {
  return posicion.lotes.reduce((total, lote) => total.plus(lote.cantidad), CERO);
}

/** Lo que se pagó por lo que se tiene hoy. */
export function costoDe(posicion: Posicion): Importe {
  return sumarTodos(posicion.lotes.map((lote) => lote.costo));
}

/** Lo que hace falta para calcular el precio promedio: una posición o un grupo de posiciones. */
export interface ConPrecioPromedio {
  cantidad: Decimal;
  costo: Importe;
  monedaPrecio: Moneda;
  factorPrecio: Decimal;
}

/** Precio promedio por unidad (o cada 100 nominales), en la moneda del activo. */
export function precioPromedio(posicion: ConPrecioPromedio): Decimal | null {
  if (posicion.cantidad.isZero()) return null;
  return enMoneda(posicion.costo, posicion.monedaPrecio)
    .div(posicion.cantidad)
    .div(posicion.factorPrecio);
}

export function claveDePosicion(
  carteraId: string,
  instrumentoId: string,
  cuentaId: string | null,
): string {
  return `${carteraId}|${instrumentoId}|${cuentaId ?? "-"}`;
}

export function crearEstadoVacio(): EstadoCartera {
  return {
    posiciones: new Map(),
    efectivo: new Map(),
    aportesNetos: IMPORTE_CERO,
    comisionesSueltas: IMPORTE_CERO,
    registraEfectivo: false,
  };
}
