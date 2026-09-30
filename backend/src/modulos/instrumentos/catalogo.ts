import type { Moneda, TipoInstrumento } from "@cartera/contratos";
import { Decimal } from "../../compartido/decimal";
import {
  FAMILIAS_MERCADO,
  type FamiliaMercado,
  type ListasMercado,
} from "../../proveedores/cotizaciones/proveedor-cotizaciones";

export type Simbolos = Partial<Record<Moneda, string>>;

export interface InstrumentoDeCatalogo {
  ticker: string;
  tipo: TipoInstrumento;
  simbolos: Simbolos;
  factorPrecio: Decimal;
}

const TIPO_POR_FAMILIA: Record<FamiliaMercado, TipoInstrumento> = {
  ACCIONES: "ACCION",
  CEDEARS: "CEDEAR",
  BONOS: "BONO",
  OBLIGACIONES: "ON",
  LETRAS: "LETRA",
};

const FAMILIA_POR_TIPO = new Map<TipoInstrumento, FamiliaMercado>(
  FAMILIAS_MERCADO.map((familia) => [TIPO_POR_FAMILIA[familia], familia]),
);

const FAMILIAS_RENTA_FIJA: ReadonlySet<FamiliaMercado> = new Set([
  "BONOS",
  "OBLIGACIONES",
  "LETRAS",
]);
/** La renta fija cotiza cada 100 de valor nominal. */
const FACTOR_RENTA_FIJA = new Decimal("0.01");
const FACTOR_UNITARIO = new Decimal(1);

/** data912 marca las variantes en dólares con un sufijo: D = MEP, C = cable. */
export const MONEDA_POR_SUFIJO: Record<string, Moneda> = { D: "USD_MEP", C: "USD_CCL" };
/** Las ONs en pesos terminan en O (por ejemplo YM39O): la base para su variante en dólares. */
export const SUFIJO_ON = "O";

export function familiaDe(tipo: TipoInstrumento): FamiliaMercado | null {
  return FAMILIA_POR_TIPO.get(tipo) ?? null;
}

function varianteDe(
  simbolo: string,
  simbolos: ReadonlySet<string>,
  familia: FamiliaMercado,
): { base: string; moneda: Moneda } | null {
  const moneda = MONEDA_POR_SUFIJO[simbolo.slice(-1)];
  if (!moneda) return null;
  const raiz = simbolo.slice(0, -1);
  if (simbolos.has(raiz)) return { base: raiz, moneda };
  // Las ONs en pesos terminan en O (YM39O ↔ YM39D): si solo cotiza en dólares, igual se nombra así.
  if (familia === "OBLIGACIONES" && raiz.length > 0) return { base: `${raiz}${SUFIJO_ON}`, moneda };
  return null;
}

/** Un instrumento por ticker, con el símbolo de data912 para cada moneda en que cotiza. */
export function derivarCatalogo(listas: ListasMercado): InstrumentoDeCatalogo[] {
  const porTicker = new Map<string, InstrumentoDeCatalogo>();
  for (const familia of FAMILIAS_MERCADO) {
    const simbolos = new Set(listas[familia].map((fila) => fila.simbolo));
    const deLaFamilia = new Map<string, InstrumentoDeCatalogo>();
    for (const simbolo of simbolos) {
      const variante = varianteDe(simbolo, simbolos, familia);
      const ticker = variante?.base ?? simbolo;
      let instrumento = deLaFamilia.get(ticker);
      if (!instrumento) {
        instrumento = {
          ticker,
          tipo: TIPO_POR_FAMILIA[familia],
          simbolos: {},
          factorPrecio: FAMILIAS_RENTA_FIJA.has(familia) ? FACTOR_RENTA_FIJA : FACTOR_UNITARIO,
        };
        deLaFamilia.set(ticker, instrumento);
      }
      instrumento.simbolos[variante?.moneda ?? "ARS"] = simbolo;
    }
    // El catálogo es único por ticker: si aparece en dos familias queda la primera.
    for (const [ticker, instrumento] of deLaFamilia) {
      if (!porTicker.has(ticker)) porTicker.set(ticker, instrumento);
    }
  }
  return [...porTicker.values()];
}
