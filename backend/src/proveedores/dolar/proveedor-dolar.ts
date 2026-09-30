import type { TipoDolar } from "@cartera/contratos";
import type { Decimal } from "../../compartido/decimal";
import type { DatoConFecha } from "../http/proveedor-http-base";

export interface CotizacionDolar {
  tipo: TipoDolar;
  compra: Decimal | null;
  venta: Decimal;
  actualizadoEn: Date;
}

export interface PuntoDolar {
  /** AAAA-MM-DD */
  fecha: string;
  venta: Decimal;
}

export interface ProveedorDolarActual {
  actuales(forzar?: boolean): Promise<DatoConFecha<CotizacionDolar[]>>;
}

export interface ProveedorDolarHistorico {
  historico(tipo: TipoDolar): Promise<DatoConFecha<PuntoDolar[]>>;
}

export interface ProveedorFeriados {
  /** Fechas AAAA-MM-DD en que el mercado no opera. */
  feriados(anio: number): Promise<DatoConFecha<string[]>>;
}

/** Nombre que usan dolarapi y argentinadatos para cada tipo de dólar. */
export const CASA_POR_TIPO: Record<TipoDolar, string> = {
  OFICIAL: "oficial",
  MEP: "bolsa",
  CCL: "contadoconliqui",
  BLUE: "blue",
  MAYORISTA: "mayorista",
  CRIPTO: "cripto",
};
