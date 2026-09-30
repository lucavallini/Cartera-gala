import type { Decimal } from "../../compartido/decimal";
import type { Importe, Posicion, PrecioVigente } from "../tipos";

export type FuentePrecio = "MERCADO" | "MANUAL" | "COSTO" | "DEVENGADO";

export interface ValuacionPosicion {
  valor: Importe;
  /** Precio actual en la moneda en que el usuario opera el activo. */
  precio: Decimal | null;
  variacionPct: Decimal | null;
  sinCotizacion: boolean;
  fuente: FuentePrecio;
}

export interface ContextoValuacion {
  /** Pesos por dólar de referencia hoy. */
  dolar: Decimal;
  ahora: Date;
  /** Tasa nominal anual (%) de los instrumentos que devengan. */
  tasaAnual: Decimal | null;
}

/** Cómo se valúa una familia de instrumentos. */
export interface Valuador {
  valuar(
    posicion: Posicion,
    precio: PrecioVigente | undefined,
    contexto: ContextoValuacion,
  ): ValuacionPosicion;
}
