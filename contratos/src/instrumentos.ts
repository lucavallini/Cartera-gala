import type { Moneda } from "./comunes";

export type TipoInstrumento =
  | "ACCION"
  | "CEDEAR"
  | "ON"
  | "BONO"
  | "LETRA"
  | "FCI"
  | "ETF_EXTERIOR"
  | "CAUCION"
  | "PLAZO_FIJO"
  | "CRIPTO"
  | "OPCION"
  | "FUTURO"
  | "INDICE"
  | "OTRO";

export interface PrecioManualDto {
  precio: number;
  moneda: Moneda;
  /** ISO 8601. */
  cargadoEn: string;
}

export interface InstrumentoDto {
  id: string;
  ticker: string;
  nombre: string | null;
  tipo: TipoInstrumento;
  /** "Obligación negociable". */
  tipoTexto: string;
  /** Monedas en las que cotiza. */
  monedas: Moneda[];
  factorPrecio: number;
  /** "Cotiza cada 100 nominales: el valor es cantidad × precio ÷ 100." */
  explicacionPrecio: string;
  emisor: string | null;
  sector: string | null;
  /** Precio cargado a mano por el usuario para cuando no hay cotización. */
  precioManual: PrecioManualDto | null;
}

export interface EditarInstrumentoEntrada {
  nombre?: string | null;
  emisor?: string | null;
  sector?: string | null;
}

export interface PrecioManualEntrada {
  precio: number;
  moneda: Moneda;
}
