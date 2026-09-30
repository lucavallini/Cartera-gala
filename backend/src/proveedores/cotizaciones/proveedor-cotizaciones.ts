import type { Decimal } from "../../compartido/decimal";
import type { DatoConFecha } from "../http/proveedor-http-base";

export type FamiliaMercado = "ACCIONES" | "CEDEARS" | "BONOS" | "OBLIGACIONES" | "LETRAS";

export const FAMILIAS_MERCADO: readonly FamiliaMercado[] = [
  "ACCIONES",
  "CEDEARS",
  "BONOS",
  "OBLIGACIONES",
  "LETRAS",
];

export interface FilaMercado {
  simbolo: string;
  precio: Decimal;
  variacionPct: Decimal | null;
}

export type ListasMercado = Record<FamiliaMercado, FilaMercado[]>;

export interface PuntoHistorico {
  /** AAAA-MM-DD */
  fecha: string;
  cierre: Decimal;
}

export interface ProveedorCotizaciones {
  listas(forzar?: boolean): Promise<DatoConFecha<ListasMercado>>;
  historico(familia: FamiliaMercado, simbolo: string): Promise<DatoConFecha<PuntoHistorico[]>>;
}
